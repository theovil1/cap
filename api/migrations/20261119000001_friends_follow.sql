-- Friends follow each other: once a friendship is accepted, both follow the
-- other (either can still unfollow later).
CREATE FUNCTION follow_friends() RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'accepted' THEN
        INSERT INTO follows (follower_id, followee_id)
        VALUES (NEW.user_id, NEW.friend_id), (NEW.friend_id, NEW.user_id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER friendships_follow
    AFTER INSERT OR UPDATE OF status ON friendships
    FOR EACH ROW EXECUTE FUNCTION follow_friends();

-- Friends made before this change.
INSERT INTO follows (follower_id, followee_id)
SELECT user_id, friend_id FROM friendships WHERE status = 'accepted'
UNION
SELECT friend_id, user_id FROM friendships WHERE status = 'accepted'
ON CONFLICT DO NOTHING;
