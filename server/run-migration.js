// Applies one SQL file from ./migrations to the database in TIGER_DATABASE_URL.
// Usage: npm run migrate -- 004_usernames_campus.sql
//
// The migration files wrap their statements in BEGIN/COMMIT, so a failure
// leaves the database unchanged.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pool } from "./db.js";

const name = process.argv[2];

if (!name || !/^[0-9]{3}_[a-z0-9_]+\.sql$/.test(name)) {
  console.error("Usage: npm run migrate -- <NNN_name.sql>");
  process.exit(1);
}

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations", name);

try {
  const sql = await readFile(file, "utf8");
  await pool.query(sql);
  console.log(`Applied ${name}`);
} catch (error) {
  console.error(`Migration ${name} failed:`, error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
