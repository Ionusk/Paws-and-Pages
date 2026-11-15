-- Friends: one row per pair of users. A row starts as a pending request
-- from requester_id to addressee_id and becomes 'accepted' when the
-- addressee accepts. Declining, cancelling and unfriending delete the row.
-- Additive only; re-running it is a no-op.

BEGIN;

CREATE TABLE IF NOT EXISTS friendships (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    CHECK (requester_id <> addressee_id)
);

-- At most one row per pair, whichever direction the request went.
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique
    ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id, status);

-- Prefix search on usernames ("ali" finds "Alice").
CREATE INDEX IF NOT EXISTS users_username_lower_pattern
    ON users (LOWER(username) text_pattern_ops)
    WHERE username IS NOT NULL;

COMMIT;
