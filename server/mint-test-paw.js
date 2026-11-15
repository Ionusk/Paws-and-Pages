import { CdpClient } from "@coinbase/cdp-sdk";
import {
    createMintToInstruction,
    getAccount,
    getAssociatedTokenAddress,
    getMint,
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
const AMOUNT = 500n;
const TREASURY_NAME = "paws-and-pages-devnet-test";

async function main() {
  // 1. Citim wallet-ul utilizatorului din baza de date.
  const result = await pool.query(
    "SELECT solana_wallet_address FROM users WHERE id = $1",
    [USER_ID],
  );

  const userAddress = result.rows[0]?.solana_wallet_address;

  if (!userAddress) {
    throw new Error("Utilizatorul nu are wallet Solana.");
  }

  // 2. Verificăm adresa direct cu CDP.
  const user = await cdp.solana.getOrCreateAccount({
    name: `paw-user-${USER_ID}`,
  });

  if (user.address !== userAddress) {
    throw new Error("Wallet-ul din DB nu corespunde celui din CDP.");
  }

  const treasury = await cdp.solana.getOrCreateAccount({
    name: TREASURY_NAME,
  });

  const mintAddress = new PublicKey(process.env.PAW_TOKEN_MINT_ADDRESS);

  const userPublicKey = new PublicKey(userAddress);
  const treasuryPublicKey = new PublicKey(treasury.address);

  console.log("User wallet:", userAddress);
  console.log("Treasury:", treasury.address);
  console.log("Mint:", mintAddress.toBase58());

  // 3. Verificăm mint authority și decimals.
  const mintInfo = await getMint(connection, mintAddress);

  if (
    !mintInfo.mintAuthority ||
    !mintInfo.mintAuthority.equals(treasuryPublicKey)
  ) {
    throw new Error("Treasury nu este mint authority.");
  }

  if (mintInfo.decimals !== 0) {
    throw new Error("PAW trebuie să aibă 0 decimals.");
  }

  // 4. Derivăm ATA folosind adresa reală din DB.
  const userAta = await getAssociatedTokenAddress(mintAddress, userPublicKey);

  const account = await getAccount(connection, userAta);

  if (!account.owner.equals(userPublicKey)) {
    throw new Error("ATA nu aparține utilizatorului.");
  }

  if (!account.mint.equals(mintAddress)) {
    throw new Error("ATA aparține altui token.");
  }

  console.log("User ATA:", userAta.toBase58());
  console.log("Sold înainte:", account.amount.toString(), "PAW");

  // Protecție împotriva mintării repetate.
  if (account.amount !== 0n) {
    throw new Error(
      "Wallet-ul are deja tokenuri. Mintarea de test a fost oprită.",
    );
  }

  // 5. Construim tranzacția.
  const transaction = new Transaction().add(
    createMintToInstruction(mintAddress, userAta, treasuryPublicKey, AMOUNT),
  );

  transaction.feePayer = treasuryPublicKey;

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  transaction.recentBlockhash = blockhash;

  const serialized = transaction
    .serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })
    .toString("base64");

  // 6. Treasury semnează tranzacția prin CDP.
  const signed = await cdp.solana.signTransaction({
    address: treasury.address,
    transaction: serialized,
  });

  const signature = await connection.sendRawTransaction(
    Buffer.from(signed.signedTransaction, "base64"),
  );

  await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    "confirmed",
  );

  // 7. Verificăm rezultatul direct pe blockchain.
  const updatedAccount = await getAccount(connection, userAta);

  console.log("\nMint finalizat!");
  console.log("Transaction:", signature);
  console.log("Sold după:", updatedAccount.amount.toString(), "PAW");
  console.log(
    "Explorer:",
    `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  );
}

main()
  .catch((error) => {
    console.error("Mint failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
