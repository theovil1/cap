use std::fmt::Write;

use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

pub const ACCESS_TTL: Duration = Duration::minutes(15);
pub const REFRESH_TTL: Duration = Duration::days(60);
const ISSUER: &str = "cap-api";

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub iat: i64,
    pub exp: i64,
    pub iss: String,
}

/// Short-lived HS256 access token.
pub fn issue_access(secret: &str, user_id: Uuid) -> anyhow::Result<String> {
    let now = OffsetDateTime::now_utc();
    let claims = Claims {
        sub: user_id,
        iat: now.unix_timestamp(),
        exp: (now + ACCESS_TTL).unix_timestamp(),
        iss: ISSUER.to_owned(),
    };
    Ok(encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))?)
}

pub fn verify_access(secret: &str, token: &str) -> Option<Uuid> {
    let mut validation = Validation::default();
    validation.set_issuer(&[ISSUER]);
    decode::<Claims>(token, &DecodingKey::from_secret(secret.as_bytes()), &validation)
        .ok()
        .map(|data| data.claims.sub)
}

/// Opaque refresh token (256 random bits). Only its SHA-256 hash is stored.
pub fn new_refresh() -> String {
    let mut bytes = [0u8; 32];
    rand::fill(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

pub fn hash_refresh(token: &str) -> String {
    Sha256::digest(token.as_bytes()).iter().fold(String::with_capacity(64), |mut hex, b| {
        let _ = write!(hex, "{b:02x}");
        hex
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test-secret-test-secret-test-secret";

    #[test]
    fn access_token_round_trip() {
        let id = Uuid::now_v7();
        let token = issue_access(SECRET, id).unwrap();
        assert_eq!(verify_access(SECRET, &token), Some(id));
        assert_eq!(verify_access("another-secret-another-secret-xx", &token), None);
        assert_eq!(verify_access(SECRET, "garbage"), None);
    }

    #[test]
    fn refresh_tokens_are_random_and_hashed() {
        let a = new_refresh();
        assert_ne!(a, new_refresh());
        assert_eq!(hash_refresh(&a).len(), 64);
        assert_eq!(hash_refresh(&a), hash_refresh(&a));
    }
}
