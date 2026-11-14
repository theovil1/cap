-- Walkers can also post a few words of their own: a note, text only.
ALTER TABLE posts DROP CONSTRAINT posts_kind_check;
ALTER TABLE posts ADD CONSTRAINT posts_kind_check
    CHECK (kind IN ('arrived', 'stage', 'medal', 'published', 'note'));
ALTER TABLE posts ADD CONSTRAINT posts_note_text CHECK (kind <> 'note' OR text IS NOT NULL);
