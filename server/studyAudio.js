import crypto from "crypto";
import { Router } from "express";

import { pool } from "./db.js";

// --------------------------------------------------
// AUDIO LESSONS + STUDY TUTOR (ElevenLabs)
// --------------------------------------------------
// - Text-to-speech of a material's Gemini summary, cached in study_audio
//   (migrations/007_study_audio.sql) so replays cost no ElevenLabs credits.
// - Conversation tokens for the "Study Tutor" agent (create-tutor-agent.js).

const ELEVEN_API = "https://api.elevenlabs.io/v1";
const TTS_MODEL = "eleven_flash_v2_5"; // multilingual (Romanian + English)
const DEFAULT_VOICE_ID = "cjVigY5qzO86Huf0OWal";
const MAX_LESSON_CHARS = 3000;
const AUDIO_LINK_TTL_MS = 6 * 60 * 60 * 1000;

// Audio links are signed so the player can load them without an Auth0
// header. The secret changes on restart unless STUDY_AUDIO_SECRET is set;
// links are short-lived anyway.
const LINK_SECRET =
  process.env.STUDY_AUDIO_SECRET || crypto.randomBytes(32).toString("hex");

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("Lipsește ELEVENLABS_API_KEY din server/.env");
  return key;
}

function voiceId() {
  return process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
}

function sign(materialId, userId, expires) {
  return crypto
    .createHmac("sha256", LINK_SECRET)
    .update(`${materialId}.${userId}.${expires}`)
    .digest("base64url");
}

function audioLink(materialId, userId) {
  const expires = Date.now() + AUDIO_LINK_TTL_MS;
  const sig = sign(materialId, userId, expires);
  return `/api/study/audio/${materialId}/file?u=${userId}&e=${expires}&s=${sig}`;
}

function isRomanian(text) {
  return /[ăâîșşțţ]/i.test(text);
}

function parseMaterial(row) {
  let content = null;

  try {
    content = JSON.parse(row.content_summary);
  } catch {
    content = null;
  }

  return {
    id: row.id,
    title: content?.title || row.file_name || "Your lesson",
    summary: content?.summary || row.content_summary || "",
    keyPoints: Array.isArray(content?.keyPoints) ? content.keyPoints : [],
  };
}

/** The text Laica reads aloud. */
function lessonScript({ title, summary, keyPoints }) {
  const ro = isRomanian(`${title} ${summary}`);
  const parts = [`${title}.`, summary.trim()];

  if (keyPoints.length > 0) {
    parts.push(ro ? "Ideile principale." : "The key points.");
    keyPoints.forEach((point, index) => {
      parts.push(`${index + 1}. ${String(point).trim()}`);
    });
  }

  return parts.join("\n\n").slice(0, MAX_LESSON_CHARS);
}

async function getUserId(req) {
  const auth0Id = req.auth?.payload?.sub;
  if (!auth0Id) return null;

  const result = await pool.query(
    "SELECT id FROM users WHERE auth0_id = $1 LIMIT 1",
    [auth0Id]
  );

  return result.rows[0]?.id ?? null;
}

async function getOwnMaterial(materialId, userId) {
  const result = await pool.query(
    `SELECT id, file_name, content_summary
     FROM study_materials
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [materialId, userId]
  );

  return result.rows[0] ? parseMaterial(result.rows[0]) : null;
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Remaining ElevenLabs characters this month, or null if unknown. */
async function remainingCharacters() {
  try {
    const response = await fetch(`${ELEVEN_API}/user/subscription`, {
      headers: { "xi-api-key": apiKey() },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;

    const data = await response.json();
    return data.character_limit - data.character_count;
  } catch {
    return null;
  }
}

export function createStudyAudioRouter({ requireAuth }) {
  const router = Router();

  // GET /api/study/audio – which lessons already have audio
  router.get("/api/study/audio", requireAuth, async (req, res, next) => {
    try {
      const userId = await getUserId(req);
      if (!userId) return res.json({ success: true, audio: [] });

      const result = await pool.query(
        `SELECT material_id AS "materialId", characters, created_at AS "createdAt"
         FROM study_audio
         WHERE user_id = $1`,
        [userId]
      );

      res.json({
        success: true,
        audio: result.rows.map((row) => ({
          ...row,
          url: audioLink(row.materialId, userId),
        })),
        remainingCharacters: await remainingCharacters(),
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/study/materials/:id/audio – create the audio (or reuse it)
  router.post(
    "/api/study/materials/:id/audio",
    requireAuth,
    async (req, res, next) => {
      const materialId = parseId(req.params.id);

      if (!materialId) {
        return res.status(400).json({ success: false, error: "Invalid lesson." });
      }

      try {
        const userId = await getUserId(req);
        const material = userId && (await getOwnMaterial(materialId, userId));

        if (!material) {
          return res.status(404).json({ success: false, error: "Lesson not found." });
        }

        const script = lessonScript(material);

        if (script.trim().length < 20) {
          return res.status(400).json({
            success: false,
            error: "This lesson has no summary to read yet.",
          });
        }

        const hash = crypto.createHash("sha256").update(script).digest("hex");

        const cached = await pool.query(
          "SELECT text_hash FROM study_audio WHERE material_id = $1 AND user_id = $2",
          [materialId, userId]
        );

        if (cached.rows[0]?.text_hash === hash) {
          return res.json({
            success: true,
            reused: true,
            url: audioLink(materialId, userId),
            characters: script.length,
          });
        }

        const remaining = await remainingCharacters();

        if (remaining !== null && remaining < script.length) {
          return res.status(402).json({
            success: false,
            code: "quota_exceeded",
            error: `Not enough ElevenLabs characters left this month (${remaining} left, this lesson needs ${script.length}).`,
          });
        }

        const url = new URL(`${ELEVEN_API}/text-to-speech/${voiceId()}`);
        url.searchParams.set("output_format", "mp3_44100_64");

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey(),
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: script,
            model_id: TTS_MODEL,
            ...(isRomanian(script) ? { language_code: "ro" } : {}),
          }),
          signal: AbortSignal.timeout(90000),
        });

        if (!response.ok) {
          const details = await response.text();
          console.error("ElevenLabs TTS error:", response.status, details.slice(0, 500));

          const quota = /quota|credits|limit/i.test(details);

          return res.status(502).json({
            success: false,
            code: quota ? "quota_exceeded" : "tts_failed",
            error: quota
              ? "Your ElevenLabs characters for this month are used up."
              : "We couldn't create the audio right now. Please try again.",
          });
        }

        const audio = Buffer.from(await response.arrayBuffer());

        await pool.query(
          `INSERT INTO study_audio
             (material_id, user_id, audio, text_hash, characters, voice_id, model_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (material_id) DO UPDATE SET
             audio = EXCLUDED.audio,
             text_hash = EXCLUDED.text_hash,
             characters = EXCLUDED.characters,
             voice_id = EXCLUDED.voice_id,
             model_id = EXCLUDED.model_id,
             created_at = NOW()`,
          [materialId, userId, audio, hash, script.length, voiceId(), TTS_MODEL]
        );

        res.status(201).json({
          success: true,
          reused: false,
          url: audioLink(materialId, userId),
          characters: script.length,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/study/audio/:id/file – the MP3 itself (signed link, no header)
  router.get("/api/study/audio/:id/file", async (req, res, next) => {
    const materialId = parseId(req.params.id);
    const userId = parseId(req.query.u);
    const expires = Number(req.query.e);
    const sig = String(req.query.s || "");

    const expected =
      materialId && userId && Number.isFinite(expires)
        ? sign(materialId, userId, expires)
        : "";

    const valid =
      expected.length > 0 &&
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) &&
      expires > Date.now();

    if (!valid) {
      return res.status(403).json({ success: false, error: "This audio link has expired." });
    }

    try {
      const result = await pool.query(
        "SELECT audio, mime_type FROM study_audio WHERE material_id = $1 AND user_id = $2",
        [materialId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Audio not found." });
      }

      const { audio, mime_type: mimeType } = result.rows[0];

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "private, max-age=3600");

      // Players seek with Range requests (required by iOS / Safari).
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");

      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Math.min(Number(range[2]), audio.length - 1) : audio.length - 1;

        if (start > end || start >= audio.length) {
          res.setHeader("Content-Range", `bytes */${audio.length}`);
          return res.status(416).end();
        }

        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${audio.length}`);
        res.setHeader("Content-Length", end - start + 1);
        return res.end(audio.subarray(start, end + 1));
      }

      res.setHeader("Content-Length", audio.length);
      res.end(audio);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/elevenlabs/tutor-token – start a talk about one lesson
  router.get("/api/elevenlabs/tutor-token", requireAuth, async (req, res, next) => {
    const agentId = process.env.ELEVENLABS_TUTOR_AGENT_ID?.trim();

    if (!agentId) {
      return res.status(500).json({
        success: false,
        error: "Lipsește ELEVENLABS_TUTOR_AGENT_ID din server/.env (rulează node create-tutor-agent.js).",
      });
    }

    try {
      const url = new URL(`${ELEVEN_API}/convai/conversation/token`);
      url.searchParams.set("agent_id", agentId);

      const response = await fetch(url, {
        headers: { "xi-api-key": apiKey() },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.error("ElevenLabs tutor token error:", response.status, (await response.text()).slice(0, 300));
        return res.status(502).json({
          success: false,
          error: "We couldn't connect to the voice tutor right now.",
        });
      }

      const data = await response.json();
      res.json({ success: true, token: data.token });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
