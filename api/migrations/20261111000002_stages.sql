-- Stages: towns along a route, unlocked as the walker passes them.

CREATE TABLE route_stages (
    id          uuid PRIMARY KEY,
    route_id    uuid NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
    position    integer NOT NULL CHECK (position >= 0),
    name        text NOT NULL,
    county      text,
    lat         double precision NOT NULL,
    lon         double precision NOT NULL,
    -- Distance from the start of the route; the first stage (the start) is at 0.
    at_m        double precision NOT NULL CHECK (at_m >= 0),
    UNIQUE (route_id, position)
);

CREATE TABLE stage_unlocks (
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    journey_id   uuid NOT NULL REFERENCES journeys (id) ON DELETE CASCADE,
    stage_id     uuid NOT NULL REFERENCES route_stages (id) ON DELETE CASCADE,
    session_id   uuid REFERENCES sessions (id) ON DELETE SET NULL,
    unlocked_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, journey_id, stage_id)
);
CREATE INDEX stage_unlocks_session_idx ON stage_unlocks (session_id);
