use std::sync::Arc;

use sqlx::PgPool;

use crate::{auth::apple::AppleKeys, config::Config, live::LiveHub, push::Apns};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub http: reqwest::Client,
    pub apple_keys: Arc<AppleKeys>,
    /// Walkers on a live race right now.
    pub live: Arc<LiveHub>,
    /// Apple's push service, when the server has a key.
    pub apns: Option<Arc<Apns>>,
}

impl AppState {
    pub fn new(db: PgPool, config: Config) -> anyhow::Result<Self> {
        let http = reqwest::Client::builder()
            .user_agent(concat!("cap-api/", env!("CARGO_PKG_VERSION")))
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        let apple_keys = Arc::new(AppleKeys::new(config.apple_keys_url.clone()));
        let apns = apns(&config).map(Arc::new);
        Ok(Self { db, config: Arc::new(config), http, apple_keys, live: Arc::default(), apns })
    }
}

/// The push client, or none (with the reason in the logs) when the key is missing.
fn apns(config: &Config) -> Option<Apns> {
    let (Some(key_id), Some(team_id)) = (config.apns_key_id.clone(), config.apns_team_id.clone()) else {
        tracing::info!("push notifications off: APNS_KEY_ID and APNS_TEAM_ID are not set");
        return None;
    };
    let pem = match std::fs::read(&config.apns_key_file) {
        Ok(pem) => pem,
        Err(error) => {
            tracing::warn!(%error, file = config.apns_key_file, "push notifications off: cannot read the key");
            return None;
        }
    };
    match Apns::new(&pem, key_id, team_id, config.apple_bundle_id.clone()) {
        Ok(apns) => Some(apns),
        Err(error) => {
            tracing::warn!(%error, "push notifications off: invalid key");
            None
        }
    }
}
