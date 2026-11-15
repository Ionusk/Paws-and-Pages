-- Usernames, UPT student verification and Campus book borrowing.
-- Additive only: existing rows and columns are not modified, so it is safe to
-- run on a database that already has users. Re-running it is a no-op.

BEGIN;

-- ---------------------------------------------------------
-- USERS: username + trusted email / student verification
-- ---------------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

-- Email and verification flag exactly as Auth0 reports them (/userinfo).
-- Never filled from request bodies.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_email_checked_at TIMESTAMPTZ;

-- The UPT address that grants Campus access, and how it was proven:
--   'login' = the Auth0 account's own verified email (re-checked periodically)
--   'code'  = a one-time code Auth0 emailed to the address
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_email_source TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_email_verified_at TIMESTAMPTZ;

-- Address waiting for its emailed code to be confirmed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_student_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_code_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_code_attempts INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'users_username_format'
                     AND conrelid = 'users'::regclass) THEN
        ALTER TABLE users ADD CONSTRAINT users_username_format
            CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_]{3,20}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'users_student_email_domain'
                     AND conrelid = 'users'::regclass) THEN
        ALTER TABLE users ADD CONSTRAINT users_student_email_domain
            CHECK (student_email IS NULL OR student_email ~ '^[a-z0-9._%+-]+@student\.upt\.ro$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'users_student_email_source'
                     AND conrelid = 'users'::regclass) THEN
        ALTER TABLE users ADD CONSTRAINT users_student_email_source
            CHECK (student_email_source IS NULL OR student_email_source IN ('login', 'code'));
    END IF;
END $$;

-- Usernames are unique regardless of capitalization.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
    ON users (LOWER(username))
    WHERE username IS NOT NULL;

-- One UPT address can unlock Campus for only one Paws & Pages account.
CREATE UNIQUE INDEX IF NOT EXISTS users_student_email_unique
    ON users (student_email)
    WHERE student_email IS NOT NULL;

-- ---------------------------------------------------------
-- CAMPUS BOOK LISTINGS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS campus_books (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    author TEXT NOT NULL CHECK (char_length(author) BETWEEN 1 AND 120),
    description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
    category TEXT CHECK (category IS NULL OR char_length(category) <= 60),
    notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
    cover_data BYTEA,
    cover_mime_type TEXT,
    -- 'borrowed' is managed by the server when a request is accepted.
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'borrowed', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Soft delete keeps borrow history and chats intact.
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campus_books_owner
    ON campus_books(owner_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campus_books_browse
    ON campus_books(status, created_at DESC)
    WHERE deleted_at IS NULL;

-- ---------------------------------------------------------
-- BORROW REQUESTS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS campus_borrow_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    book_id BIGINT NOT NULL REFERENCES campus_books(id) ON DELETE CASCADE,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT CHECK (message IS NULL OR char_length(message) <= 500),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'returned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,

    CONSTRAINT campus_request_not_own_book CHECK (requester_id <> owner_id)
);

-- A student can have only one open request per book.
CREATE UNIQUE INDEX IF NOT EXISTS campus_requests_one_active_per_user
    ON campus_borrow_requests(book_id, requester_id)
    WHERE status IN ('pending', 'accepted');

-- A book can be lent to only one student at a time. This is the database-level
-- guard against two owners' "accept" clicks racing each other.
CREATE UNIQUE INDEX IF NOT EXISTS campus_requests_one_accepted_per_book
    ON campus_borrow_requests(book_id)
    WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS idx_campus_requests_owner
    ON campus_borrow_requests(owner_id, status);

CREATE INDEX IF NOT EXISTS idx_campus_requests_requester
    ON campus_borrow_requests(requester_id, status);

-- ---------------------------------------------------------
-- PRIVATE CONVERSATIONS (one per accepted request)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS campus_conversations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id BIGINT NOT NULL UNIQUE REFERENCES campus_borrow_requests(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES campus_books(id) ON DELETE CASCADE,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_last_read_id BIGINT NOT NULL DEFAULT 0,
    requester_last_read_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,

    CONSTRAINT campus_conversation_two_people CHECK (owner_id <> requester_id)
);

CREATE INDEX IF NOT EXISTS idx_campus_conversations_owner
    ON campus_conversations(owner_id);

CREATE INDEX IF NOT EXISTS idx_campus_conversations_requester
    ON campus_conversations(requester_id);

CREATE TABLE IF NOT EXISTS campus_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES campus_conversations(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_messages_conversation
    ON campus_messages(conversation_id, id);

COMMIT;
