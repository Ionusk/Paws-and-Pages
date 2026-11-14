
import "dotenv/config";

import { CdpClient } from "@coinbase/cdp-sdk";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

import {
  PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";

async function main() {
  const mintAddress = process.env.PAW_TOKEN_MINT_ADDRESS;

  if (!mintAddress) {
    throw new Error("PAW_TOKEN_MINT_ADDRESS is missing from .env");
  }

  const cdp = new CdpClient();

  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const account = await cdp.solana.getOrCreateAccount({
    name: "paws-and-pages-devnet-test",
  });

  const mint = new PublicKey(mintAddress);
  const authority = new PublicKey(account.address);
  const metadataProgramId = new PublicKey(PROGRAM_ID);

  // Derive the metadata PDA for the existing PAW mint.
  const [metadataAddress] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      metadataProgramId.toBuffer(),
      mint.toBuffer(),
    ],
    metadataProgramId
  );

  console.log("PAW mint:", mintAddress);
  console.log("Metadata address:", metadataAddress.toBase58());

  // Never create the same metadata account twice.
  const existingMetadata = await connection.getAccountInfo(
    metadataAddress,
    "confirmed"
  );

  if (existingMetadata) {
    console.log("Metadata already exists. No transaction sent.");
    return;
  }

  // Verify that CDP wallet is the actual mint authority.
  const mintInfo = await connection.getParsedAccountInfo(mint);
  const parsedInfo = mintInfo.value?.data?.parsed?.info;

  if (!parsedInfo) {
    throw new Error("Could not read PAW mint information.");
  }

  if (parsedInfo.mintAuthority !== authority.toBase58()) {
    throw new Error("CDP wallet is not the PAW mint authority.");
  }

  const instruction = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataAddress,
      mint,
      mintAuthority: authority,
      payer: authority,
      updateAuthority: authority,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: "Paw Tokens",
          symbol: "PAW",
          uri: "",
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      },
    }
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: authority,
    recentBlockhash: blockhash,
  }).add(instruction);

  const serialized = Buffer.from(
    transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    })
  ).toString("base64");

  console.log("Requesting CDP signature...");

  const { signature: signedTransaction } =
    await cdp.solana.signTransaction({
      address: account.address,
      transaction: serialized,
    });

  console.log("Sending metadata transaction...");

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

  console.log("\nPAW METADATA CREATED SUCCESSFULLY!");
  console.log("Name: Paw Tokens");
  console.log("Symbol: PAW");
  console.log("Metadata address:", metadataAddress.toBase58());
  console.log("Update authority:", authority.toBase58());
  console.log("Mutable: true");
  console.log(
    "Explorer:",
    `https://explorer.solana.com/address/${metadataAddress.toBase58()}?cluster=devnet`
  );
  console.log(
    "Transaction:",
    `https://explorer.solana.com/tx/${signature}?cluster=devnet`
  );
}

main().catch((error) => {
  console.error("\nMetadata creation failed:");
  console.error(error);
  process.exitCode = 1;
});
