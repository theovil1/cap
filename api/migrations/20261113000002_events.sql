-- Scheduled journeys ("trajets planifiés"): a public route walked by everyone
-- who signs up, from a common start time to an end date. The first to arrive
-- wins. A journey of kind `event` with its own title and end.

ALTER TABLE journeys DROP CONSTRAINT journeys_kind_check;
ALTER TABLE journeys ADD CONSTRAINT journeys_kind_check CHECK (kind IN ('solo', 'race', 'event'));
ALTER TABLE journeys ADD COLUMN title text CHECK (title IS NULL OR char_length(title) BETWEEN 3 AND 80);
ALTER TABLE journeys ADD COLUMN ends_at timestamptz CHECK (ends_at IS NULL OR ends_at > starts_at);
ALTER TABLE journeys ADD CONSTRAINT journeys_event_check
    CHECK (kind <> 'event' OR (title IS NOT NULL AND starts_at IS NOT NULL AND ends_at IS NOT NULL
                               AND public_route_id IS NOT NULL));
CREATE INDEX journeys_event_idx ON journeys (starts_at) WHERE kind = 'event';
