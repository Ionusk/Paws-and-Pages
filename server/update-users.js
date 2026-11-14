
import { pool } from "./db.js";

async function updateDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        auth0_id TEXT UNIQUE NOT NULL,
        email TEXT,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE study_materials
      ADD COLUMN IF NOT EXISTS user_id INTEGER
      REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE quizzes
      ADD COLUMN IF NOT EXISTS user_id INTEGER
      REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE quiz_results
      ADD COLUMN IF NOT EXISTS user_id INTEGER
      REFERENCES users(id) ON DELETE CASCADE;
    `);

    console.log("Tabelul users și legăturile au fost create!");
  } catch (error) {
    console.error(error.message);
  } finally {
    await pool.end();
  }
}

updateDatabase();
