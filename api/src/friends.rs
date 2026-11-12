//! Friends: requests by username, instant friendship through a personal invite link.

use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode, header},
    response::Html,
};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use utoipa::{IntoParams, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    error::{AppError, AppResult, ErrorBody},
    state::AppState,
};

/// Invite codes avoid look-alike characters (0/o, 1/l/i).
const CODE_ALPHABET: &[u8] = b"abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LEN: usize = 10;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(list_friends, add_friend))
        .routes(routes!(accept_friend))
        .routes(routes!(remove_friend))
        .routes(routes!(invite_code))
        .routes(routes!(search_users))
}

#[derive(Serialize, ToSchema)]
pub struct Friend {
    id: Uuid,
    first_name: String,
    username: String,
    avatar_url: Option<String>,
    /// When the friendship was accepted, or when the request was sent.
    #[serde(with = "time::serde::rfc3339")]
    since: OffsetDateTime,
}

#[derive(Serialize, ToSchema)]
pub struct FriendList {
    friends: Vec<Friend>,
    /// Requests waiting for the current user's answer.
    incoming: Vec<Friend>,
    /// Requests sent by the current user, not answered yet.
    outgoing: Vec<Friend>,
}

#[derive(Deserialize, ToSchema)]
pub struct AddFriend {
    /// Send a request to this username (or accept theirs if they asked first).
    username: Option<String>,
    /// Or open someone's invite link: friends at once.
    invite_code: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct AddFriendResult {
    /// `pending` or `accepted`.
    status: String,
    friend: Friend,
}

#[derive(Serialize, ToSchema)]
pub struct InviteCode {
    code: String,
}

#[derive(Deserialize, IntoParams)]
pub struct SearchQuery {
    /// Start of a username, at least 2 characters.
    q: String,
}

#[derive(Serialize, ToSchema)]
pub struct UserMatch {
    id: Uuid,
    first_name: String,
    username: String,
    avatar_url: Option<String>,
    /// `none`, `friend`, `incoming` (they asked) or `outgoing` (you asked).
    relation: String,
}

/// Friends of the current user and pending requests both ways.
#[utoipa::path(get, path = "/friends", tag = "friends", security(("bearer" = [])),
    responses((status = 200, body = FriendList)))]
async fn list_friends(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<FriendList>> {
    let rows = sqlx::query!(
        "SELECT u.id, u.first_name, u.username, u.avatar_url, f.status,
                (f.user_id = $1) AS \"outgoing!\", COALESCE(f.accepted_at, f.created_at) AS \"since!\"
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
         WHERE f.user_id = $1 OR f.friend_id = $1
         ORDER BY lower(u.first_name), u.username",
        user_id
    )
    .fetch_all(&state.db)
    .await?;
    let mut list = FriendList { friends: Vec::new(), incoming: Vec::new(), outgoing: Vec::new() };
    for r in rows {
        let friend = Friend {
            id: r.id,
            first_name: r.first_name,
            username: r.username,
            avatar_url: r.avatar_url,
            since: r.since,
        };
        match (r.status.as_str(), r.outgoing) {
            ("accepted", _) => list.friends.push(friend),
            (_, true) => list.outgoing.push(friend),
            (_, false) => list.incoming.push(friend),
        }
    }
    Ok(Json(list))
}

/// Ask a user to be friends, or join through their invite link.
#[utoipa::path(post, path = "/friends", tag = "friends", security(("bearer" = [])), request_body = AddFriend,
    responses((status = 200, body = AddFriendResult), (status = 400, body = ErrorBody),
        (status = 404, body = ErrorBody), (status = 422, body = ErrorBody)))]
async fn add_friend(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Json(body): Json<AddFriend>,
) -> AppResult<Json<AddFriendResult>> {
    let by_invite = body.invite_code.is_some();
    let target = match (body.username, body.invite_code) {
        (Some(username), None) => sqlx::query!(
            "SELECT id, first_name, username, avatar_url FROM users WHERE username = $1",
            username.trim().to_lowercase()
        )
        .fetch_optional(&state.db)
        .await?
        .map(|u| (u.id, u.first_name, u.username, u.avatar_url)),
        (None, Some(code)) => sqlx::query!(
            "SELECT id, first_name, username, avatar_url FROM users WHERE invite_code = $1",
            code.trim().to_lowercase()
        )
        .fetch_optional(&state.db)
        .await?
        .map(|u| (u.id, u.first_name, u.username, u.avatar_url)),
        _ => return Err(AppError::bad_request("invalid_request", "give a username or an invite code")),
    };
    let (friend_id, first_name, username, avatar_url) =
        target.ok_or_else(|| AppError::not_found("user not found"))?;
    if friend_id == user_id {
        return Err(AppError::unprocessable("self_friend", "you cannot add yourself"));
    }

    let mut tx = state.db.begin().await?;
    let existing = sqlx::query!(
        "SELECT user_id, status, COALESCE(accepted_at, created_at) AS \"since!\" FROM friendships
         WHERE LEAST(user_id, friend_id) = LEAST($1::uuid, $2::uuid)
           AND GREATEST(user_id, friend_id) = GREATEST($1::uuid, $2::uuid)
         FOR UPDATE",
        user_id,
        friend_id
    )
    .fetch_optional(&mut *tx)
    .await?;
    let (status, since) = match existing {
        Some(link) if link.status == "accepted" => ("accepted", link.since),
        // They asked first, or the link says yes: the pair becomes friends.
        Some(link) if link.user_id == friend_id || by_invite => {
            let since = sqlx::query_scalar!(
                "UPDATE friendships SET status = 'accepted', accepted_at = now()
                 WHERE user_id = $1 AND friend_id = $2 RETURNING accepted_at AS \"accepted_at!\"",
                link.user_id,
                if link.user_id == user_id { friend_id } else { user_id }
            )
            .fetch_one(&mut *tx)
            .await?;
            ("accepted", since)
        }
        Some(link) => ("pending", link.since),
        None => {
            let status = if by_invite { "accepted" } else { "pending" };
            let since = sqlx::query_scalar!(
                "INSERT INTO friendships (user_id, friend_id, status, accepted_at)
                 VALUES ($1, $2, $3, CASE WHEN $3 = 'accepted' THEN now() END)
                 RETURNING COALESCE(accepted_at, created_at) AS \"since!\"",
                user_id,
                friend_id,
                status
            )
            .fetch_one(&mut *tx)
            .await?;
            (status, since)
        }
    };
    tx.commit().await?;
    Ok(Json(AddFriendResult {
        status: status.to_owned(),
        friend: Friend { id: friend_id, first_name, username, avatar_url, since },
    }))
}

/// Accept a request received from this user.
#[utoipa::path(post, path = "/friends/{id}/accept", tag = "friends", security(("bearer" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ErrorBody)))]
async fn accept_friend(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let updated = sqlx::query!(
        "UPDATE friendships SET status = 'accepted', accepted_at = now()
         WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'",
        id,
        user_id
    )
    .execute(&state.db)
    .await?;
    if updated.rows_affected() == 0 {
        return Err(AppError::not_found("friend request not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Remove a friend, decline their request or cancel yours.
#[utoipa::path(delete, path = "/friends/{id}", tag = "friends", security(("bearer" = [])),
    params(("id" = Uuid, Path)),
    responses((status = 204), (status = 404, body = ErrorBody)))]
async fn remove_friend(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let deleted = sqlx::query!(
        "DELETE FROM friendships
         WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)",
        user_id,
        id
    )
    .execute(&state.db)
    .await?;
    if deleted.rows_affected() == 0 {
        return Err(AppError::not_found("friend not found"));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// The current user's invite code, created on first use.
#[utoipa::path(get, path = "/friends/invite", tag = "friends", security(("bearer" = [])),
    responses((status = 200, body = InviteCode)))]
async fn invite_code(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
) -> AppResult<Json<InviteCode>> {
    let code = sqlx::query_scalar!(
        "UPDATE users SET invite_code = COALESCE(invite_code, $2) WHERE id = $1
         RETURNING invite_code AS \"invite_code!\"",
        user_id,
        new_code()
    )
    .fetch_one(&state.db)
    .await?;
    Ok(Json(InviteCode { code }))
}

/// Users whose username starts with the query (or is exactly it, for private profiles),
/// with their link to the current user.
#[utoipa::path(get, path = "/users/search", tag = "friends", security(("bearer" = [])),
    params(SearchQuery),
    responses((status = 200, body = Vec<UserMatch>)))]
async fn search_users(
    State(state): State<AppState>,
    AuthUser(user_id): AuthUser,
    Query(query): Query<SearchQuery>,
) -> AppResult<Json<Vec<UserMatch>>> {
    let q = query.q.trim().trim_start_matches('@').to_lowercase();
    if q.chars().count() < 2 {
        return Ok(Json(Vec::new()));
    }
    let rows = sqlx::query!(
        "SELECT u.id, u.first_name, u.username, u.avatar_url,
                CASE WHEN f.status = 'accepted' THEN 'friend'
                     WHEN f.user_id = $1 THEN 'outgoing'
                     WHEN f.user_id IS NOT NULL THEN 'incoming'
                     ELSE 'none' END AS \"relation!\"
         FROM users u
         LEFT JOIN friendships f
           ON (f.user_id = $1 AND f.friend_id = u.id) OR (f.user_id = u.id AND f.friend_id = $1)
         WHERE u.id <> $1 AND (u.username = $2 OR (u.visibility = 'everyone' AND starts_with(u.username, $2)))
         ORDER BY length(u.username), u.username
         LIMIT 10",
        user_id,
        q
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(
        rows.into_iter()
            .map(|r| UserMatch {
                id: r.id,
                first_name: r.first_name,
                username: r.username,
                avatar_url: r.avatar_url,
                relation: r.relation,
            })
            .collect(),
    ))
}

fn new_code() -> String {
    (0..CODE_LEN).map(|_| CODE_ALPHABET[rand::random_range(0..CODE_ALPHABET.len())] as char).collect()
}

/// Texts of the invite page, in French (default) or English.
struct PageTexts {
    lang: &'static str,
    invites: &'static str,
    pitch: &'static str,
    open: &'static str,
    unknown: &'static str,
}

const FR: PageTexts = PageTexts {
    lang: "fr",
    invites: "t'invite sur Cap",
    pitch: "Marche sur ton tapis, avance sur une vraie route et fais la course avec tes amis.",
    open: "Ouvrir dans Cap",
    unknown: "Ce lien d'invitation n'existe pas.",
};

const EN: PageTexts = PageTexts {
    lang: "en",
    invites: "invites you to Cap",
    pitch: "Walk on your treadmill, move along a real road and race your friends.",
    open: "Open in Cap",
    unknown: "This invite link does not exist.",
};

/// Web page behind an invite link: it opens the app, which adds the friend.
pub async fn invite_page(
    State(state): State<AppState>,
    Path(code): Path<String>,
    headers: HeaderMap,
) -> (StatusCode, Html<String>) {
    let english = headers
        .get(header::ACCEPT_LANGUAGE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.trim_start().to_lowercase().starts_with("en"));
    let texts = if english { &EN } else { &FR };
    let code = code.to_lowercase();
    let valid = code.len() == CODE_LEN && code.bytes().all(|b| CODE_ALPHABET.contains(&b));
    let name = if valid {
        sqlx::query_scalar!("SELECT first_name FROM users WHERE invite_code = $1", code)
            .fetch_optional(&state.db)
            .await
            .ok()
            .flatten()
    } else {
        None
    };
    let Some(name) = name else {
        return (StatusCode::NOT_FOUND, Html(page(texts, "Cap", texts.unknown, None)));
    };
    let title = format!("{} {}", escape(&name), texts.invites);
    (StatusCode::OK, Html(page(texts, &title, texts.pitch, Some(&format!("cap://invite/{code}")))))
}

fn page(texts: &PageTexts, title: &str, text: &str, link: Option<&str>) -> String {
    let (lang, open) = (texts.lang, texts.open);
    let button = link.map_or(String::new(), |href| format!("<a class=\"button\" href=\"{href}\">{open}</a>"));
    format!(
        "<!doctype html><html lang=\"{lang}\"><head><meta charset=\"utf-8\">\
         <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>{title}</title>\
         <style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#F4F2EE;\
         color:#15161A;font:17px/1.45 -apple-system,system-ui,sans-serif;text-align:center}}\
         main{{max-width:340px;padding:24px}}h1{{font-size:28px;line-height:1.15;margin:0 0 12px}}\
         p{{color:#5C5E67;margin:0 0 28px}}.button{{display:block;padding:17px;border-radius:20px;\
         background:#FF5A1F;color:#fff;font-weight:600;text-decoration:none}}\
         @media (prefers-color-scheme:dark){{body{{background:#0B0C0F;color:#F4F2EE}}p{{color:#A2A4AD}}}}</style>\
         </head><body><main><h1>{title}</h1><p>{text}</p>{button}</main></body></html>"
    )
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invite_codes_use_the_alphabet() {
        let code = new_code();
        assert_eq!(code.len(), CODE_LEN);
        assert!(code.bytes().all(|b| CODE_ALPHABET.contains(&b)));
    }

    #[test]
    fn names_are_escaped() {
        assert_eq!(escape("<b>\"Théo\" & co</b>"), "&lt;b&gt;&quot;Théo&quot; &amp; co&lt;/b&gt;");
    }
}
