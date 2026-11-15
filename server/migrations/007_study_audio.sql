-- Audio lessons: ElevenLabs text-to-speech of a material's Gemini summary.
-- One cached MP3 per material, so listening again costs no ElevenLabs
-- characters. text_hash changes when the summary changes, which triggers a
-- new generation.

CREATE TABLE IF NOT EXISTS study_audio (
  material_id INTEGER PRIMARY KEY
    REFERENCES study_materials(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  audio BYTEA NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
  text_hash TEXT NOT NULL,
  characters INTEGER NOT NULL,
  voice_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS study_audio_user_idx ON study_audio (user_id);
