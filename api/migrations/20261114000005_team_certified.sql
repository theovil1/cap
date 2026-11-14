-- The Cap team account is certified too.
INSERT INTO user_badges (user_id, badge)
VALUES ('00000000-0000-0000-0000-000000000ca9', 'certified')
ON CONFLICT DO NOTHING;
