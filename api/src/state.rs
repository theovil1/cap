use std::sync::Arc;

use sqlx::PgPool;

use crate::{auth::apple::AppleKeys, config::Config, live::LiveHub};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub http: reqwest::Client,
    pub apple_keys: Arc<AppleKeys>,
    /// Walkers on a live race right now.
    pub live: Arc<LiveHub>,
}

impl AppState {
    pub fn new(db: PgPool, config: Config) -> anyhow::Result<Self> {
        let http = reqwest::Client::builder()
            .user_agent(concat!("cap-api/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        let apple_keys = Arc::new(AppleKeys::new(config.apple_keys_url.clone()));
        Ok(Self { db, config: Arc::new(config), http, apple_keys, live: Arc::default() })
    }
}
