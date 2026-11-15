-- Push notifications: the phones of each walker, and the notes waiting to be sent.
CREATE TABLE push_devices (
    token      text PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Development builds get their tokens from Apple's sandbox.
    sandbox    boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_devices_user_idx ON push_devices (user_id);

-- Written in the same transaction as what it tells, sent by a background task.
CREATE TABLE push_outbox (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message    jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- The streak reminder goes out at most once a day.
ALTER TABLE users ADD COLUMN streak_reminded_on date;
