-- The activity feed: what walkers did (arrivals, stages, medals, routes
-- published), with a word of their own, Bravos and comments.

CREATE TABLE posts (
    id          uuid PRIMARY KEY,
    author_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('arrived', 'stage', 'medal', 'published')),
    -- What the card shows: titles, distances, medal, stage... frozen when it happened.
    data        jsonb NOT NULL DEFAULT '{}',
    journey_id  uuid REFERENCES journeys (id) ON DELETE SET NULL,
    text        text CHECK (text IS NULL OR char_length(text) <= 280),
    hidden      boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_author_idx ON posts (author_id, created_at DESC);
CREATE INDEX posts_created_idx ON posts (created_at DESC);

CREATE TABLE bravos (
    post_id     uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE comments (
    id          uuid PRIMARY KEY,
    post_id     uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    author_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    text        text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
    hidden      boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON comments (post_id, created_at);
