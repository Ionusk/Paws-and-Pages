import "dotenv/config";
import { CdpClient } from "@coinbase/cdp-sdk";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

import { pool } from "./db.js";
import { getOrCreateUserWallet } from "./solana.js";

// Give test PAW (Solana Devnet) to users, by email.
// Usage: node grant-paw.js <amount> <email> [email ...]
//        node grant-paw.js --check <email> [email ...]   (no transactions)

const TREASURY_NAME = "paws-and-pages-devnet-test";
const ATA_SIZE = 165;

const args = process.argv.slice(2);
const checkOnly = args[0] === "--check";
const amount = checkOnly ? 0n : BigInt(args[0] ?? "0");
const emails = args.slice(1);

if ((!checkOnly && amount <= 0n) || emails.length === 0) {
  console.log("Usage: node grant-paw.js <amount> <email> [email ...]");
  process.exit(1);
}

const cdp = new CdpClient();
const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed"
);
const mint = new PublicKey(process.env.PAW_TOKEN_MINT_ADDRESS);

async function main() {
  const treasury = await cdp.solana.getOrCreateAccount({ name: TREASURY_NAME });
  const treasuryKey = new PublicKey(treasury.address);
  const mintInfo = await getMint(connection, mint, "confirmed");

  if (!mintInfo.mintAuthority?.equals(treasuryKey)) {
    throw new Error("Treasury is not the PAW mint authority.");
  }

  const [treasurySol, minimum, ataRent] = await Promise.all([
    connection.getBalance(treasuryKey),
    connection.getMinimumBalanceForRentExemption(0),
    connection.getMinimumBalanceForRentExemption(ATA_SIZE),
  ]);

  console.log(`Treasury SOL: ${treasurySol / 1e9} (must keep ${minimum / 1e9}, new token account costs ${ataRent / 1e9})`);

  let budget = treasurySol - minimum;

  for (const email of emails) {
    const found = await pool.query(
      "SELECT id, username FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [email]
    );
    const user = found.rows[0];

    if (!user) {
      console.log(`\n${email}: no such user in TigerData, skipped`);
      continue;
    }

    const walletAddress = await getOrCreateUserWallet(user.id);
    const owner = new PublicKey(walletAddress);
    const ata = await getAssociatedTokenAddress(mint, owner);
    const ataExists = Boolean(await connection.getAccountInfo(ata));
    const before = ataExists ? (await getAccount(connection, ata)).amount : 0n;

    console.log(`\n${email} (user ${user.id}, ${user.username ?? "no username"})`);
    console.log(`  wallet ${walletAddress} | token account ${ataExists ? "exists" : "missing"} | balance ${before} PAW`);

    if (checkOnly) continue;

    const needed = (ataExists ? 0 : ataRent) + 10000;

    if (budget < needed) {
      console.log(`  NOT ENOUGH SOL in treasury (needs ${needed / 1e9}). Run: node fund-treasury.js`);
      continue;
    }

    const transaction = new Transaction();

    if (!ataExists) {
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction(treasuryKey, ata, owner, mint)
      );
    }

    transaction.add(createMintToInstruction(mint, ata, treasuryKey, amount));

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = treasuryKey;
    transaction.recentBlockhash = blockhash;

    const signed = await cdp.solana.signTransaction({
      address: treasury.address,
      transaction: transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64"),
    });

    const signature = await connection.sendRawTransaction(
      Buffer.from(signed.signedTransaction, "base64")
    );

    const result = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    if (result.value.err) {
      console.log("  FAILED on Solana:", JSON.stringify(result.value.err));
      continue;
    }

    budget -= needed;
    const after = (await getAccount(connection, ata)).amount;
    console.log(`  +${amount} PAW -> balance ${after} PAW`);
    console.log(`  https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  }
}

main()
  .catch((error) => {
    console.error("grant-paw failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    console.log("\nDONE");
    process.exit();
  });
