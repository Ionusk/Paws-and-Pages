
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.TIGER_DATABASE_URL) {
  throw new Error("Lipsește TIGER_DATABASE_URL din server/.env");
}

const databaseUrl = new URL(process.env.TIGER_DATABASE_URL);

// Eliminăm sslmode din URL pentru a nu suprascrie setările SSL de mai jos.
databaseUrl.searchParams.delete("sslmode");

export const pool = new Pool({
  connectionString: databaseUrl.toString(),
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function testDatabaseConnection() {
  const result = await pool.query("SELECT NOW()");

  console.log("Tiger Data conectat cu succes!");
  console.log("Ora bazei de date:", result.rows[0].now);
}
