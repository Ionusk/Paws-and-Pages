import "dotenv/config";

import { CdpClient } from "@coinbase/cdp-sdk";
import { Router } from "express";
import { pool } from "./db.js";

import { Connection, PublicKey, Transaction } from "@solana/web3.js";

import {
    createTransferCheckedInstruction,
    getAccount,
    getAssociatedTokenAddress,
    getMint,
} from "@solana/spl-token";

// --------------------------------------------------
// CONFIG
// --------------------------------------------------

if (!process.env.PAW_TOKEN_MINT_ADDRESS) {
  throw new Error("PAW_TOKEN_MINT_ADDRESS lipsește din .env");
}

const cdp = new CdpClient();

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed",
);

const PAW_MINT = new PublicKey(process.env.PAW_TOKEN_MINT_ADDRESS);

const TREASURY_ACCOUNT_NAME = "paws-and-pages-devnet-test";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function encodeBase58(buffer) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  let zeros = 0;

  while (zeros < buffer.length && buffer[zeros] === 0) {
    zeros++;
  }

  const hex = Buffer.from(buffer).toString("hex");
  let value = BigInt(`0x${hex || "0"}`);
  let encoded = "";

  while (value > 0n) {
    const remainder = Number(value % 58n);
    value /= 58n;
    encoded = alphabet[remainder] + encoded;
  }

  return "1".repeat(zeros) + encoded;
}

async function getAuthenticatedUser(auth0Id) {
  const result = await pool.query(
    `
    SELECT id, solana_wallet_address
    FROM users
    WHERE auth0_id = $1
    LIMIT 1
    `,
    [auth0Id],
  );

  return result.rows[0] || null;
}

async function getTreasury() {
  const account = await cdp.solana.getOrCreateAccount({
    name: TREASURY_ACCOUNT_NAME,
  });

  if (!account?.address) {
    throw new Error("Wallet-ul treasury nu este disponibil.");
  }

  return account;
}

async function getUserCdpWallet(userId, expectedAddress) {
  const account = await cdp.solana.getOrCreateAccount({
    name: `paw-user-${userId}`,
  });

  if (!account?.address || account.address !== expectedAddress) {
    throw new Error(
      "Wallet-ul CDP nu corespunde wallet-ului salvat în baza de date.",
    );
  }

  return account;
}

// --------------------------------------------------
// STRICT TRANSACTION VALIDATION
// --------------------------------------------------

function assertExpectedTransferTransaction(
  tx,
  {
    userAddress,
    treasuryAddress,
    userAta,
    treasuryAta,
    amount,
    decimals,
    expectedSignature = null,
  },
) {
  if (!tx.feePayer?.equals(treasuryAddress)) {
    throw new Error("Fee payer-ul tranzacției nu este treasury-ul.");
  }

  if (tx.instructions.length !== 1) {
    throw new Error("Tranzacția conține instrucțiuni neașteptate.");
  }

  const expectedInstruction = createTransferCheckedInstruction(
    userAta,
    PAW_MINT,
    treasuryAta,
    userAddress,
    amount,
    decimals,
  );

  const actualInstruction = tx.instructions[0];

  const sameKeys =
    actualInstruction.keys.length === expectedInstruction.keys.length &&
    actualInstruction.keys.every((key, index) => {
      const expectedKey = expectedInstruction.keys[index];

      return (
        key.pubkey.equals(expectedKey.pubkey) &&
        key.isSigner === expectedKey.isSigner &&
        key.isWritable === expectedKey.isWritable
      );
    });

  const sameInstruction =
    actualInstruction.programId.equals(expectedInstruction.programId) &&
    sameKeys &&
    actualInstruction.data.equals(expectedInstruction.data);

  if (!sameInstruction) {
    throw new Error(
      "Instrucțiunea tranzacției nu corespunde transferului PAW autorizat.",
    );
  }

  if (!tx.verifySignatures()) {
    throw new Error("Semnăturile tranzacției sunt invalide.");
  }

  const userSignature = tx.signatures.find((entry) =>
    entry.publicKey.equals(userAddress),
  )?.signature;

  const treasurySignature = tx.signatures.find((entry) =>
    entry.publicKey.equals(treasuryAddress),
  )?.signature;

  if (!userSignature || !treasurySignature) {
    throw new Error("Lipsește semnătura utilizatorului sau a treasury-ului.");
  }

  const actualSignature = encodeBase58(treasurySignature);

  if (expectedSignature && actualSignature !== expectedSignature) {
    throw new Error("Semnătura tranzacției nu corespunde celei salvate.");
  }

  return actualSignature;
}

// --------------------------------------------------
// VERIFY CONFIRMED TRANSFER
// --------------------------------------------------

async function verifyTransfer(
  signature,
  source,
  destination,
  amount,
  authority,
  decimals,
) {
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction) {
    throw new Error("Tranzacția nu a putut fi verificată.");
  }

  if (transaction.meta?.err) {
    throw new Error("Tranzacția Solana a eșuat.");
  }

  const instructions = transaction.transaction.message.instructions;

  if (instructions.length !== 1) {
    throw new Error("Tranzacția confirmată conține instrucțiuni neașteptate.");
  }

  const instruction = instructions[0];

  if (!instruction.parsed || instruction.program !== "spl-token") {
    throw new Error("Instrucțiunea confirmată nu este un transfer SPL Token.");
  }

  const { type, info } = instruction.parsed;

  const validTransfer =
    type === "transferChecked" &&
    info.mint === PAW_MINT.toBase58() &&
    info.source === source.toBase58() &&
    info.destination === destination.toBase58() &&
    info.authority === authority.toBase58() &&
    info.tokenAmount?.amount === amount.toString() &&
    info.tokenAmount?.decimals === decimals;

  if (!validTransfer) {
    throw new Error("Transferul confirmat nu corespunde achiziției.");
  }

  return true;
}

// --------------------------------------------------
// FINALIZE PURCHASE
// --------------------------------------------------

async function finalizePurchase(purchaseId, userId, itemId) {
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    const purchaseResult = await client.query(
      `
      SELECT *
      FROM shop_purchases
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [purchaseId, userId],
    );

    const purchase = purchaseResult.rows[0];

    if (!purchase) {
      throw new Error("Achiziția nu există.");
    }

    if (purchase.status === "confirmed") {
      await client.query("COMMIT");
      transactionOpen = false;
      return;
    }

    if (purchase.status !== "submitted") {
      throw new Error("Achiziția nu este pregătită pentru confirmare.");
    }

    await client.query(
      `
      INSERT INTO user_inventory (
        user_id,
        item_id,
        is_equipped,
        purchase_id
      )
      VALUES ($1, $2, FALSE, $3)
      ON CONFLICT (user_id, item_id) DO NOTHING
      `,
      [userId, itemId, purchaseId],
    );

    await client.query(
      `
      UPDATE shop_purchases
      SET status = 'confirmed',
          confirmed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      `,
      [purchaseId],
    );

    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }

    throw error;
  } finally {
    client.release();
  }
}

// --------------------------------------------------
// RECOVER SUBMITTED PURCHASE
// --------------------------------------------------

async function recoverSubmittedPurchase(purchase, user) {
  if (
    purchase.status !== "submitted" ||
    !purchase.tx_signature ||
    !purchase.signed_transaction ||
    purchase.last_valid_block_height == null
  ) {
    return {
      status: "pending",
      message: "Achiziția nu are toate datele necesare recuperării.",
    };
  }

  const signature = purchase.tx_signature;

  // Reconstruim și validăm tranzacția salvată.
  const rawTransaction = Buffer.from(purchase.signed_transaction, "base64");

  if (
    rawTransaction.length === 0 ||
    rawTransaction.toString("base64") !== purchase.signed_transaction
  ) {
    throw new Error("Tranzacția salvată nu este un Base64 valid.");
  }

  const savedTransaction = Transaction.from(rawTransaction);

  const userAddress = new PublicKey(user.solana_wallet_address);

  const treasury = await getTreasury();
  const treasuryAddress = new PublicKey(treasury.address);

  const userAta = await getAssociatedTokenAddress(PAW_MINT, userAddress);

  const treasuryAta = await getAssociatedTokenAddress(
    PAW_MINT,
    treasuryAddress,
  );

  const mintInfo = await getMint(connection, PAW_MINT, "confirmed");

  assertExpectedTransferTransaction(savedTransaction, {
    userAddress,
    treasuryAddress,
    userAta,
    treasuryAta,
    amount: BigInt(purchase.amount),
    decimals: mintInfo.decimals,
    expectedSignature: signature,
  });

  // Verificăm istoricul tranzacției.
  const statuses = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });

  const transactionStatus = statuses.value[0];

  // Dacă Solana a confirmat eșecul, verificăm și tranzacția.
  if (transactionStatus?.err) {
    if (
      transactionStatus.confirmationStatus !== "confirmed" &&
      transactionStatus.confirmationStatus !== "finalized"
    ) {
      return {
        status: "pending",
        signature,
        message: "Tranzacția are un rezultat încă nefinalizat.",
      };
    }

    const failedTransaction = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!failedTransaction?.meta?.err) {
      return {
        status: "pending",
        signature,
        message: "Nu putem confirma încă eșecul tranzacției.",
      };
    }

    await pool.query(
      `
      UPDATE shop_purchases
      SET status = 'failed',
          error_message = $1,
          updated_at = NOW()
      WHERE id = $2
        AND status = 'submitted'
      `,
      ["Tranzacția a eșuat pe Solana.", purchase.id],
    );

    return {
      status: "failed",
      signature,
      message: "Tranzacția a eșuat pe Solana.",
    };
  }

  // Dacă este confirmată, verificăm transferul real.
  if (
    transactionStatus?.confirmationStatus === "confirmed" ||
    transactionStatus?.confirmationStatus === "finalized"
  ) {
    await verifyTransfer(
      signature,
      userAta,
      treasuryAta,
      BigInt(purchase.amount),
      userAddress,
      mintInfo.decimals,
    );

    await finalizePurchase(purchase.id, user.id, purchase.item_id);

    return {
      status: "confirmed",
      signature,
    };
  }

  // Dacă este deja procesată, nu retransmitem.
  if (transactionStatus) {
    return {
      status: "pending",
      signature,
      message: "Tranzacția este încă în procesare.",
    };
  }

  // Verificăm dacă blockhash-ul este încă valid.
  const currentBlockHeight = await connection.getBlockHeight("confirmed");

  const lastValidBlockHeight = Number(purchase.last_valid_block_height);

  if (!Number.isSafeInteger(lastValidBlockHeight)) {
    throw new Error("last_valid_block_height invalid.");
  }

  // După expirare nu creăm o tranzacție nouă.
  // Istoricul RPC poate fi incomplet.
  if (currentBlockHeight > lastValidBlockHeight) {
    return {
      status: "pending",
      signature,
      message:
        "Blockhash-ul a expirat, dar rezultatul tranzacției nu este încă verificabil.",
    };
  }

  // Retrimitem exact tranzacția semnată anterior.
  const broadcastSignature = await connection.sendRawTransaction(
    rawTransaction,
    {
      preflightCommitment: "confirmed",
    },
  );

  if (broadcastSignature !== signature) {
    throw new Error("Semnătura retransmisă nu corespunde.");
  }

  return {
    status: "pending",
    signature,
    message: "Tranzacția semnată a fost retrimisă.",
  };
}

// --------------------------------------------------
// CREATE ROUTER
// --------------------------------------------------

export function createShopRouter({ requireAuth }) {
  const router = Router();

  router.use(requireAuth);

  // ------------------------------------------------
  // GET SHOP CATALOG + USER INVENTORY
  // ------------------------------------------------

  router.get("/", async (req, res) => {
    try {
      const auth0Id = req.auth?.payload?.sub;

      if (!auth0Id) {
        return res.status(401).json({
          error: "Utilizator neautentificat.",
        });
      }

      const user = await getAuthenticatedUser(auth0Id);

      if (!user) {
        return res.status(404).json({
          error: "Utilizatorul nu există.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          s.id,
          s.name,
          s.description,
          s.price,
          s.is_active,
          CASE
            WHEN i.item_id IS NOT NULL THEN TRUE
            ELSE FALSE
          END AS owned,
          COALESCE(i.is_equipped, FALSE) AS equipped
        FROM shop_items s
        LEFT JOIN user_inventory i
          ON i.item_id = s.id
          AND i.user_id = $1
        WHERE s.is_active = TRUE
        ORDER BY s.price ASC
        `,
        [user.id],
      );

      return res.json({
        success: true,
        items: result.rows,
      });
    } catch (error) {
      console.error("Shop catalog error:", error);

      return res.status(500).json({
        error: "Nu am putut încărca magazinul.",
      });
    }
  });

  // ------------------------------------------------
  // PURCHASE SKIN
  // ------------------------------------------------

  router.post("/purchase", async (req, res) => {
    let purchaseId = null;
    let signature = null;
    let price = null;

    try {
      const auth0Id = req.auth?.payload?.sub;
      const { itemId, idempotencyKey } = req.body || {};

      if (!auth0Id) {
        return res.status(401).json({
          error: "Utilizator neautentificat.",
        });
      }

      if (typeof itemId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(itemId)) {
        return res.status(400).json({
          error: "ID-ul skin-ului este invalid.",
        });
      }

      if (
        typeof idempotencyKey !== "string" ||
        !/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)
      ) {
        return res.status(400).json({
          error: "Cheia de idempotency este invalidă.",
        });
      }

      const user = await getAuthenticatedUser(auth0Id);

      if (!user?.solana_wallet_address) {
        return res.status(404).json({
          error: "Wallet-ul utilizatorului nu există.",
        });
      }

      // --------------------------------------------
      // DATABASE RESERVATION
      // --------------------------------------------

      let client = await pool.connect();
      let dbTransactionOpen = false;

      try {
        await client.query("BEGIN");
        dbTransactionOpen = true;

        // Serializăm achizițiile utilizatorului.
        await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [
          user.id,
        ]);

        const existingPurchase = await client.query(
          `
          SELECT *
          FROM shop_purchases
          WHERE user_id = $1
            AND idempotency_key = $2
          `,
          [user.id, idempotencyKey],
        );

        if (existingPurchase.rows.length > 0) {
          const existing = existingPurchase.rows[0];

          // Aceeași cheie nu poate fi reutilizată pentru alt skin.
          if (existing.item_id !== itemId) {
            await client.query("COMMIT");
            dbTransactionOpen = false;

            client.release();
            client = null;

            return res.status(409).json({
              error:
                "Cheia de idempotency a fost deja folosită pentru alt skin.",
            });
          }

          await client.query("COMMIT");
          dbTransactionOpen = false;

          // Eliberăm conexiunea înainte de apelurile Solana.
          client.release();
          client = null;

          if (existing.status === "confirmed") {
            return res.json({
              success: true,
              alreadyProcessed: true,
              signature: existing.tx_signature,
            });
          }

          if (existing.status === "submitted") {
            const recovery = await recoverSubmittedPurchase(existing, user);

            if (recovery.status === "confirmed") {
              return res.json({
                success: true,
                alreadyProcessed: true,
                signature: recovery.signature,
              });
            }

            if (recovery.status === "failed") {
              return res.status(409).json({
                success: false,
                error: recovery.message,
                status: "failed",
                signature: recovery.signature,
              });
            }

            return res.status(202).json({
              success: false,
              pendingConfirmation: true,
              error: recovery.message,
              status: "submitted",
              signature: existing.tx_signature,
            });
          }

          return res.status(409).json({
            error: "Achiziția existentă nu poate fi reluată automat.",
            status: existing.status,
            signature: existing.tx_signature,
          });
        }

        const itemResult = await client.query(
          `
          SELECT id, name, price
          FROM shop_items
          WHERE id = $1
            AND is_active = TRUE
          FOR SHARE
          `,
          [itemId],
        );

        if (itemResult.rows.length === 0) {
          await client.query("ROLLBACK");
          dbTransactionOpen = false;

          return res.status(404).json({
            error: "Skin-ul nu există sau nu este disponibil.",
          });
        }

        const item = itemResult.rows[0];

        price = BigInt(item.price);

        if (price <= 0n) {
          await client.query("ROLLBACK");
          dbTransactionOpen = false;

          return res.status(400).json({
            error: "Skin-ul gratuit nu necesită o achiziție.",
          });
        }

        const owned = await client.query(
          `
          SELECT 1
          FROM user_inventory
          WHERE user_id = $1
            AND item_id = $2
          `,
          [user.id, itemId],
        );

        if (owned.rows.length > 0) {
          await client.query("ROLLBACK");
          dbTransactionOpen = false;

          return res.status(409).json({
            error: "Deții deja acest skin.",
          });
        }

        const pending = await client.query(
          `
          SELECT id
          FROM shop_purchases
          WHERE user_id = $1
            AND item_id = $2
            AND status IN ('pending', 'submitted')
          LIMIT 1
          `,
          [user.id, itemId],
        );

        if (pending.rows.length > 0) {
          await client.query("ROLLBACK");
          dbTransactionOpen = false;

          return res.status(409).json({
            error: "Există deja o achiziție în procesare pentru acest skin.",
          });
        }

        const insertResult = await client.query(
          `
          INSERT INTO shop_purchases (
            user_id,
            item_id,
            amount,
            status,
            idempotency_key
          )
          VALUES ($1, $2, $3, 'pending', $4)
          RETURNING id
          `,
          [user.id, itemId, price.toString(), idempotencyKey],
        );

        purchaseId = insertResult.rows[0].id;

        await client.query("COMMIT");
        dbTransactionOpen = false;

        // Eliberăm conexiunea înainte de apelurile externe.
        client.release();
        client = null;
      } catch (error) {
        if (client && dbTransactionOpen) {
          await client.query("ROLLBACK").catch(() => {});
          dbTransactionOpen = false;
        }

        throw error;
      } finally {
        if (client) {
          client.release();
        }
      }

      // --------------------------------------------
      // SOLANA TRANSFER
      // --------------------------------------------

      const userAddress = new PublicKey(user.solana_wallet_address);

      const treasury = await getTreasury();
      const treasuryAddress = new PublicKey(treasury.address);

      const userCdpWallet = await getUserCdpWallet(
        user.id,
        user.solana_wallet_address,
      );

      const mintInfo = await getMint(connection, PAW_MINT, "confirmed");

      const userAta = await getAssociatedTokenAddress(PAW_MINT, userAddress);

      const treasuryAta = await getAssociatedTokenAddress(
        PAW_MINT,
        treasuryAddress,
      );

      const [userTokenAccount, treasuryTokenAccount] = await Promise.all([
        getAccount(connection, userAta, "confirmed"),
        getAccount(connection, treasuryAta, "confirmed"),
      ]);

      if (
        userTokenAccount.owner.toBase58() !== userAddress.toBase58() ||
        userTokenAccount.mint.toBase58() !== PAW_MINT.toBase58()
      ) {
        throw new Error("Contul PAW al utilizatorului este invalid.");
      }

      if (
        treasuryTokenAccount.owner.toBase58() !== treasuryAddress.toBase58() ||
        treasuryTokenAccount.mint.toBase58() !== PAW_MINT.toBase58()
      ) {
        throw new Error("Contul PAW al treasury-ului este invalid.");
      }

      if (userTokenAccount.amount < price) {
        throw new Error("Nu ai suficiente PAW pentru acest skin.");
      }

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      const instruction = createTransferCheckedInstruction(
        userAta,
        PAW_MINT,
        treasuryAta,
        userAddress,
        price,
        mintInfo.decimals,
      );

      const transaction = new Transaction({
        feePayer: treasuryAddress,
        recentBlockhash: blockhash,
      }).add(instruction);

      const serialized = transaction
        .serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })
        .toString("base64");

      // Utilizatorul autorizează transferul.
      const userSigned = await cdp.solana.signTransaction({
        address: userCdpWallet.address,
        transaction: serialized,
      });

      // Treasury-ul plătește taxa Solana.
      const treasurySigned = await cdp.solana.signTransaction({
        address: treasury.address,
        transaction: userSigned.signedTransaction,
      });

      const rawTransaction = Buffer.from(
        treasurySigned.signedTransaction,
        "base64",
      );

      const fullySigned = Transaction.from(rawTransaction);

      // Validăm tranzacția completă înainte de salvare și broadcast.
      const expectedSignature = assertExpectedTransferTransaction(fullySigned, {
        userAddress,
        treasuryAddress,
        userAta,
        treasuryAta,
        amount: price,
        decimals: mintInfo.decimals,
      });

      // --------------------------------------------
      // PERSIST TRANSACTION BEFORE BROADCAST
      // --------------------------------------------

      // Salvăm tranzacția semnată ÎNAINTE de broadcast.
      const saveResult = await pool.query(
        `
        UPDATE shop_purchases
        SET status = 'submitted',
            tx_signature = $1,
            signed_transaction = $2,
            last_valid_block_height = $3,
            updated_at = NOW()
        WHERE id = $4
          AND status = 'pending'
        RETURNING id
        `,
        [
          expectedSignature,
          treasurySigned.signedTransaction,
          lastValidBlockHeight,
          purchaseId,
        ],
      );

      if (saveResult.rowCount !== 1) {
        throw new Error(
          "Nu am putut salva tranzacția semnată în baza de date. Broadcast-ul a fost oprit.",
        );
      }

      // Din acest moment, semnătura este salvată persistent.
      signature = expectedSignature;

      // Trimitem exact tranzacția pe care am salvat-o.
      const broadcastSignature = await connection.sendRawTransaction(
        rawTransaction,
        {
          preflightCommitment: "confirmed",
        },
      );

      if (broadcastSignature !== expectedSignature) {
        throw new Error(
          "Semnătura returnată de Solana nu corespunde tranzacției salvate.",
        );
      }

      // --------------------------------------------
      // CONFIRM TRANSACTION
      // --------------------------------------------

      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed",
      );

      if (confirmation.value.err) {
        throw new Error("Transferul PAW a eșuat pe Solana.");
      }

      // Verificăm transferul real, nu doar răspunsul RPC.
      await verifyTransfer(
        signature,
        userAta,
        treasuryAta,
        price,
        userAddress,
        mintInfo.decimals,
      );

      // Inventarul se acordă numai după verificarea transferului.
      await finalizePurchase(purchaseId, user.id, itemId);

      const balanceResult = await pool.query(
        "SELECT solana_wallet_address FROM users WHERE id = $1",
        [user.id],
      );

      const { getPawBalance } = await import("./solana.js");

      const pawBalance = await getPawBalance(
        balanceResult.rows[0].solana_wallet_address,
      );

      return res.json({
        success: true,
        message: "Skin achiziționat cu succes!",
        itemId,
        signature,
        pawBalance,
      });
    } catch (error) {
      console.error("Shop purchase error:", error);

      // Dacă tranzacția a fost salvată ca submitted,
      // nu marcăm achiziția failed.
      // Poate fi deja procesată de Solana.
      if (purchaseId && !signature) {
        await pool
          .query(
            `
            UPDATE shop_purchases
            SET status = 'failed',
                error_message = $1,
                updated_at = NOW()
            WHERE id = $2
              AND status = 'pending'
            `,
            [String(error.message).slice(0, 1000), purchaseId],
          )
          .catch(console.error);
      }

      return res.status(signature ? 202 : 400).json({
        success: false,
        error: signature
          ? "Tranzacția a fost salvată și trimisă sau este în curs de trimitere, dar confirmarea nu s-a încheiat. Nu încerca să cumperi din nou până nu verificăm statusul."
          : error.message || "Achiziția nu a putut fi efectuată.",
        signature,
        pendingConfirmation: Boolean(signature),
      });
    }
  });

  // ------------------------------------------------
  // EQUIP SKIN
  // ------------------------------------------------

  router.post("/equip", async (req, res) => {
    const client = await pool.connect();
    let transactionOpen = false;

    try {
      const auth0Id = req.auth?.payload?.sub;
      const { itemId } = req.body || {};

      if (!auth0Id) {
        return res.status(401).json({
          error: "Utilizator neautentificat.",
        });
      }

      if (typeof itemId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(itemId)) {
        return res.status(400).json({
          error: "ID-ul skin-ului este invalid.",
        });
      }

      const user = await getAuthenticatedUser(auth0Id);

      if (!user) {
        return res.status(404).json({
          error: "Utilizatorul nu există.",
        });
      }

      await client.query("BEGIN");
      transactionOpen = true;

      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [
        user.id,
      ]);

      const owned = await client.query(
        `
        SELECT 1
        FROM user_inventory
        WHERE user_id = $1
          AND item_id = $2
        `,
        [user.id, itemId],
      );

      if (owned.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionOpen = false;

        return res.status(403).json({
          error: "Nu deții acest skin.",
        });
      }

      await client.query(
        `
        UPDATE user_inventory
        SET is_equipped = FALSE
        WHERE user_id = $1
        `,
        [user.id],
      );

      await client.query(
        `
        UPDATE user_inventory
        SET is_equipped = TRUE
        WHERE user_id = $1
          AND item_id = $2
        `,
        [user.id, itemId],
      );

      await client.query("COMMIT");
      transactionOpen = false;

      return res.json({
        success: true,
        equipped: itemId,
      });
    } catch (error) {
      if (transactionOpen) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Shop equip error:", error);

      return res.status(500).json({
        error: "Nu am putut echipa acest skin.",
      });
    } finally {
      client.release();
    }
  });

  return router;
}
