use std::time::Duration;

use axum::{Json, Router, extract::State, http::StatusCode, routing::get};
use tower_governor::{
    GovernorLayer,
    governor::GovernorConfigBuilder,
    key_extractor::{KeyExtractor, PeerIpKeyExtractor, SmartIpKeyExtractor},
};
use tower_http::{timeout::TimeoutLayer, trace::TraceLayer};
use utoipa::{
    Modify, OpenApi,
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
};
use utoipa_axum::router::OpenApiRouter;
use utoipa_scalar::{Scalar, Servable};

use crate::{
    account, auth, badges, events, feed, friends, geo, history, journeys, leaderboards, live, profiles,
    public_routes, races, sessions, state::AppState, users,
};

#[derive(OpenApi)]
#[openapi(
    info(title = "Cap API", description = "Accounts, routes, journeys and treadmill sessions for Cap."),
    modifiers(&BearerAuth),
    tags(
        (name = "auth", description = "Accounts and tokens"),
        (name = "users", description = "Current user"),
        (name = "geo", description = "Geocoding"),
        (name = "friends", description = "Friends and invite links"),
        (name = "leaderboards", description = "Rankings between friends"),
        (name = "journeys", description = "Routes and journeys"),
        (name = "public routes", description = "Routes shared with the community, their photos and reports"),
        (name = "events", description = "Scheduled journeys: sign up, common start, live standings"),
        (name = "profiles", description = "Public profiles and following"),
        (name = "feed", description = "Activity feed: posts, Bravos, comments"),
        (name = "badges", description = "Profile badges given by admins"),
        (name = "races", description = "Races between friends (live positions on the /live WebSocket)"),
        (name = "sessions", description = "Treadmill sessions"),
    )
)]
struct ApiDoc;

struct BearerAuth;

impl Modify for BearerAuth {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);
        components.add_security_scheme(
            "bearer",
            SecurityScheme::Http(
                HttpBuilder::new().scheme(HttpAuthScheme::Bearer).bearer_format("JWT").build(),
            ),
        );
    }
}

pub fn openapi() -> utoipa::openapi::OpenApi {
    api_router().split_for_parts().1
}

fn api_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::with_openapi(ApiDoc::openapi())
        .merge(auth::router())
        .merge(users::router())
        .merge(account::router())
        .merge(friends::router())
        .merge(leaderboards::router())
        .merge(geo::router())
        .merge(journeys::router())
        .merge(public_routes::router())
        .merge(events::router())
        .merge(profiles::router())
        .merge(feed::router())
        .merge(badges::router())
        .merge(races::router())
        .merge(sessions::router())
        .merge(history::router())
}

/// Builds the full HTTP application.
pub fn router(state: AppState) -> Router {
    let (api, openapi) = api_router().split_for_parts();
    let api = if state.config.behind_proxy {
        rate_limited(api, SmartIpKeyExtractor)
    } else {
        rate_limited(api, PeerIpKeyExtractor)
    };
    Router::new()
        .route("/health", get(health))
        .route("/invite/{code}", get(friends::invite_page))
        .route("/live", get(live::live_socket))
        .route("/avatars/{user_id}", get(account::get_avatar))
        .route("/public-routes/{id}/photos/{kind}", get(public_routes::get_photo))
        .merge(api)
        .merge(Scalar::with_url("/docs", openapi.clone()))
        .route("/openapi.json", get(move || async move { Json(openapi) }))
        .layer(TraceLayer::new_for_http())
        .layer(TimeoutLayer::with_status_code(StatusCode::REQUEST_TIMEOUT, Duration::from_secs(60)))
        .with_state(state)
}

/// About 2 requests per second per IP, with bursts of 30.
fn rate_limited<K>(router: axum::Router<AppState>, key: K) -> axum::Router<AppState>
where
    K: KeyExtractor + Send + Sync + 'static,
    K::Key: Send + Sync,
{
    let config = GovernorConfigBuilder::default()
        .per_millisecond(500)
        .burst_size(30)
        .key_extractor(key)
        .finish()
        .expect("valid rate limit configuration");
    router.layer(GovernorLayer::new(config))
}

async fn health(State(state): State<AppState>) -> (StatusCode, &'static str) {
    match sqlx::query_scalar!("SELECT 1 AS \"one!\"").fetch_one(&state.db).await {
        Ok(_) => (StatusCode::OK, "ok"),
        Err(_) => (StatusCode::SERVICE_UNAVAILABLE, "database unavailable"),
    }
}
