-- A 720 px thumbnail of each route photo, for the Explorer lists; the API
-- fills it for the photos saved before.
ALTER TABLE public_route_photos ADD COLUMN thumb bytea;
