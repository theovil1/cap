-- Public routes: a computed route shared with everyone (or friends), with
-- up to three photos; journeys started from one point back to it.
-- Reports hide what the community flags, admins decide.

ALTER TABLE users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

CREATE TABLE public_routes (
    id           uuid PRIMARY KEY,
    route_id     uuid NOT NULL UNIQUE REFERENCES routes (id),
    author_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title        text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
    description  text NOT NULL DEFAULT '' CHECK (char_length(description) <= 600),
    visibility   text NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'friends')),
    tags         text[] NOT NULL DEFAULT '{}',
    hidden       boolean NOT NULL DEFAULT false,
    featured_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX public_routes_created_idx ON public_routes (created_at DESC);
CREATE INDEX public_routes_author_idx ON public_routes (author_id);

CREATE TABLE public_route_photos (
    public_route_id  uuid NOT NULL REFERENCES public_routes (id) ON DELETE CASCADE,
    kind             text NOT NULL CHECK (kind IN ('start', 'end', 'path')),
    content_type     text NOT NULL,
    image            bytea NOT NULL,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (public_route_id, kind)
);

ALTER TABLE journeys ADD COLUMN public_route_id uuid REFERENCES public_routes (id) ON DELETE SET NULL;
CREATE INDEX journeys_public_route_idx ON journeys (public_route_id);

CREATE TABLE reports (
    id           uuid PRIMARY KEY,
    reporter_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_type  text NOT NULL CHECK (target_type IN ('route', 'post', 'comment', 'user')),
    target_id    uuid NOT NULL,
    reason       text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 300),
    created_at   timestamptz NOT NULL DEFAULT now(),
    resolved_at  timestamptz,
    UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX reports_target_idx ON reports (target_type, target_id);
