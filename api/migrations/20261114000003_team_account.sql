-- The Cap team: a system account owned by the API. It has no e-mail,
-- password or Apple ID, so nobody can sign in as it; the API publishes the
-- base routes of the Explorer in its name.
ALTER TABLE users ADD COLUMN is_system boolean NOT NULL DEFAULT false;
ALTER TABLE users DROP CONSTRAINT users_check;
ALTER TABLE users ADD CONSTRAINT users_check CHECK (email IS NOT NULL OR apple_sub IS NOT NULL OR is_system);

INSERT INTO users (id, first_name, username, is_system)
VALUES ('00000000-0000-0000-0000-000000000ca9', 'Équipe Cap', 'cap', true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO user_badges (user_id, badge)
VALUES ('00000000-0000-0000-0000-000000000ca9', 'team')
ON CONFLICT DO NOTHING;
