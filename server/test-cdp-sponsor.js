import { CdpClient } from "@coinbase/cdp-sdk";
import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import "dotenv/config";
import { pool } from "./db.js";

const cdp = new CdpClient();
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function main() {
  const treasury = await cdp.solana.getOrCreateAccount({
    name: "paws-and-pages-devnet-test",
  });

  // User 23 is the account used for our current test.
  // Retrieve the address from PostgreSQL, never hardcode it.
  const result = await pool.query(
    "SELECT solana_wallet_address FROM users WHERE id = $1",
    [23],
  );

  const userAddress = result.rows[0]?.solana_wallet_address;

  if (!userAddress) {
    throw new Error("Wallet-ul utilizatorului nu există.");
  }

  const from = new PublicKey(treasury.address);
  const to = new PublicKey(userAddress);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: from,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: 1,
    }),
  );

  const serialized = transaction
    .serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })
    .toString("base64");

  console.log("Trimit tranzacția cu sponsorizare CDP...");

  const response = await cdp.solana.sendTransaction({
    network: "solana-devnet",
    transaction: serialized,
    useCdpSponsor: true,
    idempotencyKey: "paws-pages-sponsor-test-001",
  });

  const signature = response.transactionSignature ?? response.signature;

  console.log("Signature:", signature);

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(
      `Tranzacția a eșuat: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  const details = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  console.log("Transaction fee:", details?.meta?.fee, "lamports");
  console.log("Transaction error:", details?.meta?.err);
  console.log(
    "Explorer:",
    `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  );
  console.log("Test sponsorizare finalizat.");
}

main()
  .catch((error) => {
    console.error("Sponsor test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
