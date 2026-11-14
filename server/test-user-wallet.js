import "dotenv/config";

import { getOrCreateUserWallet, getPawBalance } from "./solana.js";

async function main() {
  // Folosim temporar utilizatorul cu ID-ul 1.
  const userId = 1;

  console.log("Creating/retrieving user wallet...");

  const address = await getOrCreateUserWallet(userId);

  console.log("Wallet address:", address);

  console.log("Reading PAW balance...");

  const balance = await getPawBalance(address);

  console.log("PAW balance:", balance);
}

main()
  .catch((error) => {
    console.error("Wallet test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { pool } = await import("./db.js");
    await pool.end();
  });
