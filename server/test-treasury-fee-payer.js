import { CdpClient } from "@coinbase/cdp-sdk";
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
} from "@solana/web3.js";
import "dotenv/config";
import { pool } from "./db.js";

const cdp = new CdpClient();
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const MEMO_PROGRAM = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

async function main() {
  const treasury = await cdp.solana.getOrCreateAccount({
    name: "paws-and-pages-devnet-test",
  });

  const result = await pool.query(
    "SELECT solana_wallet_address FROM users WHERE id = $1",
    [23],
  );

  const userAddress = result.rows[0]?.solana_wallet_address;

  if (!userAddress) {
    throw new Error("Wallet-ul utilizatorului nu există.");
  }

  const treasuryAddress = new PublicKey(treasury.address);
  const user = new PublicKey(userAddress);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: treasuryAddress,
    recentBlockhash: blockhash,
  }).add(
    new TransactionInstruction({
      programId: MEMO_PROGRAM,
      keys: [
        { pubkey: user, isSigner: true, isWritable: false },
        { pubkey: treasuryAddress, isSigner: true, isWritable: false },
      ],
      data: Buffer.from("Paws & Pages fee payer test"),
    }),
  );

  const serialized = transaction
    .serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })
    .toString("base64");

  // First signature: user authorizes the instruction.
  const userSigned = await cdp.solana.signTransaction({
    address: userAddress,
    transaction: serialized,
  });

  // Second signature: treasury authorizes paying the fee.
  const treasurySigned = await cdp.solana.signTransaction({
    address: treasury.address,
    transaction: userSigned.signedTransaction,
  });

  const fullySigned = Transaction.from(
    Buffer.from(treasurySigned.signedTransaction, "base64"),
  );

  if (!fullySigned.verifySignatures()) {
    throw new Error("Semnăturile tranzacției nu sunt valide.");
  }

  console.log("Ambele semnături sunt valide.");
  console.log("Fee payer:", fullySigned.feePayer.toBase58());

  const signature = await connection.sendRawTransaction(
    Buffer.from(treasurySigned.signedTransaction, "base64"),
    { preflightCommitment: "confirmed" },
  );

  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  if (confirmation.value.err) {
    throw new Error(JSON.stringify(confirmation.value.err));
  }

  const details = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  console.log("Transaction:", signature);
  console.log("Fee:", details?.meta?.fee, "lamports");
  console.log(
    "Explorer:",
    `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  );
  console.log("Fee payer test successful!");
}

main()
  .catch((error) => {
    console.error("Fee payer test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
