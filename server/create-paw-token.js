
import "dotenv/config";

import { CdpClient } from "@coinbase/cdp-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
} from "@solana/spl-token";

async function main() {
  if (process.env.PAW_TOKEN_MINT_ADDRESS) {
    throw new Error(
      "PAW mint already configured. Refusing to create another token."
    );
  }

  const cdp = new CdpClient();
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const authority = await cdp.solana.getOrCreateAccount({
    name: "paws-and-pages-devnet-test",
  });

  const authorityPublicKey = new PublicKey(authority.address);

  console.log("Mint authority:", authority.address);
  console.log("Generating token mint account...");

  const mintKeypair = Keypair.generate();

  const rent = await connection.getMinimumBalanceForRentExemption(
    MINT_SIZE
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: authorityPublicKey,
    recentBlockhash: blockhash,
  });

  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: authorityPublicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: rent,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      0,
      authorityPublicKey,
      null,
      TOKEN_PROGRAM_ID
    )
  );

  // The mint account signs locally.
  // CDP signs as the fee payer and mint authority.
  transaction.partialSign(mintKeypair);

  const serialized = Buffer.from(
    transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })
  ).toString("base64");

  console.log("Requesting CDP signature...");

  const { signature: signedTransaction } =
    await cdp.solana.signTransaction({
      address: authority.address,
      transaction: serialized,
    });

  console.log("Broadcasting transaction...");

  const signature = await connection.sendRawTransaction(
    Buffer.from(signedTransaction, "base64")
  );

  await connection.confirmTransaction(
    {
      signature,
      blockhash,
      lastValidBlockHeight,
    },
    "confirmed"
  );

  console.log("\nPAW TOKEN CREATED SUCCESSFULLY!");
  console.log("Mint address:", mintKeypair.publicKey.toBase58());
  console.log("Decimals: 0");
  console.log("Initial supply: 0");
  console.log("Mint authority:", authority.address);
  console.log(
    "Explorer:",
    `https://explorer.solana.com/address/${mintKeypair.publicKey.toBase58()}?cluster=devnet`
  );
  console.log(
    "Transaction:",
    `https://explorer.solana.com/tx/${signature}?cluster=devnet`
  );

  console.log(
    "\nIMPORTANT: Save the mint address. Do not run this script again."
  );
}

main().catch((error) => {
  console.error("\nPAW token creation failed:");
  console.error(error);
  process.exitCode = 1;
});
