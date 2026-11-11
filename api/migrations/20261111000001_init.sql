-- Initial schema: accounts, routes, journeys and sessions.
-- Friendships, races, stages and treadmill profiles come with later steps.

CREATE TABLE users (
    id                uuid PRIMARY KEY,
    email             text UNIQUE,
    password_hash     text,
    apple_sub         text UNIQUE,
    first_name        text NOT NULL,
    username          text NOT NULL UNIQUE,
    avatar_url        text,
    country           text NOT NULL DEFAULT 'FR',
    home_city         text,
    height_cm         integer CHECK (height_cm BETWEEN 80 AND 250),
    stride_cm         integer CHECK (stride_cm BETWEEN 20 AND 150),
    daily_step_goal   integer NOT NULL DEFAULT 7000 CHECK (daily_step_goal BETWEEN 500 AND 100000),
    sessions_per_week integer NOT NULL DEFAULT 3 CHECK (sessions_per_week BETWEEN 2 AND 5),
    language          text NOT NULL DEFAULT 'fr' CHECK (language IN ('fr', 'en')),
    created_at        timestamptz NOT NULL DEFAULT now(),
    CHECK (email IS NOT NULL OR apple_sub IS NOT NULL),
    CHECK (email = lower(email))
);

CREATE TABLE refresh_tokens (
    id          uuid PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash  text NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- A walking route, computed once and never modified.
-- path: [[lon, lat, cumulative_m], ...]
CREATE TABLE routes (
    id              uuid PRIMARY KEY,
    start_label     text NOT NULL,
    start_lat       double precision NOT NULL,
    start_lon       double precision NOT NULL,
    end_label       text NOT NULL,
    end_lat         double precision NOT NULL,
    end_lon         double precision NOT NULL,
    distance_m      double precision NOT NULL CHECK (distance_m > 0),
    path            jsonb NOT NULL,
    engine_version  text NOT NULL,
    created_by      uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE journeys (
    id          uuid PRIMARY KEY,
    route_id    uuid NOT NULL REFERENCES routes (id),
    kind        text NOT NULL CHECK (kind IN ('solo', 'race')),
    status      text NOT NULL CHECK (status IN ('invited', 'waiting', 'active', 'finished')),
    starts_at   timestamptz,
    created_by  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE journey_participants (
    journey_id  uuid NOT NULL REFERENCES journeys (id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    distance_m  double precision NOT NULL DEFAULT 0 CHECK (distance_m >= 0),
    arrived_at  timestamptz,
    rank        integer,
    PRIMARY KEY (journey_id, user_id)
);
CREATE INDEX journey_participants_user_idx ON journey_participants (user_id);

CREATE TABLE sessions (
    id                uuid PRIMARY KEY,
    user_id           uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    local_id          uuid NOT NULL,
    started_at        timestamptz NOT NULL,
    ended_at          timestamptz NOT NULL CHECK (ended_at > started_at),
    distance_m        double precision NOT NULL CHECK (distance_m >= 0),
    duration_s        integer NOT NULL CHECK (duration_s > 0),
    steps             integer NOT NULL DEFAULT 0 CHECK (steps >= 0),
    avg_speed_kmh     double precision NOT NULL CHECK (avg_speed_kmh BETWEEN 0 AND 20),
    avg_incline_pct   double precision NOT NULL DEFAULT 0,
    source            text NOT NULL CHECK (source IN ('treadmill', 'manual')),
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, local_id)
);
CREATE INDEX sessions_user_started_idx ON sessions (user_id, started_at DESC);

-- Where the distance of each session went.
CREATE TABLE session_allocations (
    session_id  uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    journey_id  uuid NOT NULL REFERENCES journeys (id) ON DELETE CASCADE,
    distance_m  double precision NOT NULL CHECK (distance_m >= 0),
    PRIMARY KEY (session_id, journey_id)
);
