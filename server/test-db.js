
import { testDatabaseConnection, pool } from "./db.js";

try {
  await testDatabaseConnection();
} catch (error) {
  console.error("Eroare completă:", error);
  console.error("Mesaj:", error.message);
  console.error("Cod:", error.code);
  console.error("Stack:", error.stack);
} finally {
  await pool.end();
}
