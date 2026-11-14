-- Théo, who started Cap, is part of the team.
INSERT INTO user_badges (user_id, badge)
SELECT id, 'team' FROM users WHERE username = 'theo9223'
ON CONFLICT DO NOTHING;
