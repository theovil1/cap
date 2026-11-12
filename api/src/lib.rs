//! Cap API: accounts, routes, journeys and treadmill sessions.

pub mod account;
pub mod app;
pub mod auth;
pub mod config;
pub mod error;
pub mod friends;
pub mod geo;
pub mod history;
pub mod journeys;
pub mod leaderboards;
pub mod live;
pub mod public_routes;
pub mod races;
pub mod sessions;
pub mod stages;
pub mod state;
pub mod users;

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!();
