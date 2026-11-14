
import "dotenv/config";
import { CdpClient } from "@coinbase/cdp-sdk";

async function main() {
  const cdp = new CdpClient();

  const account = await cdp.solana.getOrCreateAccount({
    name: "paws-and-pages-devnet-test",
  });

  console.log("Wallet:", account.address);
  console.log("Requesting Devnet SOL...");

  const result = await cdp.solana.requestFaucet({
    address: account.address,
    token: "sol",
  });

  console.log("Faucet result:", result);
  console.log("Wallet funded successfully!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});
