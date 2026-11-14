import "dotenv/config";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { pool } from "./db.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed"
);

const mint = new PublicKey(process.env.PAW_TOKEN_MINT_ADDRESS);
const user = new PublicKey("Gm1C4Cyc3dGHbpwJecAaQYwWvmD1X3GgCMSodHyjwwAx");
const treasury = new PublicKey("25hfCzPZsVEjihcpeCSJaYV3bBgaEsj6GQtqmBcHPEvd");

try {
  console.log("=== SOL BALANCES ===");
  console.log("User SOL:", (await connection.getBalance(user)) / 1e9);
  console.log("Treasury SOL:", (await connection.getBalance(treasury)) / 1e9);

  console.log("\n=== PAW BALANCES ===");
  const userAta = await getAssociatedTokenAddress(mint, user);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);

  console.log("User PAW:", (await getAccount(connection, userAta)).amount.toString());
  console.log("Treasury PAW:", (await getAccount(connection, treasuryAta)).amount.toString());

  console.log("\n=== PENDING PURCHASES ===");
  const result = await pool.query(`
    SELECT id, item_id, status, created_at
    FROM shop_purchases
    WHERE status IN ('pending', 'submitted')
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log(result.rows);
} catch (error) {
  console.error("Verification error:", error);
} finally {
  await pool.end();
}
