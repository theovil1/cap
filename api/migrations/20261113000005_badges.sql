-- Profile badges: a role or a status. Some are given by admins (team,
-- certified, developer...), the others come from what walkers do and are
-- worked out on the fly (founder, organiser, route maker, ambassador).

CREATE TABLE user_badges (
    user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    badge       text NOT NULL CHECK (badge IN ('team', 'certified', 'developer', 'github', 'supporter',
                                              'beta', 'moderator', 'club')),
    -- Supporter level: 1 Soutien, 2 Grand soutien, 3 Mécène.
    tier        smallint CHECK (tier IS NULL OR tier BETWEEN 1 AND 3),
    granted_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge)
);

-- Friends who joined through someone's invite link (for the Ambassador badge).
ALTER TABLE friendships ADD COLUMN via_invite boolean NOT NULL DEFAULT false;
