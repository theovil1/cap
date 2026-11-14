-- Who took a photo and under which licence, for photos taken from elsewhere.
ALTER TABLE public_route_photos ADD COLUMN credit text CHECK (char_length(credit) <= 200);
