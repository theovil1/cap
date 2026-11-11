//! Stages: the towns a route goes through, found with Photon reverse geocoding.
//!
//! The route is sampled every kilometre. Each sample gives the town (commune) it lies in.
//! A town is a candidate when the route passes close to its centre, so the walker really
//! goes through it. Stages are then picked about every 20 km, preferring bigger places.

use std::{collections::HashSet, sync::Arc};

use serde::{Deserialize, Serialize};
use tokio::{sync::Semaphore, task::JoinSet};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    geo::haversine_m,
    state::AppState,
};

const SAMPLE_EVERY_M: f64 = 1_000.0;
/// The route must pass this close to a town centre to go "through" it.
const THROUGH_TOWN_M: f64 = 1_500.0;
const MIN_SPACING_M: f64 = 20_000.0;
/// Keeps long routes to about this many stages.
const MAX_STAGES: f64 = 30.0;
const CONCURRENT_LOOKUPS: usize = 8;

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema, PartialEq)]
pub struct Stage {
    pub id: Uuid,
    /// 0 is the start; the last stage is the destination.
    pub position: i32,
    pub name: String,
    /// Department, e.g. `Loiret`.
    pub county: Option<String>,
    pub lat: f64,
    pub lon: f64,
    /// Distance from the start of the route.
    pub at_m: f64,
}

/// A town crossed by the route.
#[derive(Clone, Debug, PartialEq)]
pub struct Town {
    pub name: String,
    pub county: Option<String>,
    /// 3 city, 2 town, 1 village or other.
    pub rank: u8,
    pub lat: f64,
    pub lon: f64,
}

/// Finds the stages of a route: `[lon, lat, cumulative_m]` points.
pub async fn find_stages(state: &AppState, path: &[[f64; 3]]) -> AppResult<Vec<Stage>> {
    let total = path.last().map_or(0.0, |p| p[2]);
    let samples = sample_path(path, SAMPLE_EVERY_M);
    let towns = lookup_towns(state, &samples).await?;
    Ok(pick_stages(path, total, &towns))
}

/// Points every `step` metres along the path, plus both ends: `(lat, lon, at_m)`.
pub fn sample_path(path: &[[f64; 3]], step: f64) -> Vec<(f64, f64, f64)> {
    let Some(last) = path.last() else { return Vec::new() };
    let mut samples = Vec::new();
    let mut target = 0.0;
    for pair in path.windows(2) {
        let ([lon1, lat1, d1], [lon2, lat2, d2]) = (pair[0], pair[1]);
        while target <= d2 && d2 > d1 {
            let t = (target - d1).max(0.0) / (d2 - d1);
            samples.push((lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t, target));
            target += step;
        }
    }
    if samples.last().is_none_or(|s| s.2 < last[2]) {
        samples.push((last[1], last[0], last[2]));
    }
    samples
}

async fn lookup_towns(state: &AppState, samples: &[(f64, f64, f64)]) -> AppResult<Vec<Option<Town>>> {
    let limit = Arc::new(Semaphore::new(CONCURRENT_LOOKUPS));
    let mut tasks = JoinSet::new();
    for (index, &(lat, lon, _)) in samples.iter().enumerate() {
        let (http, url, limit) = (state.http.clone(), state.config.photon_url.clone(), limit.clone());
        tasks.spawn(async move {
            let _permit = limit.acquire_owned().await;
            (index, reverse_town(&http, &url, lat, lon).await)
        });
    }
    let mut towns = vec![None; samples.len()];
    while let Some(joined) = tasks.join_next().await {
        let (index, town) = joined.map_err(AppError::internal)?;
        towns[index] = town?;
    }
    Ok(towns)
}

async fn reverse_town(
    http: &reqwest::Client,
    photon_url: &str,
    lat: f64,
    lon: f64,
) -> AppResult<Option<Town>> {
    let response: ReverseResponse = http
        .get(format!("{photon_url}/reverse"))
        .query(&[
            ("lat", lat.to_string()),
            ("lon", lon.to_string()),
            ("layer", "city".to_owned()),
            ("radius", "3".to_owned()),
            ("limit", "1".to_owned()),
            ("lang", "fr".to_owned()),
        ])
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|e| AppError::upstream(format!("geocoder unavailable: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::upstream(format!("invalid geocoder response: {e}")))?;
    Ok(response.features.into_iter().next().and_then(|f| {
        let [lon, lat] = f.geometry.coordinates;
        let rank = match f.properties.osm_value.as_deref() {
            Some("city") => 3,
            Some("town") => 2,
            _ => 1,
        };
        Some(Town { name: f.properties.name?, county: f.properties.county, rank, lat, lon })
    }))
}

#[derive(Deserialize)]
struct ReverseResponse {
    features: Vec<ReverseFeature>,
}

#[derive(Deserialize)]
struct ReverseFeature {
    geometry: ReverseGeometry,
    properties: ReverseProperties,
}

#[derive(Deserialize)]
struct ReverseGeometry {
    coordinates: [f64; 2],
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct ReverseProperties {
    name: Option<String>,
    county: Option<String>,
    osm_value: Option<String>,
}

/// Picks the stages from the town found at each sample.
pub fn pick_stages(path: &[[f64; 3]], total: f64, towns: &[Option<Town>]) -> Vec<Stage> {
    // Each crossed town once, placed where the route passes closest to its centre.
    let mut crossed: Vec<(Town, f64, f64)> = Vec::new(); // town, at_m, distance to centre
    let mut seen = HashSet::new();
    for town in towns.iter().flatten() {
        if seen.insert((town.name.clone(), town.county.clone())) {
            let (at_m, gap) = closest_point(path, town.lat, town.lon);
            crossed.push((town.clone(), at_m, gap));
        }
    }
    let first = towns.iter().flatten().next().cloned();
    let last = towns.iter().rev().flatten().next().cloned();
    let mut candidates: Vec<&(Town, f64, f64)> = crossed
        .iter()
        .filter(|(t, _, gap)| *gap <= THROUGH_TOWN_M && Some(t) != first.as_ref() && Some(t) != last.as_ref())
        .collect();
    candidates.sort_by(|a, b| a.1.total_cmp(&b.1));

    let spacing = MIN_SPACING_M.max(total / MAX_STAGES);
    let mut picked: Vec<(Town, f64)> = Vec::new();
    let mut from = 0.0;
    loop {
        let window = (from + 0.7 * spacing)..=(from + 1.5 * spacing);
        let in_window: Vec<_> = candidates.iter().filter(|c| window.contains(&c.1)).collect();
        let next = if in_window.is_empty() {
            candidates.iter().find(|c| c.1 > *window.end())
        } else {
            in_window.into_iter().max_by(|a, b| {
                let score =
                    |c: &(Town, f64, f64)| f64::from(c.0.rank) * spacing - (c.1 - from - spacing).abs();
                score(a).total_cmp(&score(b))
            })
        };
        match next {
            Some(c) if c.1 < total - 0.5 * spacing => {
                picked.push((c.0.clone(), c.1));
                from = c.1;
            }
            _ => break,
        }
    }

    let start = path.first().map_or((0.0, 0.0), |p| (p[1], p[0]));
    let end = path.last().map_or((0.0, 0.0), |p| (p[1], p[0]));
    let fallback = |(lat, lon): (f64, f64)| Town { name: String::new(), county: None, rank: 1, lat, lon };
    let mut all = vec![(first.unwrap_or_else(|| fallback(start)), 0.0)];
    all.extend(picked);
    all.push((last.unwrap_or_else(|| fallback(end)), total));
    all.into_iter()
        .enumerate()
        .map(|(position, (town, at_m))| Stage {
            id: Uuid::now_v7(),
            position: i32::try_from(position).unwrap_or(i32::MAX),
            name: town.name,
            county: town.county,
            lat: town.lat,
            lon: town.lon,
            at_m: (at_m * 10.0).round() / 10.0,
        })
        .collect()
}

/// Distance along the path of the point closest to `(lat, lon)`, and the gap to it.
fn closest_point(path: &[[f64; 3]], lat: f64, lon: f64) -> (f64, f64) {
    path.iter()
        .map(|p| (p[2], haversine_m(lat, lon, p[1], p[0])))
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .unwrap_or((0.0, f64::INFINITY))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn town(name: &str, rank: u8, lat: f64) -> Town {
        Town { name: name.to_owned(), county: None, rank, lat, lon: 1.0 }
    }

    /// A straight route going north for about 100 km.
    fn straight_path() -> Vec<[f64; 3]> {
        (0..=900).map(|i| [1.0, 47.0 + f64::from(i) * 0.001, f64::from(i) * 111.2]).collect()
    }

    #[test]
    fn samples_every_kilometre_and_both_ends() {
        let samples = sample_path(&straight_path(), 1_000.0);
        assert_eq!(samples.first().unwrap().2, 0.0);
        assert_eq!(samples[1].2, 1_000.0);
        assert!((samples.last().unwrap().2 - 100_080.0).abs() < 1.0);
    }

    #[test]
    fn picks_towns_about_every_twenty_km() {
        let path = straight_path();
        let samples = sample_path(&path, 1_000.0);
        let towns: Vec<Option<Town>> = samples
            .iter()
            .enumerate()
            .map(|(km, &(lat, _, _))| {
                Some(match km {
                    0..=2 => town("Start", 2, 47.0),
                    // A village and a bigger town in the same stretch: the town wins.
                    18..=19 => town("Village", 1, lat),
                    23..=24 => town("Town", 2, lat),
                    45..=46 => town("Middle", 1, lat),
                    // Off the route: never a stage.
                    60..=61 => Town { name: "Away".into(), county: None, rank: 3, lat, lon: 1.1 },
                    98.. => town("End", 2, 47.9),
                    _ => return None,
                })
            })
            .collect();
        let stages = pick_stages(&path, 100_080.0, &towns);
        let names: Vec<&str> = stages.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, ["Start", "Town", "Middle", "End"]);
        assert_eq!(stages[0].at_m, 0.0);
        assert_eq!(stages.last().unwrap().at_m, 100_080.0);
        assert!(stages.windows(2).all(|w| w[0].at_m < w[1].at_m));
    }

    #[test]
    fn short_route_has_start_and_end_only() {
        let path = &straight_path()[..50];
        let samples = sample_path(path, 1_000.0);
        let towns = vec![Some(town("Here", 1, 47.0)); samples.len()];
        let stages = pick_stages(path, path.last().unwrap()[2], &towns);
        assert_eq!(stages.len(), 2);
        assert_eq!(stages[0].name, "Here");
    }
}
