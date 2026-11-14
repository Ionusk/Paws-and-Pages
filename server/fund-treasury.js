import { CdpClient } from "@coinbase/cdp-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import "dotenv/config";

const cdp = new CdpClient();
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function main() {
  const treasury = await cdp.solana.getOrCreateAccount({
    name: "paws-and-pages-devnet-test",
  });

  console.log("Treasury:", treasury.address);
  console.log(
    "Sold înainte:",
    (await connection.getBalance(new PublicKey(treasury.address))) / 1e9,
    "SOL",
  );

  const result = await cdp.solana.requestFaucet({
    address: treasury.address,
    token: "sol",
  });

  console.log("Faucet result:", result);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log(
    "Sold după:",
    (await connection.getBalance(new PublicKey(treasury.address))) / 1e9,
    "SOL",
  );
}

main().catch(console.error);
