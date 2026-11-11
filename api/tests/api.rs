//! End-to-end tests against a real PostgreSQL database (`sqlx::test` creates one per test)
//! and fake GraphHopper, Photon and Apple servers.

use std::net::SocketAddr;

use axum::{Json, Router, http::StatusCode, routing::get, routing::post};
use axum_test::TestServer;
use cap_api::{app, config::Config, state::AppState};
use jsonwebtoken::{Algorithm, EncodingKey, Header};
use serde_json::{Value, json};
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

const BUNDLE_ID: &str = "io.github.theovil1.cap";
const APPLE_KEY_PEM: &str = include_str!("fixtures/apple-test-key.pem");
const APPLE_KEY_N: &str = include_str!("fixtures/apple-test-key.n");

/// Fake upstream services. The route always goes 2 x 111.2 m north.
async fn spawn_fakes() -> String {
    let fakes = Router::new()
        .route(
            "/route",
            post(|Json(body): Json<Value>| async move {
                if body["points"][0] == body["points"][1] {
                    return (StatusCode::BAD_REQUEST, Json(json!({ "message": "Points are identical" })));
                }
                (
                    StatusCode::OK,
                    Json(json!({
                        "paths": [{ "distance": 222.4, "points": { "type": "LineString",
                            "coordinates": [[1.0, 47.0], [1.0, 47.001], [1.0, 47.002]] } }],
                        "info": { "road_data_timestamp": "2026-11-01T00:00:00Z" }
                    })),
                )
            }),
        )
        .route(
            "/api",
            get(|| async {
                Json(json!({ "features": [{
                    "geometry": { "type": "Point", "coordinates": [2.3522, 48.8566] },
                    "properties": { "name": "Paris", "postcode": "75001", "county": "Paris" }
                }] }))
            }),
        )
        .route(
            "/keys",
            get(|| async {
                Json(json!({ "keys": [{ "kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256",
                    "n": APPLE_KEY_N.trim(), "e": "AQAB" }] }))
            }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, fakes).await.unwrap() });
    url
}

async fn server(db: PgPool) -> TestServer {
    let fakes = spawn_fakes().await;
    let config = Config {
        database_url: String::new(),
        bind_addr: "127.0.0.1:0".parse().unwrap(),
        jwt_secret: "integration-test-secret-integration-test".to_owned(),
        apple_bundle_id: BUNDLE_ID.to_owned(),
        apple_keys_url: format!("{fakes}/keys"),
        graphhopper_url: fakes.clone(),
        photon_url: fakes,
        behind_proxy: false,
    };
    let app = app::router(AppState::new(db, config).unwrap());
    TestServer::builder().http_transport().build(app.into_make_service_with_connect_info::<SocketAddr>())
}

async fn register(server: &TestServer, username: &str) -> Value {
    let response = server
        .post("/auth/register")
        .json(&json!({
            "email": format!("{username}@example.com"),
            "password": "a long enough password",
            "first_name": "Théo",
            "username": username,
        }))
        .await;
    response.assert_status(StatusCode::CREATED);
    response.json()
}

fn bearer(auth: &Value) -> String {
    format!("Bearer {}", auth["access_token"].as_str().unwrap())
}

fn apple_token(sub: &str, audience: &str) -> String {
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some("test".to_owned());
    let claims = json!({ "iss": "https://appleid.apple.com", "aud": audience, "sub": sub,
        "email": "walker@privaterelay.appleid.com", "iat": now, "exp": now + 600 });
    jsonwebtoken::encode(&header, &claims, &EncodingKey::from_rsa_pem(APPLE_KEY_PEM.as_bytes()).unwrap())
        .unwrap()
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn health(db: PgPool) {
    server(db).await.get("/health").await.assert_status_ok();
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn register_login_and_profile(db: PgPool) {
    let server = server(db).await;
    let auth = register(&server, "theo").await;
    assert_eq!(auth["user"]["username"], "theo");
    assert_eq!(auth["user"]["daily_step_goal"], 7000);

    let duplicate = server
        .post("/auth/register")
        .json(&json!({ "email": "THEO@example.com", "password": "a long enough password",
            "first_name": "T", "username": "other" }))
        .await;
    duplicate.assert_status(StatusCode::CONFLICT);
    assert_eq!(duplicate.json::<Value>()["error"], "email_taken");

    server
        .post("/auth/login")
        .json(&json!({ "email": "theo@example.com", "password": "wrong password!" }))
        .await
        .assert_status_unauthorized();
    let login = server
        .post("/auth/login")
        .json(&json!({ "email": " Theo@Example.com ", "password": "a long enough password" }))
        .await;
    login.assert_status_ok();

    server.get("/me").await.assert_status_unauthorized();
    let updated = server
        .patch("/me")
        .add_header("authorization", bearer(&auth))
        .json(&json!({ "height_cm": 180, "sessions_per_week": 4 }))
        .await;
    updated.assert_status_ok();
    let profile: Value = updated.json();
    assert_eq!(profile["stride_cm"], 75); // 0.415 x 180, rounded
    assert_eq!(profile["sessions_per_week"], 4);

    server
        .patch("/me")
        .add_header("authorization", bearer(&auth))
        .json(&json!({ "sessions_per_week": 9 }))
        .await
        .assert_status_bad_request();
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn refresh_tokens_rotate_and_detect_reuse(db: PgPool) {
    let server = server(db).await;
    let auth = register(&server, "theo").await;
    let first = auth["refresh_token"].as_str().unwrap();

    let rotated = server.post("/auth/refresh").json(&json!({ "refresh_token": first })).await;
    rotated.assert_status_ok();
    let second = rotated.json::<Value>()["refresh_token"].as_str().unwrap().to_owned();
    assert_ne!(first, second);

    // Reusing the old token revokes every session of the user.
    server.post("/auth/refresh").json(&json!({ "refresh_token": first })).await.assert_status_unauthorized();
    server.post("/auth/refresh").json(&json!({ "refresh_token": second })).await.assert_status_unauthorized();
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn sign_in_with_apple(db: PgPool) {
    let server = server(db).await;
    let first = server
        .post("/auth/apple")
        .json(&json!({ "identity_token": apple_token("apple-user-1", BUNDLE_ID), "first_name": "Lilou" }))
        .await;
    first.assert_status_ok();
    let first: Value = first.json();
    assert!(first["user"]["username"].as_str().unwrap().starts_with("lilou"));

    let again = server
        .post("/auth/apple")
        .json(&json!({ "identity_token": apple_token("apple-user-1", BUNDLE_ID) }))
        .await;
    assert_eq!(again.json::<Value>()["user"]["id"], first["user"]["id"]);

    server
        .post("/auth/apple")
        .json(&json!({ "identity_token": apple_token("apple-user-1", "com.other.app") }))
        .await
        .assert_status_unauthorized();
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn geocode_maps_photon_results(db: PgPool) {
    let server = server(db).await;
    let auth = register(&server, "theo").await;
    let results: Value = server
        .get("/geocode")
        .add_query_param("q", "paris")
        .add_header("authorization", bearer(&auth))
        .await
        .json();
    assert_eq!(results[0]["name"], "Paris");
    assert_eq!(results[0]["place"]["label"], "Paris, 75001");
    assert_eq!(results[0]["place"]["lat"], 48.8566);
}

async fn create_journey(server: &TestServer, auth: &Value) -> Value {
    let response = server
        .post("/journeys")
        .add_header("authorization", bearer(auth))
        .json(&json!({
            "start": { "label": "Romorantin", "lat": 47.0, "lon": 1.0 },
            "end": { "label": "Paris", "lat": 47.002, "lon": 1.0 },
        }))
        .await;
    response.assert_status(StatusCode::CREATED);
    response.json()
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn journeys(db: PgPool) {
    let server = server(db).await;
    let auth = register(&server, "theo").await;
    let journey = create_journey(&server, &auth).await;
    let route_distance = journey["route_distance_m"].as_f64().unwrap();
    assert!((route_distance - 222.4).abs() < 0.5, "{route_distance}");
    assert_eq!(journey["status"], "active");
    assert_eq!(journey["path"].as_array().unwrap().len(), 3);

    let list: Value = server.get("/journeys").add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(list.as_array().unwrap().len(), 1);

    let other = register(&server, "lilou").await;
    server
        .get(&format!("/journeys/{}", journey["id"].as_str().unwrap()))
        .add_header("authorization", bearer(&other))
        .await
        .assert_status_not_found();

    let same_place = server
        .post("/journeys")
        .add_header("authorization", bearer(&auth))
        .json(&json!({ "start": { "label": "A", "lat": 47.0, "lon": 1.0 },
            "end": { "label": "A", "lat": 47.0, "lon": 1.0 } }))
        .await;
    same_place.assert_status(StatusCode::UNPROCESSABLE_ENTITY);
}

fn session(local_id: Uuid, distance_m: f64, duration_s: i64) -> Value {
    let ended = OffsetDateTime::now_utc();
    let started = ended - time::Duration::seconds(duration_s);
    let format = &time::format_description::well_known::Rfc3339;
    json!({
        "local_id": local_id,
        "started_at": started.format(format).unwrap(),
        "ended_at": ended.format(format).unwrap(),
        "distance_m": distance_m,
        "duration_s": duration_s,
        "steps": 140,
        "source": "treadmill",
    })
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn sessions_are_idempotent_and_move_the_pawn(db: PgPool) {
    let server = server(db).await;
    let auth = register(&server, "theo").await;
    let journey = create_journey(&server, &auth).await;
    let local_id = Uuid::now_v7();

    let first = server
        .post("/sessions")
        .add_header("authorization", bearer(&auth))
        .json(&session(local_id, 100.0, 90))
        .await;
    first.assert_status(StatusCode::CREATED);
    let first: Value = first.json();
    assert_eq!(first["allocations"][0]["journey_id"], journey["id"]);
    assert_eq!(first["allocations"][0]["total_m"], 100.0);

    // The app retries after a network failure: nothing is counted twice.
    let retry = server
        .post("/sessions")
        .add_header("authorization", bearer(&auth))
        .json(&session(local_id, 100.0, 90))
        .await;
    retry.assert_status_ok();
    let retry: Value = retry.json();
    assert_eq!(retry["created"], false);
    assert_eq!(retry["id"], first["id"]);
    assert_eq!(retry["allocations"][0]["total_m"], 100.0);

    // Too fast for a treadmill.
    server
        .post("/sessions")
        .add_header("authorization", bearer(&auth))
        .json(&session(Uuid::now_v7(), 1_000.0, 60))
        .await
        .assert_status(StatusCode::UNPROCESSABLE_ENTITY);

    // Reaching the destination: capped to the route and the solo journey is finished.
    let last: Value = server
        .post("/sessions")
        .add_header("authorization", bearer(&auth))
        .json(&session(Uuid::now_v7(), 500.0, 600))
        .await
        .json();
    let allocation = &last["allocations"][0];
    assert_eq!(allocation["arrived"], true);
    assert!(
        (allocation["total_m"].as_f64().unwrap() - journey["route_distance_m"].as_f64().unwrap()).abs()
            < 1e-6
    );

    let journeys: Value = server.get("/journeys").add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(journeys[0]["status"], "finished");
    assert!(journeys[0]["arrived_at"].is_string());

    let sessions: Value = server.get("/sessions").add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(sessions.as_array().unwrap().len(), 2);
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn delete_account(db: PgPool) {
    let server = server(db.clone()).await;
    let auth = register(&server, "theo").await;
    create_journey(&server, &auth).await;
    server
        .delete("/me")
        .add_header("authorization", bearer(&auth))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    server.get("/me").add_header("authorization", bearer(&auth)).await.assert_status_unauthorized();
    let left: i64 = sqlx::query_scalar("SELECT count(*) FROM journeys").fetch_one(&db).await.unwrap();
    assert_eq!(left, 0);
    let routes: i64 = sqlx::query_scalar("SELECT count(*) FROM routes").fetch_one(&db).await.unwrap();
    assert_eq!(routes, 0, "routes keep the addresses typed by the user");
}
