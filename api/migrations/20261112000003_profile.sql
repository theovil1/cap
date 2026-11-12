-- Profile settings (specification: Mon compte, Personnalisation) and profile photos.
ALTER TABLE users
    ADD COLUMN app_color     text    NOT NULL DEFAULT 'orange'
        CHECK (app_color IN ('orange', 'blue', 'green', 'purple', 'pink')),
    ADD COLUMN map_mood      text    NOT NULL DEFAULT 'auto' CHECK (map_mood IN ('auto', 'day', 'night')),
    ADD COLUMN units         text    NOT NULL DEFAULT 'km' CHECK (units IN ('km', 'mi')),
    ADD COLUMN notifications boolean NOT NULL DEFAULT true,
    -- `everyone`: found by the start of the username; `friends`: only by the exact username or a link.
    ADD COLUMN visibility    text    NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'friends'));

CREATE TABLE user_avatars (
    user_id       uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    content_type  text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
    image         bytea NOT NULL,
    updated_at    timestamptz NOT NULL DEFAULT now()
);
