use std::net::SocketAddr;

use anyhow::{Context, bail};

/// Runtime configuration, read from environment variables (see `.env.example`).
#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: SocketAddr,
    pub jwt_secret: String,
    pub apple_bundle_id: String,
    pub apple_keys_url: String,
    pub graphhopper_url: String,
    pub photon_url: String,
    /// Read the client IP from `X-Forwarded-For` (only behind a trusted reverse proxy).
    pub behind_proxy: bool,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let jwt_secret = var("JWT_SECRET")?;
        if jwt_secret.len() < 32 {
            bail!("JWT_SECRET must be at least 32 characters long");
        }
        Ok(Self {
            database_url: var("DATABASE_URL")?,
            bind_addr: var_or("BIND_ADDR", "0.0.0.0:8080")
                .parse()
                .context("BIND_ADDR is not a valid socket address")?,
            jwt_secret,
            apple_bundle_id: var_or("APPLE_BUNDLE_ID", "io.github.theovil1.cap"),
            apple_keys_url: var_or("APPLE_KEYS_URL", "https://appleid.apple.com/auth/keys"),
            graphhopper_url: var_or("GRAPHHOPPER_URL", "http://graphhopper:8989"),
            photon_url: var_or("PHOTON_URL", "http://photon:2322"),
            behind_proxy: var_or("BEHIND_PROXY", "false") == "true",
        })
    }
}

fn var(name: &str) -> anyhow::Result<String> {
    std::env::var(name).with_context(|| format!("missing environment variable {name}"))
}

fn var_or(name: &str, default: &str) -> String {
    std::env::var(name).unwrap_or_else(|_| default.to_owned())
}
