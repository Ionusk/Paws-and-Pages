import crypto from "crypto";
import "dotenv/config";
import { CdpClient } from "@coinbase/cdp-sdk";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { Router } from "express";

import { pool } from "./db.js";

// --------------------------------------------------
// QUESTS – progres calculat din TigerData, recompense PAW pe Solana
// --------------------------------------------------
// Tabel: quest_claims (migrations/005_quest_claims.sql)
// Treasury-ul (mint authority pentru PAW) mintează recompensa direct în
// wallet-ul utilizatorului și plătește taxa Solana.

const TIME_ZONE = "Europe/Bucharest";
const TREASURY_ACCOUNT_NAME = "paws-and-pages-devnet-test";
const ATA_SIZE = 165;
const FEE_BUFFER_LAMPORTS = 20000;

const DAY_START = `(date_trunc('day', NOW() AT TIME ZONE '${TIME_ZONE}') AT TIME ZONE '${TIME_ZONE}')`;
const WEEK_START = `(date_trunc('week', NOW() AT TIME ZONE '${TIME_ZONE}') AT TIME ZONE '${TIME_ZONE}')`;

// Pool of possible quests. Each period the server picks QUESTS_PER_PERIOD of
// them for every user (see getActiveQuests). Progress queries get $1 = users.id
// and return one row with column "v". Ids are stable: they are stored in
// quest_claims and quest_rerolls.
const SESSION_MINUTES = (since) => `SELECT COALESCE(SUM(duration_seconds), 0) / 60 AS v
  FROM reading_sessions WHERE user_id = $1::text AND created_at >= ${since}`;
const SESSION_PAGES = (since) => `SELECT COALESCE(SUM(GREATEST(end_page - start_page, 0)), 0) AS v
  FROM reading_sessions WHERE user_id = $1::text AND created_at >= ${since}`;
const QUIZZES = (since, extra = "") => `SELECT COUNT(*) AS v
  FROM quiz_results WHERE user_id = $1::int AND completed_at >= ${since} ${extra}`;
const MATERIALS = (since) => `SELECT COUNT(*) AS v
  FROM study_materials WHERE user_id = $1::int AND created_at >= ${since}`;
const VOICE_CHATS = (since, extra = "") => `SELECT COUNT(*) AS v
  FROM voice_conversations
  WHERE user_id = $1::int AND created_at >= ${since}
    AND messages @> '[{"role": "user"}]'::jsonb ${extra}`;

export const QUEST_POOL = [
  // ---------------- DAILY ----------------
  { id: "read10", period: "daily", reward: 10, target: 10, progressSql: SESSION_MINUTES(DAY_START) },
  { id: "read", period: "daily", reward: 15, target: 20, progressSql: SESSION_MINUTES(DAY_START) },
  { id: "read30", period: "daily", reward: 25, target: 30, progressSql: SESSION_MINUTES(DAY_START) },
  { id: "pages20", period: "daily", reward: 15, target: 20, progressSql: SESSION_PAGES(DAY_START) },
  {
    id: "book",
    period: "daily",
    reward: 10,
    target: 1,
    progressSql: `SELECT COUNT(*) AS v FROM reading_books
      WHERE user_id = $1::text AND created_at >= ${DAY_START}`,
  },
  {
    id: "review",
    period: "daily",
    reward: 20,
    target: 1,
    progressSql: `SELECT COUNT(*) AS v FROM reading_sessions
      WHERE user_id = $1::text AND created_at >= ${DAY_START}
        AND LENGTH(TRIM(COALESCE(impressions, ''))) > 0`,
  },
  { id: "quiz1", period: "daily", reward: 10, target: 1, progressSql: QUIZZES(DAY_START) },
  {
    id: "perfect",
    period: "daily",
    reward: 25,
    target: 1,
    progressSql: QUIZZES(DAY_START, "AND total_questions > 0 AND score >= total_questions"),
  },
  {
    id: "listen",
    period: "daily",
    reward: 10,
    target: 1,
    progressSql: `SELECT COUNT(*) AS v FROM study_audio
      WHERE user_id = $1::int AND last_listened_at >= ${DAY_START}`,
  },
  {
    id: "tutor",
    period: "daily",
    reward: 15,
    target: 1,
    progressSql: VOICE_CHATS(DAY_START, "AND title LIKE 'Lesson:%'"),
  },
  { id: "upload1", period: "daily", reward: 15, target: 1, progressSql: MATERIALS(DAY_START) },

  // ---------------- WEEKLY ----------------
  {
    id: "consistency",
    period: "weekly",
    reward: 60,
    target: 5,
    progressSql: `SELECT COUNT(DISTINCT (created_at AT TIME ZONE '${TIME_ZONE}')::date) AS v
      FROM reading_sessions WHERE user_id = $1::text AND created_at >= ${WEEK_START}`,
  },
  { id: "pages150", period: "weekly", reward: 70, target: 150, progressSql: SESSION_PAGES(WEEK_START) },
  {
    id: "finish",
    period: "weekly",
    reward: 100,
    target: 1,
    progressSql: `SELECT COUNT(*) AS v FROM reading_books
      WHERE user_id = $1::text AND status = 'finished' AND finished_at >= ${WEEK_START}`,
  },
  { id: "study", period: "weekly", reward: 45, target: 3, progressSql: QUIZZES(WEEK_START) },
  {
    id: "quiz80",
    period: "weekly",
    reward: 40,
    target: 1,
    progressSql: QUIZZES(WEEK_START, "AND total_questions > 0 AND score * 5 >= total_questions * 4"),
  },
  { id: "upload2", period: "weekly", reward: 40, target: 2, progressSql: MATERIALS(WEEK_START) },
  { id: "voice3", period: "weekly", reward: 45, target: 3, progressSql: VOICE_CHATS(WEEK_START) },
  {
    id: "campusPublish",
    period: "weekly",
    reward: 50,
    target: 1,
    campusOnly: true,
    progressSql: `SELECT COUNT(*) AS v FROM campus_books
      WHERE owner_id = $1::int AND deleted_at IS NULL AND created_at >= ${WEEK_START}`,
  },
  {
    id: "campusBorrow",
    period: "weekly",
    reward: 50,
    target: 1,
    campusOnly: true,
    progressSql: `SELECT COUNT(*) AS v FROM campus_borrow_requests
      WHERE requester_id = $1::int AND status IN ('accepted', 'returned')
        AND created_at >= ${WEEK_START}`,
  },
];

/** Kept for scripts that imported the old fixed list. */
export const QUESTS = QUEST_POOL;

const QUESTS_PER_PERIOD = 3;

function rank(seed) {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

/**
 * Quests this user may get. Campus quests only when the account itself is
 * logged in with a @student.upt.ro email that has Campus access; accounts
 * using another email (e.g. Gmail) never see them.
 */
async function eligiblePool(userId) {
  const result = await pool.query(
    `SELECT
       lower(COALESCE(auth_email, email, '')) LIKE '%@student.upt.ro'
         AND student_email_verified_at IS NOT NULL AS campus
     FROM users WHERE id = $1`,
    [userId]
  );
  const campus = Boolean(result.rows[0]?.campus);

  return QUEST_POOL.filter((quest) => campus || !quest.campusOnly);
}

/**
 * The user's quests for the current day and week: the same all period,
 * different for every user, with today's reroll applied.
 */
async function getActiveQuests(userId, periods) {
  const candidates = await eligiblePool(userId);

  const rerolls = await pool.query(
    `SELECT period, old_quest_id, new_quest_id FROM quest_rerolls
     WHERE user_id = $1 AND period_key = ANY($2::text[])
     ORDER BY created_at`,
    [userId, [periods.daily, periods.weekly]]
  );

  const active = [];

  for (const period of ["daily", "weekly"]) {
    const key = periods[period];
    let ids = candidates
      .filter((quest) => quest.period === period)
      .sort((a, b) => rank(`${userId}:${key}:${a.id}`).localeCompare(rank(`${userId}:${key}:${b.id}`)))
      .slice(0, QUESTS_PER_PERIOD)
      .map((quest) => quest.id);

    for (const row of rerolls.rows) {
      if (row.period === period && ids.includes(row.old_quest_id)) {
        ids = ids.map((id) => (id === row.old_quest_id ? row.new_quest_id : id));
      }
    }

    for (const id of ids) {
      // Only quests this user is allowed (an earlier swap can't bring back a
      // Campus quest for a non-UPT login).
      const quest = candidates.find((item) => item.id === id);
      if (quest) active.push(quest);
    }
  }

  return { active, candidates };
}

async function getPeriodKeys() {
  const result = await pool.query(
    `SELECT
      to_char(NOW() AT TIME ZONE '${TIME_ZONE}', 'YYYY-MM-DD') AS daily,
      to_char(NOW() AT TIME ZONE '${TIME_ZONE}', 'IYYY-"W"IW') AS weekly`
  );

  return result.rows[0];
}

async function getQuestProgress(quest, userId) {
  const result = await pool.query(quest.progressSql, [userId]);
  return Math.floor(Number(result.rows[0]?.v) || 0);
}

async function getUser(req) {
  const auth0Id = req.auth?.payload?.sub;

  if (!auth0Id) return null;

  const result = await pool.query(
    "SELECT id, solana_wallet_address FROM users WHERE auth0_id = $1 LIMIT 1",
    [auth0Id]
  );

  return result.rows[0] ?? null;
}

// --------------------------------------------------
// SOLANA (created on first claim, so the server starts without CDP keys)
// --------------------------------------------------

let solana = null;

function getSolana() {
  if (!process.env.PAW_TOKEN_MINT_ADDRESS) {
    throw new Error("PAW_TOKEN_MINT_ADDRESS lipsește din server/.env");
  }

  if (!solana) {
    solana = {
      cdp: new CdpClient(),
      connection: new Connection(
        process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
        "confirmed"
      ),
      mint: new PublicKey(process.env.PAW_TOKEN_MINT_ADDRESS),
    };
  }

  return solana;
}

async function markClaim(id, status, fields = {}) {
  await pool.query(
    `UPDATE quest_claims
     SET status = $2,
         error_message = COALESCE($3, error_message),
         confirmed_at = CASE WHEN $2 = 'confirmed' THEN NOW() ELSE confirmed_at END,
         updated_at = NOW()
     WHERE id = $1`,
    [id, status, fields.error ? String(fields.error).slice(0, 1000) : null]
  );
}

/**
 * Resolves an earlier claim that was sent to Solana but never confirmed.
 * Returns "confirmed", "failed" (safe to retry) or "pending".
 */
async function resolveSubmittedClaim(claim) {
  const { connection } = getSolana();

  const status = (
    await connection.getSignatureStatuses([claim.tx_signature], {
      searchTransactionHistory: true,
    })
  ).value[0];

  if (status && !status.err && ["confirmed", "finalized"].includes(status.confirmationStatus)) {
    await markClaim(claim.id, "confirmed");
    return "confirmed";
  }

  if (status?.err) {
    await markClaim(claim.id, "failed", { error: "Tranzacția a eșuat pe Solana." });
    return "failed";
  }

  if (!status) {
    const height = await connection.getBlockHeight("confirmed");

    if (height > Number(claim.last_valid_block_height)) {
      // Expired without ever landing: no PAW were minted.
      await markClaim(claim.id, "failed", {
        error: "Tranzacția a expirat fără să ajungă pe Solana.",
      });
      return "failed";
    }
  }

  return "pending";
}

async function mintReward(claimId, user, amount) {
  const { cdp, connection, mint } = getSolana();

  const treasury = await cdp.solana.getOrCreateAccount({
    name: TREASURY_ACCOUNT_NAME,
  });
  const treasuryAddress = new PublicKey(treasury.address);
  const userAddress = new PublicKey(user.solana_wallet_address);

  const mintInfo = await getMint(connection, mint, "confirmed");

  if (!mintInfo.mintAuthority?.equals(treasuryAddress)) {
    throw new Error("Treasury-ul nu este mint authority pentru PAW.");
  }

  const userAta = await getAssociatedTokenAddress(mint, userAddress);
  const ataExists = Boolean(await connection.getAccountInfo(userAta));

  // Check fees up front, so a broke treasury fails cleanly instead of
  // leaving a stuck "submitted" claim.
  const [balance, minimum, ataRent] = await Promise.all([
    connection.getBalance(treasuryAddress),
    connection.getMinimumBalanceForRentExemption(0),
    ataExists ? 0 : connection.getMinimumBalanceForRentExemption(ATA_SIZE),
  ]);

  if (balance < minimum + ataRent + FEE_BUFFER_LAMPORTS) {
    throw new Error(
      "Treasury-ul nu are destul SOL pentru taxă. Rulează: node fund-treasury.js"
    );
  }

  const transaction = new Transaction();

  if (!ataExists) {
    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        treasuryAddress,
        userAta,
        userAddress,
        mint
      )
    );
  }

  transaction.add(
    createMintToInstruction(mint, userAta, treasuryAddress, BigInt(amount))
  );

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  transaction.feePayer = treasuryAddress;
  transaction.recentBlockhash = blockhash;

  const signed = await cdp.solana.signTransaction({
    address: treasury.address,
    transaction: transaction
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64"),
  });

  const raw = Buffer.from(signed.signedTransaction, "base64");
  const signature = bs58.encode(Transaction.from(raw).signature);

  // Save the signature BEFORE broadcasting, so a crash can never mint twice.
  const saved = await pool.query(
    `UPDATE quest_claims
     SET status = 'submitted', tx_signature = $2,
         last_valid_block_height = $3, updated_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [claimId, signature, lastValidBlockHeight]
  );

  if (saved.rowCount !== 1) {
    throw new Error("Nu am putut salva tranzacția. Mintarea a fost oprită.");
  }

  let confirmation;

  try {
    await connection.sendRawTransaction(raw, { preflightCommitment: "confirmed" });

    confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );
  } catch (error) {
    // Outcome unknown: the transaction may still land, so keep "submitted".
    error.signature = signature;
    throw error;
  }

  if (confirmation.value.err) {
    // Solana processed it and it failed: nothing was minted.
    throw new Error("Mintarea PAW a eșuat pe Solana.");
  }

  await markClaim(claimId, "confirmed");

  return signature;
}

// --------------------------------------------------
// ROUTER
// --------------------------------------------------

export function createQuestsRouter({ requireAuth }) {
  const router = Router();

  router.use(requireAuth);

  // GET /api/quests – progresul real + starea recompenselor
  router.get("/", async (req, res, next) => {
    try {
      const user = await getUser(req);

      if (!user) {
        return res.status(404).json({ success: false, error: "Utilizatorul nu există." });
      }

      const periods = await getPeriodKeys();

      const claims = await pool.query(
        `SELECT quest_id, period_key, status
         FROM quest_claims
         WHERE user_id = $1
           AND status <> 'failed'
           AND period_key = ANY($2::text[])`,
        [user.id, [periods.daily, periods.weekly]]
      );

      const { active } = await getActiveQuests(user.id, periods);

      const reroll = await pool.query(
        "SELECT 1 FROM quest_rerolls WHERE user_id = $1 AND day_key = $2",
        [user.id, periods.daily]
      );

      const quests = await Promise.all(
        active.map(async (quest) => {
          const claim = claims.rows.find(
            (row) =>
              row.quest_id === quest.id && row.period_key === periods[quest.period]
          );

          return {
            id: quest.id,
            period: quest.period,
            reward: quest.reward,
            target: quest.target,
            progress: await getQuestProgress(quest, user.id),
            claimStatus: claim?.status ?? null,
          };
        })
      );

      res.json({
        success: true,
        periods,
        quests,
        rerollAvailable: reroll.rows.length === 0,
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/quests/:questId/reroll – schimbă un quest (o dată pe zi)
  router.post("/:questId/reroll", async (req, res, next) => {
    try {
      const user = await getUser(req);

      if (!user) {
        return res.status(404).json({ success: false, error: "Utilizatorul nu există." });
      }

      const periods = await getPeriodKeys();
      const { active, candidates } = await getActiveQuests(user.id, periods);
      const quest = active.find((item) => item.id === req.params.questId);

      if (!quest) {
        return res.status(404).json({ success: false, error: "You don't have this quest right now." });
      }

      const periodKey = periods[quest.period];

      const claims = await pool.query(
        `SELECT quest_id FROM quest_claims
         WHERE user_id = $1 AND period_key = $2 AND status <> 'failed'`,
        [user.id, periodKey]
      );
      const claimed = new Set(claims.rows.map((row) => row.quest_id));

      if (claimed.has(quest.id)) {
        return res.status(409).json({ success: false, error: "This quest's reward was already claimed." });
      }

      const activeIds = new Set(active.map((item) => item.id));
      const replacement = candidates
        .filter(
          (item) =>
            item.period === quest.period &&
            !activeIds.has(item.id) &&
            !claimed.has(item.id)
        )
        .sort((a, b) =>
          rank(`${user.id}:${periods.daily}:reroll:${a.id}`).localeCompare(
            rank(`${user.id}:${periods.daily}:reroll:${b.id}`)
          )
        )[0];

      if (!replacement) {
        return res.status(409).json({ success: false, error: "There is no other quest to swap in." });
      }

      const saved = await pool.query(
        `INSERT INTO quest_rerolls
           (user_id, day_key, period, period_key, old_quest_id, new_quest_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, day_key) DO NOTHING
         RETURNING id`,
        [user.id, periods.daily, quest.period, periodKey, quest.id, replacement.id]
      );

      if (saved.rows.length === 0) {
        return res.status(409).json({ success: false, error: "You already used today's reroll." });
      }

      res.json({ success: true, replacedId: quest.id, newId: replacement.id });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/quests/:questId/claim – mintează recompensa PAW
  router.post("/:questId/claim", async (req, res) => {
    let claimId = null;

    try {
      const user = await getUser(req);

      if (!user?.solana_wallet_address) {
        return res.status(404).json({
          success: false,
          error: "Wallet-ul utilizatorului nu există. Reconectează-te.",
        });
      }

      const { active } = await getActiveQuests(user.id, await getPeriodKeys());
      const quest = active.find((item) => item.id === req.params.questId);

      if (!quest) {
        return res.status(404).json({ success: false, error: "You don't have this quest right now." });
      }

      const progress = await getQuestProgress(quest, user.id);

      if (progress < quest.target) {
        return res.status(400).json({
          success: false,
          error: "Quest-ul nu este încă terminat.",
        });
      }

      const periodKey = (await getPeriodKeys())[quest.period];

      const existing = (
        await pool.query(
          `SELECT * FROM quest_claims
           WHERE user_id = $1 AND quest_id = $2 AND period_key = $3
             AND status <> 'failed'
           LIMIT 1`,
          [user.id, quest.id, periodKey]
        )
      ).rows[0];

      if (existing?.status === "confirmed") {
        return res.status(409).json({
          success: false,
          error: "Ai primit deja recompensa pentru acest quest.",
        });
      }

      if (existing?.status === "submitted") {
        const outcome = await resolveSubmittedClaim(existing);

        if (outcome === "confirmed") {
          return res.json({ success: true, reward: quest.reward, alreadyProcessed: true });
        }

        if (outcome === "pending") {
          return res.status(202).json({
            success: false,
            pendingConfirmation: true,
            error: "Recompensa este încă în curs de confirmare pe Solana.",
          });
        }
        // "failed": nothing was minted, fall through to a fresh attempt.
      }

      if (existing?.status === "pending") {
        const ageMs = Date.now() - new Date(existing.created_at).getTime();

        if (ageMs < 2 * 60 * 1000) {
          return res.status(409).json({
            success: false,
            error: "Recompensa este deja în procesare.",
          });
        }

        // Stuck before anything was signed or sent: safe to retry.
        await markClaim(existing.id, "failed", { error: "Abandonat înainte de trimitere." });
      }

      try {
        claimId = (
          await pool.query(
            `INSERT INTO quest_claims (user_id, quest_id, period_key, amount)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [user.id, quest.id, periodKey, quest.reward]
          )
        ).rows[0].id;
      } catch (error) {
        if (error.code === "23505") {
          return res.status(409).json({
            success: false,
            error: "Recompensa este deja în procesare.",
          });
        }
        throw error;
      }

      const signature = await mintReward(claimId, user, quest.reward);

      return res.json({ success: true, reward: quest.reward, signature });
    } catch (error) {
      console.error("Quest claim error:", error);

      // Sent to Solana but not confirmed: keep it "submitted" (may still land).
      if (error.signature) {
        return res.status(202).json({
          success: false,
          pendingConfirmation: true,
          error:
            "Recompensa a fost trimisă, dar confirmarea nu s-a terminat. Încearcă din nou peste un minut.",
        });
      }

      if (claimId) {
        await markClaim(claimId, "failed", { error: error.message }).catch(console.error);
      }

      return res.status(500).json({
        success: false,
        error: error.message || "Nu am putut acorda recompensa.",
      });
    }
  });

  return router;
}
