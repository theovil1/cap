//! Verification of "Sign in with Apple" identity tokens against Apple's public keys.

use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header};
use serde::Deserialize;
use time::{Duration, OffsetDateTime};
use tokio::sync::RwLock;

const APPLE_ISSUER: &str = "https://appleid.apple.com";
const KEYS_TTL: Duration = Duration::hours(6);

#[derive(Debug, Deserialize)]
pub struct AppleClaims {
    /// Stable user identifier for this app.
    pub sub: String,
    pub email: Option<String>,
}

#[derive(Clone, Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
}

#[derive(Deserialize)]
struct Jwks {
    keys: Vec<Jwk>,
}

/// Caches Apple's JWKS and refreshes it when stale or when an unknown key id shows up.
pub struct AppleKeys {
    url: String,
    cache: RwLock<Option<(OffsetDateTime, Vec<Jwk>)>>,
}

impl AppleKeys {
    pub fn new(url: String) -> Self {
        Self { url, cache: RwLock::new(None) }
    }

    pub async fn verify(
        &self,
        http: &reqwest::Client,
        token: &str,
        audience: &str,
    ) -> anyhow::Result<AppleClaims> {
        let kid = decode_header(token)?.kid.ok_or_else(|| anyhow::anyhow!("token has no kid"))?;
        let jwk = if let Some(jwk) = self.cached(&kid).await {
            jwk
        } else {
            self.refresh(http).await?;
            self.cached(&kid).await.ok_or_else(|| anyhow::anyhow!("unknown Apple key {kid}"))?
        };
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[audience]);
        validation.set_issuer(&[APPLE_ISSUER]);
        let key = DecodingKey::from_rsa_components(&jwk.n, &jwk.e)?;
        Ok(decode::<AppleClaims>(token, &key, &validation)?.claims)
    }

    async fn cached(&self, kid: &str) -> Option<Jwk> {
        let cache = self.cache.read().await;
        let (fetched_at, keys) = cache.as_ref()?;
        if OffsetDateTime::now_utc() - *fetched_at > KEYS_TTL {
            return None;
        }
        keys.iter().find(|k| k.kid == kid).cloned()
    }

    async fn refresh(&self, http: &reqwest::Client) -> anyhow::Result<()> {
        let jwks: Jwks = http.get(&self.url).send().await?.error_for_status()?.json().await?;
        *self.cache.write().await = Some((OffsetDateTime::now_utc(), jwks.keys));
        Ok(())
    }
}
