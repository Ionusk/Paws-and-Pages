-- Reading: explicit "currently reading" / "finished" state, plus the Open
-- Library work a book was imported from. Additive only: existing rows keep
-- their data and get status 'reading' (or 'finished' if already at the end).

BEGIN;

ALTER TABLE reading_books
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'reading',
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_library_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reading_books_status_check'
  ) THEN
    ALTER TABLE reading_books
      ADD CONSTRAINT reading_books_status_check
      CHECK (status IN ('reading', 'finished'));
  END IF;
END $$;

UPDATE reading_books
SET status = 'finished',
    finished_at = COALESCE(finished_at, updated_at)
WHERE status = 'reading'
  AND total_pages > 0
  AND current_page >= total_pages;

CREATE INDEX IF NOT EXISTS reading_books_user_status_idx
  ON reading_books (user_id, status);

COMMIT;
