
import { pool } from "./db.js";

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS study_materials (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_type TEXT,
        content_summary TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        material_id INTEGER REFERENCES study_materials(id)
          ON DELETE CASCADE,
        title TEXT,
        questions JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quiz_results (
        id SERIAL PRIMARY KEY,
        quiz_id INTEGER REFERENCES quizzes(id)
          ON DELETE CASCADE,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        answers JSONB,
        completed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log("Tabelele au fost create cu succes!");
  } catch (error) {
    console.error("Eroare la crearea tabelelor:", error.message);
  } finally {
    await pool.end();
  }
}

initializeDatabase();
