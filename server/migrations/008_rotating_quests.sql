-- Rotating quests: one reroll per user per day, and "listened to an audio
-- lesson" tracking for the listening quest. Additive only.

CREATE TABLE IF NOT EXISTS quest_rerolls (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_key TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly')),
  period_key TEXT NOT NULL,
  old_quest_id TEXT NOT NULL,
  new_quest_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, day_key)
);

ALTER TABLE study_audio
  ADD COLUMN IF NOT EXISTS last_listened_at TIMESTAMPTZ;
