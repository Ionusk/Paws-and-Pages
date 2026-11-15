-- Book reviews: a star rating (1-5) and optional written thoughts for a book
-- the user has finished. One review per book. Additive only; re-running it
-- is a no-op.

BEGIN;

CREATE TABLE IF NOT EXISTS book_reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL UNIQUE REFERENCES reading_books(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body TEXT CHECK (body IS NULL OR char_length(body) <= 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_reviews_user
    ON book_reviews(user_id, updated_at DESC);

COMMIT;
