//! Base routes of the Explorer, published by the Cap team (a system account
//! nobody can sign in as) when the API starts. A route already published
//! under the same title is left alone, so adding one to `base-routes.json`
//! and deploying is enough. Destination photos come from Wikimedia Commons,
//! under a free licence, with their author and licence as credit.

use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    geo::Place,
    journeys::compute_route,
    state::AppState,
};

/// The Cap team account, created by a migration.
pub const TEAM: Uuid = Uuid::from_u128(0xca9);

const ROUTES: &str = include_str!("../base-routes.json");
const COMMONS: &str = "https://commons.wikimedia.org/w/api.php";
const AGENT: &str = "cap-api (https://github.com/theovil1/cap)";

#[derive(Deserialize)]
struct BaseRoute {
    title: String,
    description: String,
    tags: Vec<String>,
    start: Place,
    end: Place,
    /// A Commons file, `File:...`.
    photo: Option<String>,
}

/// Publish the base routes that are not there yet. Errors are logged, not fatal.
pub async fn publish_missing(state: AppState) {
    let routes: Vec<BaseRoute> = match serde_json::from_str(ROUTES) {
        Ok(routes) => routes,
        Err(e) => return tracing::error!(error = %e, "invalid base-routes.json"),
    };
    for route in routes {
        if let Err(e) = publish(&state, &route).await {
            tracing::warn!(title = route.title, error = ?e, "base route not published");
        }
    }
}

async fn publish(state: &AppState, route: &BaseRoute) -> AppResult<()> {
    let exists = sqlx::query_scalar!(
        "SELECT EXISTS (SELECT 1 FROM public_routes WHERE author_id = $1 AND title = $2) AS \"e!\"",
        TEAM,
        route.title
    )
    .fetch_one(&state.db)
    .await?;
    if exists {
        return Ok(());
    }
    // The photo first: when Commons fails, the route waits for the next start.
    let photo = match &route.photo {
        Some(file) => Some(commons_photo(state, file).await?),
        None => None,
    };
    let computed = compute_route(state, TEAM, route.start.clone(), route.end.clone()).await?;
    let id = Uuid::now_v7();
    let mut tags = route.tags.clone();
    tags.sort();
    sqlx::query!(
        "INSERT INTO public_routes (id, route_id, author_id, title, description, tags) VALUES ($1, $2, $3, $4, $5, $6)",
        id,
        computed.id,
        TEAM,
        route.title,
        route.description,
        &tags
    )
    .execute(&state.db)
    .await?;
    if let Some((image, credit)) = photo {
        sqlx::query!(
            "INSERT INTO public_route_photos (public_route_id, kind, content_type, image, credit)
             VALUES ($1, 'end', 'image/jpeg', $2, $3)",
            id,
            image,
            credit
        )
        .execute(&state.db)
        .await?;
    }
    tracing::info!(title = route.title, km = computed.distance_m / 1000.0, "base route published");
    Ok(())
}

/// A 1600 px JPEG of a Commons file and "Author, licence, Wikimedia Commons".
async fn commons_photo(state: &AppState, file: &str) -> AppResult<(Vec<u8>, String)> {
    let info: serde_json::Value = state
        .http
        .get(COMMONS)
        .header(reqwest::header::USER_AGENT, AGENT)
        .query(&[
            ("action", "query"),
            ("format", "json"),
            ("titles", file),
            ("prop", "imageinfo"),
            ("iiprop", "url|extmetadata"),
            ("iiurlwidth", "1600"),
        ])
        .send()
        .await
        .map_err(AppError::internal)?
        .error_for_status()
        .map_err(AppError::internal)?
        .json()
        .await
        .map_err(AppError::internal)?;
    let page =
        info["query"]["pages"].as_object().and_then(|p| p.values().next()).cloned().unwrap_or_default();
    let image = &page["imageinfo"][0];
    let text = |key: &str| image["extmetadata"][key]["value"].as_str().unwrap_or_default().to_owned();
    let licence = text("LicenseShortName");
    let free = ["CC BY", "CC0", "Public domain", "FAL"].iter().any(|l| licence.starts_with(l));
    let url = image["thumburl"].as_str().filter(|_| free).ok_or_else(|| {
        AppError::internal(std::io::Error::other(format!("{file}: no free image ({licence})")))
    })?;
    let artist = strip_tags(&text("Artist"));
    let bytes = state
        .http
        .get(url)
        .header(reqwest::header::USER_AGENT, AGENT)
        .send()
        .await
        .map_err(AppError::internal)?
        .error_for_status()
        .map_err(AppError::internal)?
        .bytes()
        .await
        .map_err(AppError::internal)?;
    let credit: String = format!("{artist}, {licence}, Wikimedia Commons").chars().take(200).collect();
    Ok((bytes.to_vec(), credit))
}

/// Commons gives the author as HTML (a link to their page).
fn strip_tags(html: &str) -> String {
    let mut out = String::new();
    let mut inside = false;
    for c in html.chars() {
        match c {
            '<' => inside = true,
            '>' => inside = false,
            _ if !inside => out.push(c),
            _ => {}
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base_routes_are_valid() {
        let routes: Vec<BaseRoute> = serde_json::from_str(ROUTES).unwrap();
        assert!(routes.len() >= 10);
        for r in &routes {
            assert!((3..=80).contains(&r.title.chars().count()), "{}", r.title);
            assert!(r.description.chars().count() <= 600, "{}", r.title);
            assert!(r.tags.iter().all(|t| crate::public_routes::TAGS.contains(&t.as_str())), "{}", r.title);
        }
    }

    #[test]
    fn strips_the_author_link() {
        assert_eq!(strip_tags("<a href=\"x\">Basile  Morin</a>"), "Basile Morin");
    }
}
