import "dotenv/config";

import { CdpClient } from "@coinbase/cdp-sdk";
import { pool } from "./db.js";

const cdp = new CdpClient();

const PAW_MINT = process.env.PAW_TOKEN_MINT_ADDRESS;

if (!PAW_MINT) {
  throw new Error("PAW_TOKEN_MINT_ADDRESS lipsește din server/.env");
}

// Păstrăm explicit Devnet pentru MVP.
const SOLANA_NETWORK = "solana-devnet";

// --------------------------------------------------
// CREATE OR RETRIEVE USER WALLET
// --------------------------------------------------

export async function getOrCreateUserWallet(userId) {
  if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
    throw new Error("ID-ul utilizatorului este invalid.");
  }

  const normalizedUserId = Number(userId);

  // Verificăm dacă utilizatorul are deja un wallet.
  const existingUser = await pool.query(
    `
    SELECT id, solana_wallet_address
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [normalizedUserId],
  );

  if (existingUser.rows.length === 0) {
    throw new Error("Utilizatorul nu există în baza de date.");
  }

  const existingAddress = existingUser.rows[0].solana_wallet_address;

  if (existingAddress) {
    return existingAddress;
  }

  // Numele este determinist: același utilizator primește
  // întotdeauna același wallet CDP.
  const account = await cdp.solana.getOrCreateAccount({
    name: `paw-user-${normalizedUserId}`,
  });

  if (!account?.address) {
    throw new Error("Coinbase CDP nu a returnat o adresă Solana.");
  }

  // Asociem wallet-ul cu utilizatorul din PostgreSQL.
  const updateResult = await pool.query(
    `
    UPDATE users
    SET solana_wallet_address = $1,
        updated_at = NOW()
    WHERE id = $2
      AND solana_wallet_address IS NULL
    RETURNING solana_wallet_address
    `,
    [account.address, normalizedUserId],
  );

  // Dacă o altă cerere a salvat deja adresa,
  // folosim adresa existentă.
  if (updateResult.rows.length === 0) {
    const latestUser = await pool.query(
      `
      SELECT solana_wallet_address
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [normalizedUserId],
    );

    const savedAddress = latestUser.rows[0]?.solana_wallet_address;

    if (!savedAddress) {
      throw new Error("Nu am putut salva adresa wallet-ului.");
    }

    return savedAddress;
  }

  console.log(
    `Wallet Solana creat pentru user ${normalizedUserId}:`,
    account.address,
  );

  return account.address;
}

// --------------------------------------------------
// GET PAW TOKEN BALANCE
// --------------------------------------------------

export async function getPawBalance(walletAddress) {
  if (!walletAddress) {
    throw new Error("Adresa wallet-ului lipsește.");
  }

  let pageToken;
  let pawBalance = 0n;

  do {
    const response = await cdp.solana.listTokenBalances({
      address: walletAddress,
      network: SOLANA_NETWORK,
      pageSize: 100,
      ...(pageToken ? { pageToken } : {}),
    });

    for (const balance of response.balances || []) {
      if (balance.token?.mintAddress === PAW_MINT) {
        pawBalance += BigInt(balance.amount.amount);
      }
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  // PAW are 0 decimals, deci soldul este un număr întreg.
  return pawBalance.toString();
}
