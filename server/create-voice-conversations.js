import { pool } from "./db.js";

// Creează tabelul pentru conversațiile vocale cu Laica (ElevenLabs).
// Se poate rula de mai multe ori: nu modifică nimic dacă tabelul există.

async function createVoiceConversationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voice_conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL
          REFERENCES users(id) ON DELETE CASCADE,
        elevenlabs_conversation_id TEXT,
        title TEXT NOT NULL,
        book_title TEXT,
        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS voice_conversations_user_created_idx
        ON voice_conversations (user_id, created_at DESC);
    `);

    console.log("Tabelul voice_conversations a fost creat!");
  } catch (error) {
    console.error(error.message);
  } finally {
    await pool.end();
  }
}

createVoiceConversationsTable();
