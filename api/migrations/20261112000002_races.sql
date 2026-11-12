-- Races: friends are invited (joined_at NULL) until they join.
-- Existing participants (solo journeys) have always been in.
ALTER TABLE journey_participants ADD COLUMN joined_at timestamptz DEFAULT now();
UPDATE journey_participants p SET joined_at = j.created_at FROM journeys j WHERE j.id = p.journey_id;
