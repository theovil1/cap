//! The privacy policy, linked from the app and the App Store listing.

use axum::{
    extract::Query,
    http::{HeaderMap, header},
    response::Html,
};
use serde::Deserialize;

const STYLE: &str = include_str!("../pages/privacy.css");
const FR: &str = include_str!("../pages/privacy.fr.html");
const EN: &str = include_str!("../pages/privacy.en.html");

#[derive(Deserialize)]
pub struct Lang {
    lang: Option<String>,
}

/// `/privacy`: French unless `?lang=en` or the browser prefers English.
pub async fn privacy_page(Query(query): Query<Lang>, headers: HeaderMap) -> Html<String> {
    let english = match query.lang.as_deref() {
        Some(lang) => lang == "en",
        None => headers
            .get(header::ACCEPT_LANGUAGE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.trim_start().to_lowercase().starts_with("en")),
    };
    let (lang, title, body) =
        if english { ("en", "Cap privacy", EN) } else { ("fr", "Confidentialité de Cap", FR) };
    Html(format!(
        "<!doctype html><html lang=\"{lang}\"><head><meta charset=\"utf-8\">\
         <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\
         <title>{title}</title><style>{STYLE}</style></head><body>{body}</body></html>"
    ))
}
