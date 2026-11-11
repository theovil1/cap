use argon2::{
    Argon2,
    password_hash::{PasswordHasher, PasswordVerifier, phc::PasswordHash},
};

pub const MIN_LENGTH: usize = 10;

/// Hashes a password with Argon2id (default parameters) and a random salt.
pub fn hash(password: &str) -> anyhow::Result<String> {
    Argon2::default()
        .hash_password(password.as_bytes())
        .map(|hash| hash.to_string())
        .map_err(|e| anyhow::anyhow!("password hashing failed: {e}"))
}

/// Constant-time check of a password against a stored PHC string.
pub fn verify(password: &str, stored: &str) -> bool {
    PasswordHash::new(stored)
        .is_ok_and(|parsed| Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_and_verifies() {
        let stored = hash("correct horse battery").unwrap();
        assert!(stored.starts_with("$argon2id$"));
        assert!(verify("correct horse battery", &stored));
        assert!(!verify("wrong password", &stored));
        assert!(!verify("anything", "not a hash"));
    }
}
