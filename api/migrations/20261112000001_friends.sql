-- Friends: a request from user_id to friend_id, then its acceptance.

CREATE TABLE friendships (
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    friend_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status       text NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    accepted_at  timestamptz,
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id <> friend_id)
);
-- One link per pair, whoever asked first.
CREATE UNIQUE INDEX friendships_pair_idx
    ON friendships (LEAST(user_id, friend_id), GREATEST(user_id, friend_id));
CREATE INDEX friendships_friend_idx ON friendships (friend_id);

-- Personal invite link: whoever opens it becomes a friend at once.
ALTER TABLE users ADD COLUMN invite_code text UNIQUE;
