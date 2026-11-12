//! End-to-end tests against a real PostgreSQL database (`sqlx::test` creates one per test)
//! and fake GraphHopper, Photon and Apple servers.

use std::net::SocketAddr;

use axum::{Json, Router, extract::Query, http::StatusCode, routing::get, routing::post};
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
            "/reverse",
            // Romorantin for the southern half of the fake route, Paris for the rest.
            get(|Query(q): Query<std::collections::HashMap<String, String>>| async move {
                let lat: f64 = q["lat"].parse().unwrap();
                let (name, county, lat) = if lat < 47.001 {
                    ("Romorantin", "Loir-et-Cher", 47.0)
                } else {
                    ("Paris", "Paris", 47.002)
                };
                Json(json!({ "features": [{
                    "geometry": { "type": "Point", "coordinates": [1.0, lat] },
                    "properties": { "name": name, "county": county, "osm_value": "town" }
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

    let picked: Value = server
        .get("/reverse")
        .add_query_param("lat", 47.0001)
        .add_query_param("lon", 1.0)
        .add_header("authorization", bearer(&auth))
        .await
        .json();
    assert_eq!(picked["name"], "Romorantin");
    assert_eq!(picked["place"]["lat"], 47.0001);
}

async fn create_route(server: &TestServer, auth: &Value) -> Value {
    let response = server
        .post("/routes")
        .add_header("authorization", bearer(auth))
        .json(&json!({
            "start": { "label": "Romorantin", "lat": 47.0, "lon": 1.0 },
            "end": { "label": "Paris", "lat": 47.002, "lon": 1.0 },
        }))
        .await;
    response.assert_status(StatusCode::CREATED);
    response.json()
}

async fn create_journey(server: &TestServer, auth: &Value) -> Value {
    let route = create_route(server, auth).await;
    let response = server
        .post("/journeys")
        .add_header("authorization", bearer(auth))
        .json(&json!({ "route_id": route["id"] }))
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
    let stages = journey["stages"].as_array().unwrap();
    assert_eq!(stages.len(), 2);
    assert_eq!(stages[0]["name"], "Romorantin");
    assert_eq!(stages[1]["name"], "Paris");
    assert_eq!(stages[1]["county"], "Paris");
    assert_eq!(journey["start_town"], "Romorantin");
    assert_eq!(journey["end_town"], "Paris");
    assert!(stages[1]["unlocked_at"].is_null());

    let list: Value = server.get("/journeys").add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(list.as_array().unwrap().len(), 1);
    assert_eq!(list[0]["start_town"], "Romorantin");

    let other = register(&server, "lilou").await;
    // A route can only be started by the walker who computed it.
    server
        .post("/journeys")
        .add_header("authorization", bearer(&other))
        .json(&json!({ "route_id": journey["route_id"] }))
        .await
        .assert_status_not_found();
    server
        .get(&format!("/journeys/{}", journey["id"].as_str().unwrap()))
        .add_header("authorization", bearer(&other))
        .await
        .assert_status_not_found();

    let same_place = server
        .post("/routes")
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
    assert_eq!(first["allocations"][0]["unlocked_stages"].as_array().unwrap().len(), 0);

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
    assert_eq!(allocation["unlocked_stages"][0]["name"], "Paris");
    assert!(
        (allocation["total_m"].as_f64().unwrap() - journey["route_distance_m"].as_f64().unwrap()).abs()
            < 1e-6
    );

    let detail: Value = server
        .get(&format!("/journeys/{}", journey["id"].as_str().unwrap()))
        .add_header("authorization", bearer(&auth))
        .await
        .json();
    assert!(detail["stages"][0]["unlocked_at"].is_null(), "the start is never unlocked");
    assert!(detail["stages"][1]["unlocked_at"].is_string());
    assert_eq!(detail["sessions"], 2, "the retry and the refused session do not count");

    let journeys: Value = server.get("/journeys").add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(journeys[0]["status"], "finished");
    assert!(journeys[0]["arrived_at"].is_string());

    let sessions: Value = server.get("/sessions").add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(sessions.as_array().unwrap().len(), 2);
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn journeys_can_be_reset_and_deleted(db: PgPool) {
    let server = server(db).await;
    let auth = register(&server, "theo").await;
    let journey = create_journey(&server, &auth).await;
    let url = format!("/journeys/{}", journey["id"].as_str().unwrap());
    server
        .post("/sessions")
        .add_header("authorization", bearer(&auth))
        .json(&session(Uuid::now_v7(), 500.0, 600))
        .await
        .assert_status(StatusCode::CREATED);

    // Only its walker can reset or delete a journey.
    let other = register(&server, "lilou").await;
    server
        .post(&format!("{url}/reset"))
        .add_header("authorization", bearer(&other))
        .await
        .assert_status_not_found();
    server.delete(&url).add_header("authorization", bearer(&other)).await.assert_status_not_found();

    // Reset: back to the start, active again, stages locked, the session kept.
    let reset = server.post(&format!("{url}/reset")).add_header("authorization", bearer(&auth)).await;
    reset.assert_status_ok();
    let reset: Value = reset.json();
    assert_eq!(reset["status"], "active");
    assert_eq!(reset["distance_m"], 0.0);
    assert!(reset["arrived_at"].is_null());
    assert!(reset["stages"][1]["unlocked_at"].is_null());
    let sessions: Value = server.get("/sessions").add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(sessions.as_array().unwrap().len(), 1);

    // The next session counts again from the start.
    let next: Value = server
        .post("/sessions")
        .add_header("authorization", bearer(&auth))
        .json(&session(Uuid::now_v7(), 100.0, 90))
        .await
        .json();
    assert_eq!(next["allocations"][0]["total_m"], 100.0);

    // Delete: gone from the list, the sessions stay.
    server
        .delete(&url)
        .add_header("authorization", bearer(&auth))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    server.get(&url).add_header("authorization", bearer(&auth)).await.assert_status_not_found();
    let list: Value = server.get("/journeys").add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(list.as_array().unwrap().len(), 0);
    let sessions: Value = server.get("/sessions").add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(sessions.as_array().unwrap().len(), 2);
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn friends_by_username_and_invite_link(db: PgPool) {
    let server = server(db).await;
    let theo = register(&server, "theo").await;
    let lilou = register(&server, "lilou").await;
    let max = register(&server, "max").await;
    let lilou_id = lilou["user"]["id"].as_str().unwrap();

    // Search by the start of a username shows how each user relates to you.
    let found: Value = server
        .get("/users/search")
        .add_query_param("q", "@LIL")
        .add_header("authorization", bearer(&theo))
        .await
        .json();
    assert_eq!(found[0]["username"], "lilou");
    assert_eq!(found[0]["relation"], "none");

    // A request by username waits for an answer.
    let sent: Value = server
        .post("/friends")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "username": "lilou" }))
        .await
        .json();
    assert_eq!(sent["status"], "pending");
    let mine: Value = server.get("/friends").add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(mine["outgoing"][0]["username"], "lilou");
    let hers: Value = server.get("/friends").add_header("authorization", bearer(&lilou)).await.json();
    assert_eq!(hers["incoming"][0]["username"], "theo");

    // Accepting turns it into a friendship on both sides.
    let theo_id = theo["user"]["id"].as_str().unwrap();
    server
        .post(&format!("/friends/{theo_id}/accept"))
        .add_header("authorization", bearer(&lilou))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    let mine: Value = server.get("/friends").add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(mine["friends"][0]["username"], "lilou");
    assert_eq!(mine["outgoing"].as_array().unwrap().len(), 0);
    let found: Value = server
        .get("/users/search")
        .add_query_param("q", "lil")
        .add_header("authorization", bearer(&theo))
        .await
        .json();
    assert_eq!(found[0]["relation"], "friend");

    // Nobody befriends themselves or an unknown user.
    server
        .post("/friends")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "username": "theo" }))
        .await
        .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    server
        .post("/friends")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "username": "nobody" }))
        .await
        .assert_status_not_found();

    // The invite link makes friends at once, and its page names the inviter.
    let code: Value = server.get("/friends/invite").add_header("authorization", bearer(&theo)).await.json();
    let code = code["code"].as_str().unwrap();
    let again: Value = server.get("/friends/invite").add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(again["code"], code, "the link stays the same");
    let page = server.get(&format!("/invite/{code}")).await;
    page.assert_status_ok();
    assert!(page.text().contains(&format!("cap://invite/{code}")));
    server.get("/invite/unknown").await.assert_status_not_found();
    let joined: Value = server
        .post("/friends")
        .add_header("authorization", bearer(&max))
        .json(&json!({ "invite_code": code }))
        .await
        .json();
    assert_eq!(joined["status"], "accepted");
    let mine: Value = server.get("/friends").add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(mine["friends"].as_array().unwrap().len(), 2);

    // Removing works from either side.
    server
        .delete(&format!("/friends/{lilou_id}"))
        .add_header("authorization", bearer(&theo))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    let hers: Value = server.get("/friends").add_header("authorization", bearer(&lilou)).await.json();
    assert_eq!(hers["friends"].as_array().unwrap().len(), 0);
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn leaderboards_rank_friends(db: PgPool) {
    let server = server(db).await;
    let theo = register(&server, "theo").await;
    let lilou = register(&server, "lilou").await;
    let max = register(&server, "max").await;
    let code: Value = server.get("/friends/invite").add_header("authorization", bearer(&theo)).await.json();
    server
        .post("/friends")
        .add_header("authorization", bearer(&lilou))
        .json(&json!({ "invite_code": code["code"] }))
        .await
        .assert_status_ok();
    for (auth, metres) in [(&theo, 300.0), (&lilou, 500.0), (&max, 900.0)] {
        server
            .post("/sessions")
            .add_header("authorization", bearer(auth))
            .json(&session(Uuid::now_v7(), metres, 600))
            .await
            .assert_status(StatusCode::CREATED);
    }

    for period in ["week", "month"] {
        let board: Value = server
            .get("/leaderboards")
            .add_query_param("period", period)
            .add_header("authorization", bearer(&theo))
            .await
            .json();
        // Max is not a friend: only Lilou and Théo are ranked.
        let entries = board["entries"].as_array().unwrap();
        assert_eq!(entries.len(), 2, "{period}");
        assert_eq!(entries[0]["username"], "lilou");
        assert_eq!(entries[0]["rank"], 1);
        assert_eq!(entries[0]["value"], 500.0);
        assert_eq!(entries[1]["me"], true);
        assert_eq!(entries[1]["rank"], 2);
        assert!(board["starts_on"].as_str().unwrap() <= board["ends_on"].as_str().unwrap());
    }

    let streak: Value = server
        .get("/leaderboards")
        .add_query_param("period", "streak")
        .add_header("authorization", bearer(&theo))
        .await
        .json();
    assert_eq!(streak["entries"][0]["value"], 1.0);
    assert_eq!(streak["entries"][0]["rank"], 1);
    assert_eq!(streak["entries"][1]["rank"], 1, "ties share a rank");
    assert_eq!(streak["entries"][0]["best"], 1);

    server
        .get("/leaderboards")
        .add_query_param("period", "year")
        .add_header("authorization", bearer(&theo))
        .await
        .assert_status(StatusCode::BAD_REQUEST);
}

/// A session that starts `offset_s` seconds from now (after a race start).
fn session_from_now(offset_s: i64, distance_m: f64, duration_s: i64) -> Value {
    let started = OffsetDateTime::now_utc() + time::Duration::seconds(offset_s);
    let ended = started + time::Duration::seconds(duration_s);
    let format = &time::format_description::well_known::Rfc3339;
    json!({
        "local_id": Uuid::now_v7(),
        "started_at": started.format(format).unwrap(),
        "ended_at": ended.format(format).unwrap(),
        "distance_m": distance_m,
        "duration_s": duration_s,
        "steps": 0,
        "source": "treadmill",
    })
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn races_from_invitation_to_finish(db: PgPool) {
    let server = server(db).await;
    let theo = register(&server, "theo").await;
    let lilou = register(&server, "lilou").await;
    let max = register(&server, "max").await;
    let code: Value = server.get("/friends/invite").add_header("authorization", bearer(&theo)).await.json();
    server
        .post("/friends")
        .add_header("authorization", bearer(&lilou))
        .json(&json!({ "invite_code": code["code"] }))
        .await
        .assert_status_ok();
    let lilou_id = lilou["user"]["id"].as_str().unwrap();
    let theo_id = theo["user"]["id"].as_str().unwrap();
    let route = create_route(&server, &theo).await;

    // Only friends can be invited.
    server
        .post("/races")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "route_id": route["id"], "friend_ids": [max["user"]["id"]] }))
        .await
        .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    let race = server
        .post("/races")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "route_id": route["id"], "friend_ids": [lilou_id] }))
        .await;
    race.assert_status(StatusCode::CREATED);
    let race: Value = race.json();
    let url = format!("/journeys/{}", race["id"].as_str().unwrap());
    assert_eq!(race["kind"], "race");
    assert_eq!(race["status"], "waiting");
    assert_eq!(race["participants"].as_array().unwrap().len(), 2);

    // Lilou sees the invitation; nobody can start alone.
    let list: Value = server.get("/journeys").add_header("authorization", bearer(&lilou)).await.json();
    assert_eq!(list[0]["joined"], false);
    assert_eq!(list[0]["mine"], false);
    server
        .post(&format!("{url}/start"))
        .add_header("authorization", bearer(&theo))
        .await
        .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    server.post(&format!("{url}/join")).add_header("authorization", bearer(&lilou)).await.assert_status_ok();
    let started = server.post(&format!("{url}/start")).add_header("authorization", bearer(&theo)).await;
    started.assert_status_ok();
    let started: Value = started.json();
    assert_eq!(started["status"], "active");
    assert_eq!(started["players"], 2);

    // A session from before the start does not count.
    let early: Value = server
        .post("/sessions")
        .add_header("authorization", bearer(&theo))
        .json(&session(Uuid::now_v7(), 100.0, 90))
        .await
        .json();
    assert_eq!(early["allocations"].as_array().unwrap().len(), 0);

    // Live: Théo walks, Lilou sees his pawn move.
    let mut lilou_live = server
        .get_websocket("/live")
        .add_header("authorization", bearer(&lilou))
        .await
        .into_websocket()
        .await;
    let mut theo_live =
        server.get_websocket("/live").add_header("authorization", bearer(&theo)).await.into_websocket().await;
    let now = OffsetDateTime::now_utc().format(&time::format_description::well_known::Rfc3339).unwrap();
    theo_live
        .send_json(&json!({ "type": "progress", "started_at": now, "session_m": 50.0, "speed_kmh": 4.8 }))
        .await;
    let seen: Value = lilou_live.receive_json().await;
    assert_eq!(seen["type"], "position");
    assert_eq!(seen["user_id"], theo_id);
    assert_eq!(seen["distance_m"], 50.0);
    let detail: Value = server.get(&url).add_header("authorization", bearer(&lilou)).await.json();
    let theo_row =
        detail["participants"].as_array().unwrap().iter().find(|p| p["user_id"] == theo_id).unwrap();
    assert_eq!(theo_row["live"]["distance_m"], 50.0);
    theo_live.send_json(&json!({ "type": "stop" })).await;
    let stop: Value = lilou_live.receive_json().await;
    assert_eq!(stop["type"], "stop");

    // Théo arrives first; the race ends when Lilou leaves.
    let arrival: Value = server
        .post("/sessions")
        .add_header("authorization", bearer(&theo))
        .json(&session_from_now(1, 300.0, 300))
        .await
        .json();
    assert_eq!(arrival["allocations"][0]["arrived"], true);
    let detail: Value = server.get(&url).add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(detail["rank"], 1);
    assert_eq!(detail["status"], "active");
    server.delete(&url).add_header("authorization", bearer(&theo)).await.assert_status_not_found();
    server
        .post(&format!("{url}/leave"))
        .add_header("authorization", bearer(&lilou))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    let detail: Value = server.get(&url).add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(detail["status"], "finished");
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn account_settings_photo_and_export(db: PgPool) {
    let server = server(db).await;
    let theo = register(&server, "theo").await;
    register(&server, "lilou").await;
    let theo_id = theo["user"]["id"].as_str().unwrap();

    let me: Value = server
        .patch("/me")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "app_color": "green", "map_mood": "night", "units": "mi", "notifications": false,
            "visibility": "friends", "country": "be", "email": "Theo@Exemple.fr" }))
        .await
        .json();
    assert_eq!(me["app_color"], "green");
    assert_eq!(me["map_mood"], "night");
    assert_eq!(me["units"], "mi");
    assert_eq!(me["notifications"], false);
    assert_eq!(me["country"], "BE");
    assert_eq!(me["email"], "theo@exemple.fr");
    for bad in [json!({ "app_color": "black" }), json!({ "country": "France" }), json!({ "email": "nope" })] {
        server
            .patch("/me")
            .add_header("authorization", bearer(&theo))
            .json(&bad)
            .await
            .assert_status_bad_request();
    }
    server
        .patch("/me")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "email": "lilou@example.com" }))
        .await
        .assert_status(StatusCode::CONFLICT);

    // A private profile is found by its exact username only.
    let lilou = server
        .post("/auth/login")
        .json(&json!({ "email": "lilou@example.com", "password": "a long enough password" }))
        .await;
    let lilou: Value = lilou.json();
    let prefix: Value = server
        .get("/users/search")
        .add_query_param("q", "the")
        .add_header("authorization", bearer(&lilou))
        .await
        .json();
    assert_eq!(prefix.as_array().unwrap().len(), 0);
    let exact: Value = server
        .get("/users/search")
        .add_query_param("q", "theo")
        .add_header("authorization", bearer(&lilou))
        .await
        .json();
    assert_eq!(exact[0]["username"], "theo");

    // Photo: stored, served with its type, then removed.
    let jpeg = vec![0xFF, 0xD8, 0xFF, 0xE0, 0, 16, b'J', b'F', b'I', b'F'];
    let me: Value = server
        .put("/me/avatar")
        .add_header("authorization", bearer(&theo))
        .content_type("image/jpeg")
        .bytes(jpeg.clone().into())
        .await
        .json();
    let url = me["avatar_url"].as_str().unwrap();
    assert!(url.starts_with(&format!("/avatars/{theo_id}?v=")));
    let photo = server.get(&format!("/avatars/{theo_id}")).await;
    photo.assert_status_ok();
    assert_eq!(photo.header("content-type"), "image/jpeg");
    assert_eq!(photo.as_bytes().to_vec(), jpeg);
    server
        .put("/me/avatar")
        .add_header("authorization", bearer(&theo))
        .content_type("image/jpeg")
        .bytes(b"not an image".to_vec().into())
        .await
        .assert_status_bad_request();
    let me: Value = server.delete("/me/avatar").add_header("authorization", bearer(&theo)).await.json();
    assert!(me["avatar_url"].is_null());
    server.get(&format!("/avatars/{theo_id}")).await.assert_status_not_found();

    // Export: the profile and every session.
    server
        .post("/sessions")
        .add_header("authorization", bearer(&theo))
        .json(&session(Uuid::now_v7(), 300.0, 300))
        .await
        .assert_status(StatusCode::CREATED);
    let export: Value = server.get("/me/export").add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(export["profile"]["username"], "theo");
    assert_eq!(export["sessions"].as_array().unwrap().len(), 1);
    assert_eq!(export["journeys"].as_array().unwrap().len(), 0);
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn deleting_sessions_moves_journeys_back(db: PgPool) {
    let server = server(db).await;
    let auth = register(&server, "theo").await;
    let other = register(&server, "lilou").await;
    let journey = create_journey(&server, &auth).await;
    let url = format!("/journeys/{}", journey["id"].as_str().unwrap());
    let (first, last) = (Uuid::now_v7(), Uuid::now_v7());
    for (id, metres) in [(first, 100.0), (last, 500.0)] {
        server
            .post("/sessions")
            .add_header("authorization", bearer(&auth))
            .json(&session(id, metres, 600))
            .await
            .assert_status(StatusCode::CREATED);
    }
    let detail: Value = server.get(&url).add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(detail["status"], "finished");

    // Only its walker deletes a session.
    server
        .delete(&format!("/sessions/{last}"))
        .add_header("authorization", bearer(&other))
        .await
        .assert_status_not_found();
    server
        .delete(&format!("/sessions/{last}"))
        .add_header("authorization", bearer(&auth))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    let detail: Value = server.get(&url).add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(detail["status"], "active");
    assert_eq!(detail["distance_m"], 100.0);
    assert!(detail["arrived_at"].is_null());
    assert!(detail["stages"][1]["unlocked_at"].is_null(), "Paris is locked again");

    server
        .delete("/sessions")
        .add_header("authorization", bearer(&auth))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    let detail: Value = server.get(&url).add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(detail["distance_m"], 0.0);
    let sessions: Value = server.get("/sessions").add_header("authorization", bearer(&auth)).await.json();
    assert_eq!(sessions.as_array().unwrap().len(), 0);
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

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn public_routes_from_publication_to_reports(db: PgPool) {
    let server = server(db.clone()).await;
    let theo = register(&server, "theo").await;
    let lilou = register(&server, "lilou").await;
    let route = create_route(&server, &theo).await;

    // Only a route of one's own, with a title.
    server
        .post("/public-routes")
        .add_header("authorization", bearer(&lilou))
        .json(&json!({ "route_id": route["id"], "title": "La Sologne" }))
        .await
        .assert_status(StatusCode::NOT_FOUND);
    server
        .post("/public-routes")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "route_id": route["id"], "title": "x" }))
        .await
        .assert_status(StatusCode::BAD_REQUEST);
    let published = server
        .post("/public-routes")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "route_id": route["id"], "title": "De la Sologne à Paris",
                       "description": "Forêts et étangs", "tags": ["countryside"] }))
        .await;
    published.assert_status(StatusCode::CREATED);
    let published: Value = published.json();
    let id = published["id"].as_str().unwrap().to_owned();
    assert_eq!(published["mine"], true);
    assert_eq!(published["walkers"], 0);
    server
        .post("/public-routes")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "route_id": route["id"], "title": "Encore" }))
        .await
        .assert_status(StatusCode::CONFLICT);

    // Lilou finds it, by search and by tag, and starts it.
    let found: Value = server
        .get("/public-routes?q=sologne&tag=countryside")
        .add_header("authorization", bearer(&lilou))
        .await
        .json();
    assert_eq!(found.as_array().unwrap().len(), 1);
    assert_eq!(found[0]["author"]["username"], "theo");
    let featured: Value =
        server.get("/public-routes/featured").add_header("authorization", bearer(&lilou)).await.json();
    assert_eq!(featured["id"], id.as_str());
    let journey =
        server.post(&format!("/public-routes/{id}/start")).add_header("authorization", bearer(&lilou)).await;
    journey.assert_status(StatusCode::CREATED);
    let journey: Value = journey.json();
    assert_eq!(journey["public_route_id"], id.as_str());
    server
        .post(&format!("/public-routes/{id}/start"))
        .add_header("authorization", bearer(&lilou))
        .await
        .assert_status(StatusCode::CONFLICT);

    // She walks it: the fastest by walking time.
    server
        .post("/sessions")
        .add_header("authorization", bearer(&lilou))
        .json(&session(Uuid::now_v7(), 500.0, 600))
        .await
        .assert_status(StatusCode::CREATED);
    let detail: Value =
        server.get(&format!("/public-routes/{id}")).add_header("authorization", bearer(&lilou)).await.json();
    assert_eq!(detail["walkers"], 1);
    assert_eq!(detail["finished"], 1);
    assert_eq!(detail["fastest"][0]["walker"]["username"], "lilou");
    assert!(detail["fastest"][0]["walking_s"].as_i64().unwrap() > 0);
    assert_eq!(detail["my_journey_id"], journey["id"]);

    // A photo, served without a token.
    let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10];
    let with_photo: Value = server
        .put(&format!("/public-routes/{id}/photos/end"))
        .add_header("authorization", bearer(&theo))
        .add_header("content-type", "image/jpeg")
        .bytes(jpeg.to_vec().into())
        .await
        .json();
    let url = with_photo["photos"][0]["url"].as_str().unwrap();
    assert_eq!(server.get(url).await.as_bytes().as_ref(), &jpeg);

    // Three reports hide it; an admin shows it again and makes it the route of the week.
    for name in ["ines", "marc", "nadia"] {
        let walker = register(&server, name).await;
        server
            .post("/reports")
            .add_header("authorization", bearer(&walker))
            .json(&json!({ "target_type": "route", "target_id": id, "reason": "spam" }))
            .await
            .assert_status(StatusCode::NO_CONTENT);
    }
    server
        .get(&format!("/public-routes/{id}"))
        .add_header("authorization", bearer(&lilou))
        .await
        .assert_status(StatusCode::NOT_FOUND);
    server
        .patch(&format!("/admin/public-routes/{id}"))
        .add_header("authorization", bearer(&lilou))
        .json(&json!({ "hidden": false }))
        .await
        .assert_status(StatusCode::FORBIDDEN);
    sqlx::query("UPDATE users SET is_admin = true WHERE username = 'theo'").execute(&db).await.unwrap();
    let reports: Value = server.get("/admin/reports").add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(reports[0]["reports"], 3);
    let shown: Value = server
        .patch(&format!("/admin/public-routes/{id}"))
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "hidden": false, "featured": true }))
        .await
        .json();
    assert_eq!(shown["featured"], true);
    let list: Value = server.get("/public-routes").add_header("authorization", bearer(&lilou)).await.json();
    assert_eq!(list.as_array().unwrap().len(), 1);
}

/// A published route of `auth`, for scheduled journeys.
async fn published_route(server: &TestServer, auth: &Value) -> String {
    let route = create_route(server, auth).await;
    let published: Value = server
        .post("/public-routes")
        .add_header("authorization", bearer(auth))
        .json(&json!({ "route_id": route["id"], "title": "Le Marathon d'hiver" }))
        .await
        .json();
    published["id"].as_str().unwrap().to_owned()
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn scheduled_journeys_from_sign_up_to_standings(db: PgPool) {
    let server = server(db.clone()).await;
    let theo = register(&server, "theo").await;
    let lilou = register(&server, "lilou").await;
    let route_id = published_route(&server, &theo).await;
    let format = &time::format_description::well_known::Rfc3339;
    let at =
        |minutes: i64| (OffsetDateTime::now_utc() + time::Duration::minutes(minutes)).format(format).unwrap();

    // The start is at least ten minutes away, the end an hour after it.
    server
        .post("/events")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "public_route_id": route_id, "title": "Marathon", "starts_at": at(1), "ends_at": at(120) }))
        .await
        .assert_status(StatusCode::BAD_REQUEST);
    let event = server
        .post("/events")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "public_route_id": route_id, "title": "Le Marathon d'hiver",
                       "starts_at": at(30), "ends_at": at(24 * 60) }))
        .await;
    event.assert_status(StatusCode::CREATED);
    let event: Value = event.json();
    let id = event["id"].as_str().unwrap().to_owned();
    assert_eq!(event["state"], "upcoming");
    assert_eq!(event["registered"], 1, "the organiser walks it");

    // Lilou signs up; the journey waits for its start and is not under way yet.
    let signed: Value = server
        .post(&format!("/events/{id}/register"))
        .add_header("authorization", bearer(&lilou))
        .await
        .json();
    assert_eq!(signed["me_registered"], true);
    assert_eq!(signed["registered"], 2);
    let mine: Value =
        server.get("/events?filter=mine").add_header("authorization", bearer(&lilou)).await.json();
    assert_eq!(mine[0]["id"], id.as_str());
    let journeys: Value = server.get("/journeys").add_header("authorization", bearer(&lilou)).await.json();
    assert_eq!(journeys[0]["kind"], "event");
    assert_eq!(journeys[0]["status"], "waiting");

    // The start comes (moved back in time here); sessions since then count.
    sqlx::query("UPDATE journeys SET starts_at = now() - interval '1 hour', created_at = now() - interval '2 hours' WHERE id = $1::uuid")
        .bind(&id)
        .execute(&db)
        .await
        .unwrap();
    sqlx::query(
        "UPDATE journey_participants SET joined_at = now() - interval '1 hour' WHERE journey_id = $1::uuid",
    )
    .bind(&id)
    .execute(&db)
    .await
    .unwrap();
    server
        .post("/sessions")
        .add_header("authorization", bearer(&lilou))
        .json(&session(Uuid::now_v7(), 100.0, 90))
        .await
        .assert_status(StatusCode::CREATED);
    let live: Value =
        server.get(&format!("/events/{id}/live")).add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(live["registered"], 2);
    assert_eq!(live["leaders"][0]["walker"]["username"], "lilou");
    assert_eq!(live["leaders"][0]["distance_m"], 100.0);
    assert_eq!(live["me"]["rank"], 2);
    let card: Value =
        server.get(&format!("/events/{id}")).add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(card["state"], "live");

    // Arriving: first place. A manual session never counts.
    server
        .post("/sessions")
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "local_id": Uuid::now_v7(), "started_at": at(-20), "ended_at": at(-10),
                       "distance_m": 1000.0, "duration_s": 600, "source": "manual" }))
        .await
        .assert_status(StatusCode::CREATED);
    server
        .post("/sessions")
        .add_header("authorization", bearer(&lilou))
        .json(&session(Uuid::now_v7(), 500.0, 600))
        .await
        .assert_status(StatusCode::CREATED);
    let live: Value =
        server.get(&format!("/events/{id}/live")).add_header("authorization", bearer(&theo)).await.json();
    assert!(live["leaders"][0]["arrived_at"].is_string());
    assert_eq!(live["leaders"][1]["distance_m"], 0.0);

    // After the end nobody signs up any more, and the journey is over.
    sqlx::query("UPDATE journeys SET ends_at = now() - interval '1 minute' WHERE id = $1::uuid")
        .bind(&id)
        .execute(&db)
        .await
        .unwrap();
    let late = register(&server, "marc").await;
    server
        .post(&format!("/events/{id}/register"))
        .add_header("authorization", bearer(&late))
        .await
        .assert_status(StatusCode::CONFLICT);
    let card: Value =
        server.get(&format!("/events/{id}")).add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(card["state"], "ended");
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn public_profiles_and_following(db: PgPool) {
    let server = server(db.clone()).await;
    let theo = register(&server, "theo").await;
    let lilou = register(&server, "lilou").await;
    let lilou_id = lilou["user"]["id"].as_str().unwrap();
    let theo_id = theo["user"]["id"].as_str().unwrap();

    // Lilou walks a journey to the end, then starts another one.
    create_journey(&server, &lilou).await;
    server
        .post("/sessions")
        .add_header("authorization", bearer(&lilou))
        .json(&session(Uuid::now_v7(), 500.0, 600))
        .await
        .assert_status(StatusCode::CREATED);
    create_journey(&server, &lilou).await;

    server
        .post(&format!("/users/{theo_id}/follow"))
        .add_header("authorization", bearer(&theo))
        .await
        .assert_status(StatusCode::BAD_REQUEST);
    server
        .post(&format!("/users/{lilou_id}/follow"))
        .add_header("authorization", bearer(&theo))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    let profile: Value = server
        .get(&format!("/users/{lilou_id}/profile"))
        .add_header("authorization", bearer(&theo))
        .await
        .json();
    assert_eq!(profile["walker"]["username"], "lilou");
    assert_eq!(profile["relation"], "none");
    assert_eq!(profile["i_follow"], true);
    assert_eq!(profile["followers"], 1);
    assert_eq!(profile["finished"], 1);
    assert!(profile["total_m"].as_f64().unwrap() >= 500.0);
    assert_eq!(profile["best_streak"], 1);
    assert!(profile["under_way"]["path"].is_array());

    // A profile for friends only keeps the journey under way to friends.
    sqlx::query("UPDATE users SET visibility = 'friends' WHERE username = 'lilou'")
        .execute(&db)
        .await
        .unwrap();
    let private: Value = server
        .get(&format!("/users/{lilou_id}/profile"))
        .add_header("authorization", bearer(&theo))
        .await
        .json();
    assert!(private["under_way"].is_null());
    let mine: Value = server
        .get(&format!("/users/{lilou_id}/profile"))
        .add_header("authorization", bearer(&lilou))
        .await
        .json();
    assert_eq!(mine["relation"], "me");
    assert!(mine["under_way"].is_object());

    server
        .delete(&format!("/users/{lilou_id}/follow"))
        .add_header("authorization", bearer(&theo))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    let after: Value = server
        .get(&format!("/users/{lilou_id}/profile"))
        .add_header("authorization", bearer(&theo))
        .await
        .json();
    assert_eq!(after["followers"], 0);
}

/// Makes two walkers friends (a request, then its acceptance).
async fn befriend(server: &TestServer, a: &Value, b: &Value) {
    server
        .post("/friends")
        .add_header("authorization", bearer(a))
        .json(&json!({ "username": b["user"]["username"] }))
        .await
        .assert_status_success();
    let a_id = a["user"]["id"].as_str().unwrap();
    server
        .post(&format!("/friends/{a_id}/accept"))
        .add_header("authorization", bearer(b))
        .await
        .assert_status_success();
}

#[sqlx::test(migrator = "cap_api::MIGRATOR")]
async fn feed_with_bravos_and_comments(db: PgPool) {
    let server = server(db.clone()).await;
    let theo = register(&server, "theo").await;
    let lilou = register(&server, "lilou").await;
    let marc = register(&server, "marc").await;
    befriend(&server, &theo, &lilou).await;

    // Lilou reaches the end of a journey: an arrival in her friends' feed.
    create_journey(&server, &lilou).await;
    server
        .post("/sessions")
        .add_header("authorization", bearer(&lilou))
        .json(&session(Uuid::now_v7(), 500.0, 600))
        .await
        .assert_status(StatusCode::CREATED);
    let feed: Value = server.get("/feed").add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(feed[0]["kind"], "arrived");
    assert_eq!(feed[0]["author"]["username"], "lilou");
    assert_eq!(feed[0]["data"]["sessions"], 1);
    let post = feed[0]["id"].as_str().unwrap().to_owned();
    // Marc neither follows nor is a friend: nothing for him.
    let empty: Value = server.get("/feed").add_header("authorization", bearer(&marc)).await.json();
    assert_eq!(empty.as_array().unwrap().len(), 0);

    // Her word, a Bravo and a comment.
    let edited: Value = server
        .patch(&format!("/posts/{post}"))
        .add_header("authorization", bearer(&lilou))
        .json(&json!({ "text": "Merci pour les encouragements !" }))
        .await
        .json();
    assert_eq!(edited["text"], "Merci pour les encouragements !");
    let bravo: Value =
        server.post(&format!("/posts/{post}/bravo")).add_header("authorization", bearer(&theo)).await.json();
    assert_eq!(bravo["bravos"], 1);
    assert_eq!(bravo["i_bravo"], true);
    let comments = server
        .post(&format!("/posts/{post}/comments"))
        .add_header("authorization", bearer(&theo))
        .json(&json!({ "text": "Bravo, quelle régularité" }))
        .await;
    comments.assert_status(StatusCode::CREATED);
    let comments: Value = comments.json();
    assert_eq!(comments[0]["author"]["username"], "theo");
    server
        .post(&format!("/posts/{post}/bravo"))
        .add_header("authorization", bearer(&marc))
        .await
        .assert_status(StatusCode::NOT_FOUND);

    // Following her puts her posts in Marc's feed too.
    let lilou_id = lilou["user"]["id"].as_str().unwrap();
    server
        .post(&format!("/users/{lilou_id}/follow"))
        .add_header("authorization", bearer(&marc))
        .await
        .assert_status(StatusCode::NO_CONTENT);
    let followed: Value = server.get("/feed").add_header("authorization", bearer(&marc)).await.json();
    assert_eq!(followed[0]["id"], post.as_str());
    assert_eq!(followed[0]["comments"], 1);

    // Three reports hide a comment.
    let comment = comments[0]["id"].as_str().unwrap();
    for name in ["ines", "nadia", "paul"] {
        let walker = register(&server, name).await;
        server
            .post("/reports")
            .add_header("authorization", bearer(&walker))
            .json(&json!({ "target_type": "comment", "target_id": comment }))
            .await
            .assert_status(StatusCode::NO_CONTENT);
    }
    let hidden: Value = server
        .get(&format!("/posts/{post}/comments"))
        .add_header("authorization", bearer(&theo))
        .await
        .json();
    assert_eq!(hidden.as_array().unwrap().len(), 0);
}
