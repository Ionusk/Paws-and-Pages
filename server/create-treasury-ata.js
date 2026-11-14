import { CdpClient } from "@coinbase/cdp-sdk";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAccount,
    getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import "dotenv/config";

const RPC_URL = "https://api.devnet.solana.com";
const MINT_ADDRESS = process.env.PAW_TOKEN_MINT_ADDRESS;

const cdp = new CdpClient();
const connection = new Connection(RPC_URL, "confirmed");

async function main() {
  if (!MINT_ADDRESS) {
    throw new Error("PAW_TOKEN_MINT_ADDRESS lipsește din .env");
  }

  // Retrieve the existing project treasury.
  const treasury = await cdp.solana.getOrCreateAccount({
    name: "paws-and-pages-devnet-test",
  });

  const payer = new PublicKey(treasury.address);
  const mint = new PublicKey(MINT_ADDRESS);

  const ata = await getAssociatedTokenAddress(
    mint,
    payer,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Never create the ATA twice.
  const existingAccount = await connection.getAccountInfo(ata);

  if (existingAccount) {
    const tokenAccount = await getAccount(connection, ata);

    console.log("Treasury ATA există deja.");
    console.log("ATA:", ata.toBase58());
    console.log("Mint:", tokenAccount.mint.toBase58());
    console.log("Owner:", tokenAccount.owner.toBase58());
    return;
  }

  const rent = await connection.getMinimumBalanceForRentExemption(165);
  const balance = await connection.getBalance(payer);

  console.log("Treasury:", payer.toBase58());
  console.log("SOL disponibil:", balance / 1e9);
  console.log("Rent necesar:", rent / 1e9);

  if (balance < rent + 10_000) {
    throw new Error(
      "Treasury nu are suficient SOL pentru crearea ATA și comision.",
    );
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: payer,
    recentBlockhash: blockhash,
  }).add(
    createAssociatedTokenAccountInstruction(
      payer,
      ata,
      payer,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );

  // CDP signs the transaction using the project's treasury wallet.
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  const { signedTransaction } = await cdp.solana.signTransaction({
    address: treasury.address,
    transaction: serialized.toString("base64"),
  });

  // Submit the signed transaction to Solana Devnet.
  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTransaction, "base64"),
    { preflightCommitment: "confirmed" },
  );

  console.log("Tranzacție trimisă:", signature);

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  const tokenAccount = await getAccount(connection, ata);

  console.log("\nATA creat cu succes!");
  console.log("Address:", ata.toBase58());
  console.log("Mint:", tokenAccount.mint.toBase58());
  console.log("Owner:", tokenAccount.owner.toBase58());
  console.log(
    "Explorer:",
    `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  );
}

main().catch((error) => {
  console.error("Eroare la crearea treasury ATA:", error);
  process.exitCode = 1;
});
