import { CdpClient } from "@coinbase/cdp-sdk";
import {
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import "dotenv/config";
import { pool } from "./db.js";

const cdp = new CdpClient();
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

// Usage: node <script> [userId]   (default: 23)
const USER_ID = Number(process.argv[2] ?? 23);
if (!Number.isInteger(USER_ID) || USER_ID <= 0) {
  throw new Error("userId invalid.");
}
const TREASURY_NAME = "paws-and-pages-devnet-test";

async function main() {
  const result = await pool.query(
    `SELECT solana_wallet_address FROM users WHERE id = $1`,
    [USER_ID],
  );

  const userAddress = result.rows[0]?.solana_wallet_address;

  if (!userAddress) {
    throw new Error("Utilizatorul nu are un wallet Solana.");
  }

  const treasury = await cdp.solana.getOrCreateAccount({
    name: TREASURY_NAME,
  });

  const user = new PublicKey(userAddress);
  const treasuryPublicKey = new PublicKey(treasury.address);
  const mint = new PublicKey(process.env.PAW_TOKEN_MINT_ADDRESS);

  const userAta = await getAssociatedTokenAddress(mint, user);

  console.log("User wallet:", userAddress);
  console.log("Treasury:", treasury.address);
  console.log("User ATA:", userAta.toBase58());

  const existingAccount = await connection.getAccountInfo(userAta);

  if (existingAccount) {
    console.log("ATA există deja. Nu este nevoie să îl recreăm.");
    return;
  }

  const rent = await connection.getMinimumBalanceForRentExemption(165);
  const treasuryBalance = await connection.getBalance(treasuryPublicKey);

  console.log("Rent necesar:", rent / 1e9, "SOL");
  console.log("Treasury balance:", treasuryBalance / 1e9, "SOL");

  if (treasuryBalance < rent + 10000) {
    throw new Error("Treasury nu are suficient SOL pentru creare.");
  }

  const transaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      treasuryPublicKey,
      userAta,
      user,
      mint,
    ),
  );

  transaction.feePayer = treasuryPublicKey;
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  transaction.recentBlockhash = blockhash;

  const serialized = transaction
    .serialize({ requireAllSignatures: false })
    .toString("base64");

  const signed = await cdp.solana.signTransaction({
    address: treasury.address,
    transaction: serialized,
  });

  const signature = await connection.sendRawTransaction(
    Buffer.from(signed.signedTransaction, "base64"),
  );

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  console.log("ATA creat cu succes!");
  console.log("Transaction:", signature);
  console.log("ATA:", userAta.toBase58());

  const finalBalance = await connection.getBalance(treasuryPublicKey);
  console.log("Treasury balance după:", finalBalance / 1e9, "SOL");
}

main()
  .catch(console.error)
  .finally(() => pool.end());
