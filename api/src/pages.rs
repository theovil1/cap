//! Web pages linked from the app and the App Store listing: privacy and help.

use axum::{
    extract::Query,
    http::{HeaderMap, header},
    response::Html,
};
use serde::Deserialize;

const STYLE: &str = include_str!("../pages/page.css");

#[derive(Deserialize)]
pub struct Lang {
    lang: Option<String>,
}

/// `/privacy`: the privacy policy.
pub async fn privacy_page(query: Query<Lang>, headers: HeaderMap) -> Html<String> {
    page(
        &query,
        &headers,
        ("Confidentialité de Tapiroute", include_str!("../pages/privacy.fr.html")),
        ("Tapiroute privacy", include_str!("../pages/privacy.en.html")),
    )
}

/// `/support`: help for walkers.
pub async fn support_page(query: Query<Lang>, headers: HeaderMap) -> Html<String> {
    page(
        &query,
        &headers,
        ("Aide de Tapiroute", include_str!("../pages/support.fr.html")),
        ("Tapiroute help", include_str!("../pages/support.en.html")),
    )
}

/// French unless `?lang=en` or the browser prefers English.
fn page(query: &Lang, headers: &HeaderMap, fr: (&str, &str), en: (&str, &str)) -> Html<String> {
    let english = match query.lang.as_deref() {
        Some(lang) => lang == "en",
        None => headers
            .get(header::ACCEPT_LANGUAGE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.trim_start().to_lowercase().starts_with("en")),
    };
    let (lang, (title, body)) = if english { ("en", en) } else { ("fr", fr) };
    Html(format!(
        "<!doctype html><html lang=\"{lang}\"><head><meta charset=\"utf-8\">\
         <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\
         <title>{title}</title><style>{STYLE}</style></head><body>{body}</body></html>"
    ))
}
