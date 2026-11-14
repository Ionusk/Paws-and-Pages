import { pool } from "./db.js";

async function updateDatabase() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS solana_wallet_address TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS
        users_solana_wallet_address_unique
      ON users (solana_wallet_address)
      WHERE solana_wallet_address IS NOT NULL;
    `);

    console.log("Coloana solana_wallet_address a fost configurată!");
  } catch (error) {
    console.error("Eroare la actualizarea bazei de date:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

updateDatabase();
