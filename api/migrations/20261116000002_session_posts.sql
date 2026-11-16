-- A session can be posted in the feed, with the stretch of route it covered,
-- to friends only or to followers too.
ALTER TABLE posts DROP CONSTRAINT posts_kind_check;
ALTER TABLE posts ADD CONSTRAINT posts_kind_check
    CHECK (kind IN ('arrived', 'stage', 'medal', 'published', 'note', 'session'));
ALTER TABLE posts ADD COLUMN session_id uuid REFERENCES sessions (id) ON DELETE CASCADE;
CREATE UNIQUE INDEX posts_session_idx ON posts (session_id) WHERE session_id IS NOT NULL;
-- `all`: friends and followers, as before; `friends`: friends only.
ALTER TABLE posts ADD COLUMN audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'friends'));
