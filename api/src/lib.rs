//! Cap API: accounts, routes, journeys and treadmill sessions.

pub mod app;
pub mod auth;
pub mod config;
pub mod error;
pub mod geo;
pub mod journeys;
pub mod sessions;
pub mod state;
pub mod users;

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!();
