//! Geocoding (Photon) and walking routes (GraphHopper). The app never calls them directly.

use axum::{
    Json,
    extract::{Query, State},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use utoipa::{IntoParams, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    state::AppState,
};

/// GraphHopper profile with the safe walking custom model (infra/graphhopper/config.yml).
pub const WALK_PROFILE: &str = "foot_safe";
const EARTH_RADIUS_M: f64 = 6_371_008.8;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(geocode)).routes(routes!(reverse))
}

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
pub struct Place {
    #[schema(example = "Romorantin-Lanthenay")]
    pub label: String,
    #[schema(example = 47.3594)]
    pub lat: f64,
    #[schema(example = 1.7419)]
    pub lon: f64,
}

#[derive(Deserialize, IntoParams)]
pub struct GeocodeQuery {
    /// Text typed by the user.
    q: String,
    /// Bias results around this point (optional).
    lat: Option<f64>,
    lon: Option<f64>,
    #[param(maximum = 20)]
    limit: Option<u8>,
    #[param(example = "fr")]
    lang: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct GeocodeResult {
    #[schema(example = "Paris")]
    pub name: String,
    /// Secondary line, e.g. postcode, city and department.
    pub detail: String,
    pub place: Place,
}

/// Address autocomplete.
#[utoipa::path(get, path = "/geocode", tag = "geo", params(GeocodeQuery), security(("bearer" = [])),
    responses((status = 200, body = Vec<GeocodeResult>), (status = 502, body = ErrorBody)))]
async fn geocode(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<GeocodeQuery>,
) -> AppResult<Json<Vec<GeocodeResult>>> {
    let text = query.q.trim();
    if text.is_empty() || text.len() > 200 {
        return Ok(Json(Vec::new()));
    }
    let mut params = vec![
        ("q", text.to_owned()),
        ("limit", query.limit.unwrap_or(8).min(20).to_string()),
        ("lang", query.lang.unwrap_or_else(|| "fr".to_owned())),
    ];
    if let (Some(lat), Some(lon)) = (query.lat, query.lon) {
        params.push(("lat", lat.to_string()));
        params.push(("lon", lon.to_string()));
    }
    let response: PhotonResponse = state
        .http
        .get(format!("{}/api", state.config.photon_url))
        .query(&params)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|e| AppError::upstream(format!("geocoder unavailable: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::upstream(format!("invalid geocoder response: {e}")))?;
    Ok(Json(response.features.into_iter().map(PhotonFeature::into_result).collect()))
}

#[derive(Deserialize, IntoParams)]
pub struct ReverseQuery {
    lat: f64,
    lon: f64,
    #[param(example = "fr")]
    lang: Option<String>,
}

/// The nearest address to a point picked on the map.
#[utoipa::path(get, path = "/reverse", tag = "geo", params(ReverseQuery), security(("bearer" = [])),
    responses((status = 200, body = GeocodeResult), (status = 404, body = ErrorBody), (status = 502, body = ErrorBody)))]
async fn reverse(
    State(state): State<AppState>,
    _user: AuthUser,
    Query(query): Query<ReverseQuery>,
) -> AppResult<Json<GeocodeResult>> {
    if !(-90.0..=90.0).contains(&query.lat) || !(-180.0..=180.0).contains(&query.lon) {
        return Err(AppError::bad_request("invalid_place", "invalid coordinates"));
    }
    let response: PhotonResponse = state
        .http
        .get(format!("{}/reverse", state.config.photon_url))
        .query(&[
            ("lat", query.lat.to_string()),
            ("lon", query.lon.to_string()),
            ("radius", "1".to_owned()),
            ("limit", "1".to_owned()),
            ("lang", query.lang.unwrap_or_else(|| "fr".to_owned())),
        ])
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|e| AppError::upstream(format!("geocoder unavailable: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::upstream(format!("invalid geocoder response: {e}")))?;
    let mut result = response
        .features
        .into_iter()
        .next()
        .map(PhotonFeature::into_result)
        .ok_or_else(|| AppError::not_found("nothing here"))?;
    // Keep the point the walker chose, not the address centre.
    result.place.lat = query.lat;
    result.place.lon = query.lon;
    Ok(Json(result))
}

#[derive(Deserialize)]
struct PhotonResponse {
    features: Vec<PhotonFeature>,
}

#[derive(Deserialize)]
struct PhotonFeature {
    geometry: PhotonGeometry,
    properties: PhotonProperties,
}

#[derive(Deserialize)]
struct PhotonGeometry {
    coordinates: [f64; 2],
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct PhotonProperties {
    name: Option<String>,
    housenumber: Option<String>,
    street: Option<String>,
    postcode: Option<String>,
    city: Option<String>,
    county: Option<String>,
}

impl PhotonFeature {
    fn into_result(self) -> GeocodeResult {
        let p = self.properties;
        let street = p.street.map(|s| match &p.housenumber {
            Some(n) => format!("{n} {s}"),
            None => s,
        });
        let name = p.name.clone().or_else(|| street.clone()).or_else(|| p.city.clone()).unwrap_or_default();
        let mut parts: Vec<String> = Vec::new();
        for part in [street, p.postcode, p.city, p.county].into_iter().flatten() {
            if part != name && !parts.contains(&part) {
                parts.push(part);
            }
        }
        let detail = parts.join(", ");
        let label = if detail.is_empty() { name.clone() } else { format!("{name}, {detail}") };
        let [lon, lat] = self.geometry.coordinates;
        GeocodeResult { name, detail, place: Place { label, lat, lon } }
    }
}

/// A computed walking route: `[lon, lat, cumulative_m]` points.
pub struct WalkingRoute {
    pub path: Vec<[f64; 3]>,
    pub distance_m: f64,
    pub engine_version: String,
}

/// Asks GraphHopper for a safe walking route between two places.
pub async fn walking_route(state: &AppState, start: &Place, end: &Place) -> AppResult<WalkingRoute> {
    let response = state
        .http
        .post(format!("{}/route", state.config.graphhopper_url))
        .json(&json!({
            "points": [[start.lon, start.lat], [end.lon, end.lat]],
            "profile": WALK_PROFILE,
            "points_encoded": false,
            "instructions": false,
        }))
        .send()
        .await
        .map_err(|e| AppError::upstream(format!("routing engine unavailable: {e}")))?;

    if response.status().is_client_error() {
        let message =
            response.json::<GhError>().await.map_or_else(|_| "no route found".to_owned(), |e| e.message);
        return Err(AppError::unprocessable("route_not_found", message));
    }
    let body: GhResponse = response
        .error_for_status()
        .map_err(|e| AppError::upstream(format!("routing engine error: {e}")))?
        .json()
        .await
        .map_err(|e| AppError::upstream(format!("invalid routing response: {e}")))?;
    let path = body
        .paths
        .into_iter()
        .next()
        .ok_or_else(|| AppError::unprocessable("route_not_found", "no route found"))?;
    let path = with_cumulative_distance(&path.points.coordinates);
    let distance_m = path.last().map_or(0.0, |p| p[2]);
    if distance_m <= 0.0 {
        return Err(AppError::unprocessable("route_too_short", "start and destination are the same"));
    }
    let engine_version = format!(
        "graphhopper:{WALK_PROFILE}:{}",
        body.info.road_data_timestamp.unwrap_or_else(|| "unknown".to_owned())
    );
    Ok(WalkingRoute { path, distance_m, engine_version })
}

#[derive(Deserialize)]
struct GhError {
    message: String,
}

#[derive(Deserialize)]
struct GhResponse {
    paths: Vec<GhPath>,
    #[serde(default)]
    info: GhInfo,
}

#[derive(Deserialize, Default)]
struct GhInfo {
    road_data_timestamp: Option<String>,
}

#[derive(Deserialize)]
struct GhPath {
    points: GhPoints,
}

#[derive(Deserialize)]
struct GhPoints {
    coordinates: Vec<Vec<f64>>,
}

fn with_cumulative_distance(coordinates: &[Vec<f64>]) -> Vec<[f64; 3]> {
    let mut total = 0.0;
    let mut previous: Option<(f64, f64)> = None;
    coordinates
        .iter()
        .filter(|c| c.len() >= 2)
        .map(|c| {
            let (lon, lat) = (c[0], c[1]);
            if let Some((plon, plat)) = previous {
                total += haversine_m(plat, plon, lat, lon);
            }
            previous = Some((lon, lat));
            [lon, lat, (total * 10.0).round() / 10.0]
        })
        .collect()
}

pub fn haversine_m(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let (p1, p2) = (lat1.to_radians(), lat2.to_radians());
    let dp = (lat2 - lat1).to_radians();
    let dl = (lon2 - lon1).to_radians();
    let a = (dp / 2.0).sin().powi(2) + p1.cos() * p2.cos() * (dl / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_M * a.sqrt().asin()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn haversine_matches_known_distance() {
        // Paris (Notre-Dame) to Romorantin town hall: about 172 km as the crow flies.
        let d = haversine_m(48.8530, 2.3499, 47.3594, 1.7419);
        assert!((d - 172_000.0).abs() < 2_000.0, "{d}");
    }

    #[test]
    fn cumulative_distance_grows() {
        let path = with_cumulative_distance(&[vec![1.0, 47.0], vec![1.0, 47.001], vec![1.0, 47.002, 120.0]]);
        assert_eq!(path.len(), 3);
        assert!((path[1][2] - 111.2).abs() < 0.2);
        assert!((path[2][2] - 222.4).abs() < 0.2);
    }
}
