
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { auth } from "express-oauth2-jwt-bearer";
import JSZip from "jszip";
import mammoth from "mammoth";
import multer from "multer";
import sharp from "sharp";
import { createAuth0Client } from "./auth0Client.js";
import { createCampusRouter } from "./campus.js";
import { createAccessService } from "./campusAccess.js";
import { pool } from "./db.js";
import { createProfileRouter } from "./profile.js";
import { createShopRouter } from "./shop.js";
import { getOrCreateUserWallet, getPawBalance } from "./solana.js";

dotenv.config();

// =========================================================
// SERVER INITIALIZATION
// =========================================================

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Lipsește GEMINI_API_KEY din server/.env");
}

if (!process.env.AUTH0_DOMAIN) {
  throw new Error("Lipsește AUTH0_DOMAIN din server/.env");
}

if (!process.env.AUTH0_AUDIENCE) {
  throw new Error("Lipsește AUTH0_AUDIENCE din server/.env");
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
// 2mb: transcrierile conversațiilor vocale lungi depășesc limita implicită de 100kb.
app.use(express.json({ limit: "2mb" }));

// =========================================================
// AUTH0
// =========================================================

const requireAuth = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  audience: process.env.AUTH0_AUDIENCE,
});

// =========================================================
// SHOP - SOLANA PAW TOKEN
// =========================================================

app.use("/api/shop", createShopRouter({ requireAuth }));

// =========================================================
// PROFILE (USERNAME) + CAMPUS (VERIFIED UPT STUDENTS ONLY)
// =========================================================

// AUTH0_PASSWORDLESS_CLIENT_ID enables "verify your UPT email with a code".
// Without it, Campus still works for accounts whose own Auth0 email is a
// verified @student.upt.ro address.
const auth0Client = createAuth0Client({
  domain: process.env.AUTH0_DOMAIN,
  passwordlessClientId: process.env.AUTH0_PASSWORDLESS_CLIENT_ID || null,
  passwordlessClientSecret: process.env.AUTH0_PASSWORDLESS_CLIENT_SECRET || null,
});

const campusAccess = createAccessService({ pool, auth0: auth0Client });

app.use(
  "/api/me",
  createProfileRouter({ requireAuth, pool, auth0: auth0Client, access: campusAccess })
);

app.use(
  "/api/campus",
  createCampusRouter({ requireAuth, pool, access: campusAccess })
);

// =========================================================
// GEMINI CONFIGURATION
// =========================================================

const PRIMARY_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || "gemini-3.8-flash";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// =========================================================
// COVER UPLOAD CONFIGURATION
// =========================================================

const coverUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      return callback(
        new Error("Coperta trebuie să fie o imagine.")
      );
    }

    callback(null, true);
  },
});

// =========================================================
// READING – TIGERDATA
// =========================================================

// Identificăm ID-ul intern al utilizatorului din tabela users
async function getReadingUserId(req) {
  const auth0Id = req.auth?.payload?.sub;

  if (!auth0Id) {
    throw new Error("Utilizatorul nu este autentificat.");
  }

  const result = await pool.query(
    `SELECT id
     FROM users
     WHERE auth0_id = $1
     LIMIT 1`,
    [auth0Id]
  );

  if (result.rows.length === 0) {
    throw new Error(
      "Utilizatorul nu există în TigerData. Reconectează-te în aplicație."
    );
  }

  return String(result.rows[0].id);
}

// GET – toate cărțile utilizatorului, inclusiv coperțile
app.get(
  "/api/reading/books",
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = await getReadingUserId(req);

      const result = await pool.query(
        `SELECT
          id,
          title,
          author,
          total_pages AS pages,
          current_page AS "currentPage",
          created_at AS "createdAt",

          CASE
            WHEN cover_data IS NOT NULL
            THEN
              'data:' ||
              COALESCE(cover_mime_type, 'image/jpeg') ||
              ';base64,' ||
              replace(encode(cover_data, 'base64'), E'\n', '')
            ELSE cover_url
          END AS "coverUrl"

         FROM reading_books
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        books: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);
// POST – adaugă o carte și coperta ei
app.post(
  "/api/reading/books",
  requireAuth,
  coverUpload.single("cover"),
  async (req, res, next) => {
    try {
      console.log("\n========== UPLOAD DEBUG ==========");
      console.log(
        "CONTENT TYPE:",
        req.headers["content-type"]
      );
      console.log("BODY:", req.body);

      console.log(
        "FILE:",
        req.file
          ? {
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size,
            }
          : null
      );

      const userId = await getReadingUserId(req);

      const {
        title,
        author,
        pages,
        currentPage = "0",
      } = req.body || {};

      const parsedPages = Number(pages);
      const parsedCurrentPage = Number(currentPage);

      if (!title?.trim()) {
        return res.status(400).json({
          success: false,
          error: "Titlul este obligatoriu.",
        });
      }

      if (
        !Number.isInteger(parsedPages) ||
        parsedPages <= 0
      ) {
        return res.status(400).json({
          success: false,
          error: "Numărul de pagini este invalid.",
        });
      }

      if (
        !Number.isInteger(parsedCurrentPage) ||
        parsedCurrentPage < 0 ||
        parsedCurrentPage > parsedPages
      ) {
        return res.status(400).json({
          success: false,
          error: "Pagina curentă este invalidă.",
        });
      }

      const coverBuffer = req.file
        ? req.file.buffer
        : null;

      const coverMimeType = req.file
        ? req.file.mimetype
        : null;

      const result = await pool.query(
        `INSERT INTO reading_books
          (
            user_id,
            title,
            author,
            total_pages,
            current_page,
            cover_url,
            cover_data,
            cover_mime_type
          )
         VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)
         RETURNING
          id,
          title,
          author,
          total_pages AS pages,
          current_page AS "currentPage",
          created_at AS "createdAt",

          CASE
            WHEN cover_data IS NOT NULL
            THEN
              'data:' ||
              COALESCE(cover_mime_type, 'image/jpeg') ||
              ';base64,' ||
              replace(encode(cover_data, 'base64'), E'\n', '')
            ELSE cover_url
          END AS "coverUrl"`,
        [
          userId,
          title.trim(),
          author?.trim() || "Unknown author",
          parsedPages,
          parsedCurrentPage,
          coverBuffer,
          coverMimeType,
        ]
      );

      console.log(
        "Carte salvată în TigerData:",
        result.rows[0].title
      );

      console.log(
        "Copertă salvată:",
        Boolean(coverBuffer)
      );

      console.log("==================================\n");

      res.status(201).json({
        success: true,
        book: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);
// GET – sesiunile utilizatorului
app.get(
  "/api/reading/sessions",
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = await getReadingUserId(req);

      const result = await pool.query(
        `SELECT
          id,
          book_id AS "bookId",
          duration_seconds AS "durationSeconds",
          start_page AS "startPage",
          end_page AS "endPage",
          impressions,
          created_at AS date
         FROM reading_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        sessions: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST – salvează o sesiune de lectură
app.post(
  "/api/reading/sessions",
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = await getReadingUserId(req);

      const {
        bookId = null,
        durationSeconds,
        startPage = 0,
        endPage = 0,
        impressions = "",
      } = req.body || {};

      if (
        !Number.isInteger(durationSeconds) ||
        durationSeconds <= 0 ||
        !Number.isInteger(startPage) ||
        startPage < 0 ||
        !Number.isInteger(endPage) ||
        endPage < 0
      ) {
        return res.status(400).json({
          success: false,
          error: "Datele sesiunii sunt invalide.",
        });
      }

      if (bookId) {
        const bookResult = await pool.query(
          `SELECT id
           FROM reading_books
           WHERE id = $1 AND user_id = $2`,
          [bookId, userId]
        );

        if (bookResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Cartea nu a fost găsită.",
          });
        }
      }

      const result = await pool.query(
        `INSERT INTO reading_sessions
          (
            user_id,
            book_id,
            duration_seconds,
            start_page,
            end_page,
            impressions
          )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING
          id,
          book_id AS "bookId",
          duration_seconds AS "durationSeconds",
          start_page AS "startPage",
          end_page AS "endPage",
          impressions,
          created_at AS date`,
        [
          userId,
          bookId,
          durationSeconds,
          startPage,
          endPage,
          impressions,
        ]
      );

      res.status(201).json({
        success: true,
        session: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================
// FILE UPLOAD – STUDY MATERIALS
// =========================================================

const allowedExtensions = [
  ".pdf",
  ".docx",
  ".pptx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".avif",
];

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 20 * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    const extension = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf("."));

    if (!allowedExtensions.includes(extension)) {
      return callback(
        new Error(
          "Format nesuportat. Încarcă PDF, DOCX, PPTX sau o imagine."
        )
      );
    }

    callback(null, true);
  },
});

// =========================================================
// XML HELPERS
// =========================================================

function decodeXml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    );
}

// =========================================================
// POWERPOINT EXTRACTION
// =========================================================

async function extractPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(name)
    )
    .sort((a, b) => {
      const numberA = Number(
        a.match(/slide(\d+)\.xml$/)[1]
      );

      const numberB = Number(
        b.match(/slide(\d+)\.xml$/)[1]
      );

      return numberA - numberB;
    });

  const slides = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");

    const texts = [
      ...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g),
    ]
      .map((match) => decodeXml(match[1]))
      .filter(Boolean);

    if (texts.length > 0) {
      slides.push(
        `Slide ${i + 1}:\n${texts.join(" ")}`
      );
    }
  }

  return slides.join("\n\n");
}

// =========================================================
// GEMINI RESPONSE SCHEMA
// =========================================================

const responseSchema = {
  type: "object",

  properties: {
    title: {
      type: "string",
    },

    summary: {
      type: "string",
    },

    keyPoints: {
      type: "array",
      items: {
        type: "string",
      },
    },

    quiz: {
      type: "array",

      items: {
        type: "object",

        properties: {
          question: {
            type: "string",
          },

          options: {
            type: "array",
            items: {
              type: "string",
            },
          },

          correctAnswer: {
            type: "integer",
          },

          explanation: {
            type: "string",
          },
        },

        required: [
          "question",
          "options",
          "correctAnswer",
          "explanation",
        ],
      },
    },
  },

  required: [
    "title",
    "summary",
    "keyPoints",
    "quiz",
  ],
};

// =========================================================
// GEMINI ERROR HELPERS
// =========================================================

function getErrorStatus(error) {
  const status =
    error?.status ||
    error?.code ||
    error?.response?.status;

  if (typeof status === "number") {
    return status;
  }

  const message = String(error?.message || "");

  const match = message.match(
    /\b(400|401|403|404|429|500|502|503|504)\b/
  );

  return match ? Number(match[1]) : null;
}

function isTemporaryError(error) {
  const status = getErrorStatus(error);

  if ([429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = String(
    error?.message || ""
  ).toLowerCase();

  return (
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("enotfound") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("high demand")
  );
}

function wait(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

// =========================================================
// GEMINI - MAXIMUM 5 ATTEMPTS
// =========================================================

async function generateWithModel(model, parts) {
  const maxAttempts = 5;
  let lastError;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      console.log(
        `Gemini model: ${model} | încercarea ${attempt}/${maxAttempts}`
      );

      const response = await ai.models.generateContent({
        model,

        contents: [
          {
            role: "user",
            parts,
          },
        ],

        config: {
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema,
          temperature: 0.4,
        },
      });

      if (!response.text) {
        throw new Error(
          "Gemini nu a returnat un răspuns."
        );
      }

      const result = JSON.parse(response.text);

      if (
        !result.title ||
        !result.summary ||
        !Array.isArray(result.keyPoints) ||
        !Array.isArray(result.quiz)
      ) {
        throw new Error(
          "Răspunsul Gemini are un format invalid."
        );
      }

      if (
        result.quiz.length !== 5 ||
        result.quiz.some(
          (question) =>
            !Array.isArray(question.options) ||
            question.options.length !== 4 ||
            !Number.isInteger(question.correctAnswer) ||
            question.correctAnswer < 0 ||
            question.correctAnswer > 3
        )
      ) {
        throw new Error(
          "Gemini nu a generat un quiz valid cu 5 întrebări și 4 variante."
        );
      }

      return result;
    } catch (error) {
      lastError = error;

      console.error(
        `Eroare Gemini (${model}, încercarea ${attempt}/${maxAttempts}):`,
        error?.message || error
      );

      if (
        !isTemporaryError(error) ||
        attempt === maxAttempts
      ) {
        throw error;
      }

      const delay = Math.min(
        2000 * Math.pow(2, attempt - 1),
        16000
      );

      console.log(
        `Reîncercăm în ${delay / 1000} secunde...`
      );

      await wait(delay);
    }
  }

  throw lastError;
}

// =========================================================
// GEMINI FALLBACK
// =========================================================

async function generateWithFallback(parts) {
  const models = [
    ...new Set([
      PRIMARY_MODEL,
      FALLBACK_MODEL,
    ]),
  ];

  let lastError;

  for (
    let index = 0;
    index < models.length;
    index++
  ) {
    const model = models[index];

    try {
      const result = await generateWithModel(
        model,
        parts
      );

      console.log(
        `Material generat cu modelul ${model}`
      );

      return result;
    } catch (error) {
      lastError = error;

      const status = getErrorStatus(error);

      console.error(
        `Modelul ${model} a eșuat. Status: ${status}`
      );

      if (index === models.length - 1) {
        break;
      }

      if (
        !isTemporaryError(error) &&
        status !== 404
      ) {
        throw error;
      }

      console.log(
        `Încercăm modelul secundar: ${models[index + 1]}`
      );
    }
  }

  throw (
    lastError ||
    new Error("Toate modelele Gemini au eșuat.")
  );
}

// =========================================================
// STUDY MATERIAL GENERATION
// =========================================================

async function generateStudyMaterial(file) {
  const extension = file.originalname
    .toLowerCase()
    .slice(file.originalname.lastIndexOf("."));

  const prompt = `
Ești asistentul educațional al aplicației Paws & Pages.

Analizează integral materialul încărcat și generează:

1. Un titlu potrivit.
2. Un rezumat clar, structurat și ușor de învățat.
3. Conceptele importante.
4. EXACT 5 întrebări de quiz.

Pentru fiecare întrebare:

- Oferă EXACT 4 variante.
- O singură variantă este corectă.
- correctAnswer este indexul variantei corecte, de la 0 la 3.
- Adaugă o explicație pentru răspuns.

Scrie în limba română.

Păstrează termenii tehnici.

Nu inventa informații care nu apar în material.

Dacă textul sau fotografia este ilizibilă, menționează acest lucru.
`;

  const parts = [
    {
      text: prompt,
    },
  ];

  // PDF
  if (extension === ".pdf") {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: file.buffer.toString("base64"),
      },
    });
  }

  // IMAGES
  else if (
    [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".heic",
      ".heif",
      ".gif",
      ".bmp",
      ".tif",
      ".tiff",
      ".avif",
    ].includes(extension)
  ) {
    const directMimeTypes = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".heic": "image/heic",
      ".heif": "image/heif",
    };

    let imageBuffer;
    let mimeType;

    if (directMimeTypes[extension]) {
      imageBuffer = file.buffer;
      mimeType = directMimeTypes[extension];
    } else {
      imageBuffer = await sharp(file.buffer, {
        animated: false,
      })
        .rotate()
        .jpeg({ quality: 90 })
        .toBuffer();

      mimeType = "image/jpeg";
    }

    parts.push({
      inlineData: {
        mimeType,
        data: imageBuffer.toString("base64"),
      },
    });
  }

  // WORD
  else if (extension === ".docx") {
    const result = await mammoth.extractRawText({
      buffer: file.buffer,
    });

    parts.push({
      text: `Conținut Word:\n\n${result.value}`,
    });
  }

  // POWERPOINT
  else if (extension === ".pptx") {
    const text = await extractPptx(file.buffer);

    parts.push({
      text: `Conținut PowerPoint:\n\n${text}`,
    });
  } else {
    throw new Error(
      "Format de fișier nesuportat."
    );
  }

  return generateWithFallback(parts);
}

// =========================================================
// GET STUDY STATISTICS
// =========================================================

app.get(
  "/api/study/stats",
  requireAuth,
  async (req, res) => {
    try {
      const auth0Id = req.auth?.payload?.sub;

      if (!auth0Id) {
        return res.status(401).json({
          error: "Utilizator neautentificat.",
        });
      }

      const userResult = await pool.query(
        `
        SELECT id
        FROM users
        WHERE auth0_id = $1
        LIMIT 1
        `,
        [auth0Id]
      );

      if (userResult.rows.length === 0) {
        return res.json({
          success: true,
          stats: {
            materials: 0,
            quizzes: 0,
          },
        });
      }

      const userId = userResult.rows[0].id;

      const statsResult = await pool.query(
        `
        SELECT
          (
            SELECT COUNT(*)
            FROM study_materials
            WHERE user_id = $1
          ) AS materials,

          (
            SELECT COUNT(*)
            FROM quizzes
            WHERE user_id = $1
          ) AS quizzes
        `,
        [userId]
      );

      return res.json({
        success: true,
        stats: {
          materials: Number(statsResult.rows[0].materials),
          quizzes: Number(statsResult.rows[0].quizzes),
        },
      });
    } catch (error) {
      console.error("Eroare la statisticile Study:", error);

      return res.status(500).json({
        error: "Nu am putut încărca statisticile.",
      });
    }
  }
);

// =========================================================
// AUTH0 USER SYNC - TIGERDATA
// =========================================================

app.post(
  "/api/auth/sync",
  requireAuth,
  async (req, res) => {
    try {
      const auth0Id = req.auth?.payload?.sub;

      if (!auth0Id) {
        return res.status(401).json({
          error:
            "Nu am putut identifica utilizatorul Auth0.",
        });
      }

      const email =
        req.auth?.payload?.email ||
        req.body?.email ||
        null;

      const name =
        req.auth?.payload?.name ||
        req.auth?.payload?.nickname ||
        req.body?.name ||
        null;

      const userResult = await pool.query(
        `
        INSERT INTO users (auth0_id, email, name)
        VALUES ($1, $2, $3)

        ON CONFLICT (auth0_id)
        DO UPDATE SET
          email = COALESCE(EXCLUDED.email, users.email),
          name = COALESCE(EXCLUDED.name, users.name),
          updated_at = NOW()

        RETURNING id, auth0_id, email, name
        `,
        [auth0Id, email, name]
      );

      const user = userResult.rows[0];

      console.log(
        "Utilizator sincronizat cu TigerData:",
        user.id
      );

      // CREATE / RETRIEVE SOLANA WALLET
      const walletAddress = await getOrCreateUserWallet(user.id);

      // READ REAL PAW BALANCE FROM SOLANA
      const pawBalance = await getPawBalance(walletAddress);

      console.log("Wallet Solana:", walletAddress);
      console.log("Sold PAW:", pawBalance);

      // Re-check the Auth0 email after every login so Campus access follows
      // the account's current, verified email. A failure here must not block
      // signing in.
      let campusState = null;

      try {
        campusState = await campusAccess.resolve(auth0Id, req.auth?.token, { force: true });
      } catch (error) {
        console.error("Campus access check during sync failed:", error.message);
        campusState = await campusAccess.resolve(auth0Id, null).catch(() => null);
      }

      const username = campusState?.user?.username ?? null;

      return res.json({
        success: true,
        message: "Utilizator sincronizat cu TigerData!",
        user: {
          ...user,
          username,
          needsUsername: !username,
          solana_wallet_address: walletAddress,
        },
        campus: campusState
          ? campusAccess.describe(campusState, {
              verificationAvailable: auth0Client.isPasswordlessConfigured,
            })
          : null,
        wallet: {
          address: walletAddress,
          pawBalance,
        },
      });
    } catch (error) {
      console.error(
        "Eroare la sincronizarea utilizatorului:",
        error
      );

      return res.status(500).json({
        error:
          "Nu am putut sincroniza utilizatorul sau wallet-ul Solana.",
      });
    }
  }
);

// =========================================================
// SOLANA WALLET - GET BALANCE
// =========================================================

app.get("/api/wallet", requireAuth, async (req, res) => {
  try {
    const auth0Id = req.auth?.payload?.sub;

    if (!auth0Id) {
      return res.status(401).json({
        error: "Utilizator neautentificat.",
      });
    }

    // IDENTIFY AUTHENTICATED USER
    const userResult = await pool.query(
      `
        SELECT id
        FROM users
        WHERE auth0_id = $1
        LIMIT 1
        `,
      [auth0Id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "Utilizatorul nu există.",
      });
    }

    const userId = userResult.rows[0].id;

    // GET EXISTING WALLET OR CREATE IT
    const walletAddress = await getOrCreateUserWallet(userId);

    // READ CURRENT ON-CHAIN BALANCE
    const pawBalance = await getPawBalance(walletAddress);

    return res.json({
      success: true,
      wallet: {
        address: walletAddress,
        pawBalance,
      },
    });
  } catch (error) {
    console.error("Eroare la citirea wallet-ului Solana:", error);

    return res.status(500).json({
      error: "Nu am putut obține soldul PAW.",
    });
  }
});

// =========================================================
// ELEVENLABS – VOICE TUTOR
// =========================================================

app.get(
  "/api/elevenlabs/conversation-token",
  requireAuth,
  async (req, res) => {
    try {
      if (!process.env.ELEVENLABS_API_KEY) {
        return res.status(500).json({
          error: "Lipsește ELEVENLABS_API_KEY din server/.env",
        });
      }

      if (!process.env.ELEVENLABS_AGENT_ID) {
        return res.status(500).json({
          error: "Lipsește ELEVENLABS_AGENT_ID din server/.env",
        });
      }

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(
          process.env.ELEVENLABS_AGENT_ID
        )}`,
        {
          method: "GET",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();

        console.error("ElevenLabs API error:", response.status, errorText);

        return res.status(502).json({
          error: "Nu am putut obține tokenul pentru conversația vocală.",
        });
      }

      const data = await response.json();

      return res.json({
        token: data.token,
      });
    } catch (error) {
      console.error("ElevenLabs error:", error);

      return res.status(500).json({
        error: "A apărut o eroare la conectarea cu ElevenLabs.",
      });
    }
  }
);

// =========================================================
// VOICE CONVERSATIONS – istoricul conversațiilor cu Laica
// =========================================================
// Tabelul se creează cu: node create-voice-conversations.js

const VOICE_MAX_MESSAGES = 1000;
const VOICE_MAX_MESSAGE_LENGTH = 10000;
const VOICE_MAX_TITLE_LENGTH = 200;

function cleanVoiceText(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function parseVoiceConversationId(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET – lista conversațiilor (fără mesajele complete)
app.get(
  "/api/voice/conversations",
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = await getReadingUserId(req);

      const result = await pool.query(
        `SELECT
          id,
          title,
          book_title AS "bookTitle",
          duration_seconds AS "durationSeconds",
          jsonb_array_length(messages) AS "messageCount",
          COALESCE(
            (SELECT m->>'text'
             FROM jsonb_array_elements(messages) m
             WHERE m->>'role' = 'user'
             LIMIT 1),
            messages->0->>'text'
          ) AS preview,
          COALESCE(started_at, created_at) AS "startedAt"
         FROM voice_conversations
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 200`,
        [userId]
      );

      res.json({
        success: true,
        conversations: result.rows,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET – o conversație completă
app.get(
  "/api/voice/conversations/:id",
  requireAuth,
  async (req, res, next) => {
    try {
      const conversationId = parseVoiceConversationId(req.params.id);

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: "ID-ul conversației nu este valid.",
        });
      }

      const userId = await getReadingUserId(req);

      const result = await pool.query(
        `SELECT
          id,
          title,
          book_title AS "bookTitle",
          duration_seconds AS "durationSeconds",
          messages,
          COALESCE(started_at, created_at) AS "startedAt"
         FROM voice_conversations
         WHERE id = $1 AND user_id = $2
         LIMIT 1`,
        [conversationId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Conversația nu a fost găsită.",
        });
      }

      res.json({
        success: true,
        conversation: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST – salvează o conversație după ce s-a încheiat
app.post(
  "/api/voice/conversations",
  requireAuth,
  async (req, res, next) => {
    try {
      const {
        elevenlabsConversationId,
        title,
        bookTitle,
        messages,
        durationSeconds,
        startedAt,
      } = req.body || {};

      if (
        !Array.isArray(messages) ||
        messages.length === 0 ||
        messages.length > VOICE_MAX_MESSAGES
      ) {
        return res.status(400).json({
          success: false,
          error: "Conversația nu conține mesaje valide.",
        });
      }

      const cleanMessages = [];

      for (const message of messages) {
        const role = message?.role;
        const text = cleanVoiceText(
          message?.text,
          VOICE_MAX_MESSAGE_LENGTH
        );

        if ((role !== "user" && role !== "agent") || !text) {
          return res.status(400).json({
            success: false,
            error: "Conversația conține mesaje invalide.",
          });
        }

        const at = new Date(message.at);

        cleanMessages.push({
          role,
          text,
          at: Number.isNaN(at.getTime()) ? null : at.toISOString(),
        });
      }

      const cleanBookTitle = cleanVoiceText(
        bookTitle,
        VOICE_MAX_TITLE_LENGTH
      );

      const cleanTitle =
        cleanVoiceText(title, VOICE_MAX_TITLE_LENGTH) ||
        (cleanBookTitle
          ? `About ${cleanBookTitle}`
          : "Chat with Laica");

      const duration = Math.max(
        0,
        Math.min(24 * 60 * 60, Math.round(Number(durationSeconds) || 0))
      );

      const start = new Date(startedAt);

      const userId = await getReadingUserId(req);

      const result = await pool.query(
        `INSERT INTO voice_conversations
          (
            user_id,
            elevenlabs_conversation_id,
            title,
            book_title,
            messages,
            duration_seconds,
            started_at
          )
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         RETURNING id`,
        [
          userId,
          cleanVoiceText(elevenlabsConversationId, 100),
          cleanTitle,
          cleanBookTitle,
          JSON.stringify(cleanMessages),
          duration,
          Number.isNaN(start.getTime()) ? null : start.toISOString(),
        ]
      );

      res.status(201).json({
        success: true,
        id: result.rows[0].id,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE – șterge o conversație salvată
app.delete(
  "/api/voice/conversations/:id",
  requireAuth,
  async (req, res, next) => {
    try {
      const conversationId = parseVoiceConversationId(req.params.id);

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: "ID-ul conversației nu este valid.",
        });
      }

      const userId = await getReadingUserId(req);

      const result = await pool.query(
        `DELETE FROM voice_conversations
         WHERE id = $1 AND user_id = $2`,
        [conversationId, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: "Conversația nu a fost găsită.",
        });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// =========================================================
// ROOT
// =========================================================

app.get("/", (req, res) => {
  res.json({
    message: "Paws & Pages API is running!",
  });
});

// =========================================================
// GENERATE STUDY MATERIAL
// =========================================================

app.post(
  "/api/study/generate",
  requireAuth,
  upload.single("file"),

  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Nu ai selectat niciun fișier.",
        });
      }

      console.log(
        "Fișier primit:",
        req.file.originalname
      );

      const result = await generateStudyMaterial(req.file);

      console.log("Material generat cu succes!");

      const auth0Id = req.auth?.payload?.sub;

      if (!auth0Id) {
        return res.status(401).json({
          error:
            "Nu am putut identifica utilizatorul Auth0.",
        });
      }

      const email =
        req.auth?.payload?.email || null;

      const name =
        req.auth?.payload?.name ||
        req.auth?.payload?.nickname ||
        null;

      console.log("Utilizator Auth0:", auth0Id);

      const userResult = await pool.query(
        `
        INSERT INTO users
          (auth0_id, email, name)
        VALUES
          ($1, $2, $3)

        ON CONFLICT (auth0_id)
        DO UPDATE SET
          email = COALESCE(EXCLUDED.email, users.email),
          name = COALESCE(EXCLUDED.name, users.name),
          updated_at = NOW()

        RETURNING id
        `,
        [auth0Id, email, name]
      );

      const userId = userResult.rows[0].id;

      console.log("User Tiger Data ID:", userId);

      const savedContent = JSON.stringify({
        title: result.title,
        summary: result.summary,
        keyPoints: result.keyPoints,
      });

      const materialResult = await pool.query(
        `
        INSERT INTO study_materials
          (
            user_id,
            file_name,
            file_type,
            content_summary
          )
        VALUES
          ($1, $2, $3, $4)

        RETURNING id
        `,
        [
          userId,
          req.file.originalname,
          req.file.mimetype,
          savedContent,
        ]
      );

      const materialId = materialResult.rows[0].id;

      console.log("Material Tiger Data ID:", materialId);

      const quizResult = await pool.query(
        `
        INSERT INTO quizzes
          (
            material_id,
            user_id,
            title,
            questions
          )
        VALUES
          ($1, $2, $3, $4)

        RETURNING id
        `,
        [
          materialId,
          userId,
          result.title,
          JSON.stringify(result.quiz),
        ]
      );

      const quizId = quizResult.rows[0].id;

      console.log("Quiz Tiger Data ID:", quizId);

      return res.json({
        ...result,
        materialId,
        quizId,
      });
    } catch (error) {
      console.error(
        "Eroare la generarea materialului:",
        error
      );

      const status = getErrorStatus(error);
      const temporary = isTemporaryError(error);

      if (temporary) {
        return res.status(503).json({
          error:
            "Gemini este momentan suprasolicitat sau indisponibil. Am încercat și modelul secundar. Te rugăm să încerci din nou peste puțin timp.",
          code: "GEMINI_UNAVAILABLE",
        });
      }

      if (status === 401 || status === 403) {
        return res.status(status).json({
          error:
            "Nu ești autentificat sau token-ul Auth0 nu este valid.",
          code: "AUTHENTICATION_FAILED",
        });
      }

      return res
        .status(status === 400 ? 400 : 500)
        .json({
          error:
            error.message ||
            "A apărut o eroare la procesarea materialului.",
          code: "GENERATION_FAILED",
        });
    }
  }
);

// =========================================================
// GENERATE ANOTHER QUIZ FOR AN EXISTING MATERIAL
// =========================================================

app.post(
  "/api/study/materials/:materialId/quizzes",
  requireAuth,
  async (req, res) => {
    try {
      const auth0Id = req.auth?.payload?.sub;
      const materialId = Number(req.params.materialId);

      if (
        !auth0Id ||
        !Number.isInteger(materialId) ||
        materialId <= 0
      ) {
        return res.status(400).json({
          error: "Date invalide.",
        });
      }

      // FIND USER
      const userResult = await pool.query(
        `
        SELECT id
        FROM users
        WHERE auth0_id = $1
        LIMIT 1
        `,
        [auth0Id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: "Utilizatorul nu există.",
        });
      }

      const userId = userResult.rows[0].id;

      // FIND MATERIAL AND VERIFY OWNERSHIP
      const materialResult = await pool.query(
        `
        SELECT
          id,
          file_name,
          content_summary
        FROM study_materials
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [materialId, userId]
      );

      if (materialResult.rows.length === 0) {
        return res.status(404).json({
          error: "Materialul nu a fost găsit.",
        });
      }

      const material = materialResult.rows[0];

      // READ SAVED SUMMARY
      let savedContent = null;

      try {
        savedContent =
          typeof material.content_summary === "string"
            ? JSON.parse(material.content_summary)
            : material.content_summary;
      } catch {
        savedContent = null;
      }

      const isStructuredContent =
        savedContent &&
        typeof savedContent === "object" &&
        !Array.isArray(savedContent);

      const summary = isStructuredContent
        ? savedContent.summary || ""
        : material.content_summary || "";

      const keyPoints = Array.isArray(savedContent?.keyPoints)
        ? savedContent.keyPoints
        : [];

      if (!summary && keyPoints.length === 0) {
        return res.status(400).json({
          error:
            "Materialul nu conține suficiente informații pentru generarea unui quiz nou.",
        });
      }

      // GENERATE QUIZ WITH GEMINI
      const prompt = `
Ești asistentul educațional al aplicației Paws & Pages.

Generează un quiz NOU, diferit de un test obișnuit, pe baza materialului de mai jos.

Titlul materialului:
${savedContent?.title || material.file_name}

Rezumat:
${summary}

Concepte importante:
${keyPoints
  .map((point, index) => `${index + 1}. ${point}`)
  .join("\n")}

Cerințe:
- Generează EXACT 5 întrebări.
- Fiecare întrebare trebuie să aibă EXACT 4 variante.
- O singură variantă trebuie să fie corectă.
- correctAnswer trebuie să fie indexul variantei corecte, de la 0 la 3.
- Include o explicație pentru fiecare răspuns.
- Întrebările trebuie să fie diferite și să testeze înțelegerea, nu doar memorarea.
- Nu inventa informații.
- Scrie în limba română.

Răspunsul trebuie să conțină:
- title: titlul materialului;
- summary: un rezumat scurt;
- keyPoints: conceptele importante;
- quiz: cele 5 întrebări generate.
`;

      const result = await generateWithFallback([
        {
          text: prompt,
        },
      ]);

      // COUNT EXISTING QUIZZES
      const countResult = await pool.query(
        `
        SELECT COUNT(*) AS total
        FROM quizzes
        WHERE material_id = $1
          AND user_id = $2
        `,
        [materialId, userId]
      );

      const quizNumber =
        Number(countResult.rows[0].total) + 1;

      const quizTitle = `Quiz ${quizNumber} - ${
        savedContent?.title || material.file_name
      }`;

      // SAVE NEW QUIZ
      const quizResult = await pool.query(
        `
        INSERT INTO quizzes
          (
            material_id,
            user_id,
            title,
            questions
          )
        VALUES
          ($1, $2, $3, $4)
        RETURNING id, title, questions, created_at
        `,
        [
          materialId,
          userId,
          quizTitle,
          JSON.stringify(result.quiz),
        ]
      );

      const newQuiz = quizResult.rows[0];

      console.log("Quiz nou salvat:", newQuiz.id);

      return res.status(201).json({
        success: true,
        message: "Quizul nou a fost generat!",
        quiz: {
          id: newQuiz.id,
          title: newQuiz.title,
          questions: newQuiz.questions,
          createdAt: newQuiz.created_at,
        },
      });
    } catch (error) {
      console.error(
        "Eroare la generarea unui quiz nou:",
        error
      );

      if (isTemporaryError(error)) {
        return res.status(503).json({
          error:
            "Gemini este momentan indisponibil. Încearcă din nou peste puțin timp.",
        });
      }

      return res.status(500).json({
        error:
          error.message ||
          "Nu am putut genera un quiz nou.",
      });
    }
  }
);

// =========================================================
// GET STUDY MATERIAL HISTORY
// =========================================================

app.get(
  "/api/study/materials",
  requireAuth,
  async (req, res) => {
    try {
      const auth0Id = req.auth?.payload?.sub;

      if (!auth0Id) {
        return res.status(401).json({
          error: "Nu am putut identifica utilizatorul Auth0.",
        });
      }

      const userResult = await pool.query(
        `
        SELECT id
        FROM users
        WHERE auth0_id = $1
        LIMIT 1
        `,
        [auth0Id]
      );

      if (userResult.rows.length === 0) {
        return res.json({
          success: true,
          materials: [],
        });
      }

      const userId = userResult.rows[0].id;

      const materialsResult = await pool.query(
        `
        SELECT
          sm.id,
          sm.file_name,
          sm.file_type,
          sm.content_summary,
          q.id AS quiz_id,
          q.title AS quiz_title,
          q.questions,
          q.created_at AS quiz_created_at

        FROM study_materials sm

        LEFT JOIN quizzes q
          ON q.material_id = sm.id
          AND q.user_id = sm.user_id

        WHERE sm.user_id = $1

        ORDER BY sm.id DESC, q.created_at ASC
        `,
        [userId]
      );

      const materialsMap = new Map();

      for (const row of materialsResult.rows) {
        let savedContent = null;

        try {
          savedContent = JSON.parse(row.content_summary);
        } catch {
          savedContent = null;
        }

        if (!materialsMap.has(row.id)) {
          materialsMap.set(row.id, {
            id: row.id,
            fileName: row.file_name,
            fileType: row.file_type,

            title:
              savedContent?.title ||
              row.file_name,

            summary:
              savedContent?.summary ||
              row.content_summary ||
              "",

            keyPoints:
              savedContent?.keyPoints || [],

            quizzes: [],
          });
        }

        const material = materialsMap.get(row.id);

        if (row.quiz_id !== null) {
          material.quizzes.push({
            id: row.quiz_id,
            materialId: row.id,
            title: row.quiz_title || "Quiz",
            questions: Array.isArray(row.questions)
              ? row.questions
              : [],
            createdAt: row.quiz_created_at,
          });
        }
      }

      return res.json({
        success: true,
        materials: Array.from(materialsMap.values()),
      });
    } catch (error) {
      console.error(
        "Eroare la încărcarea istoricului:",
        error
      );

      return res.status(500).json({
        error: "Nu am putut încărca istoricul materialelor.",
      });
    }
  }
);

// =========================================================
// SAVE QUIZ RESULT
// =========================================================

app.post(
  "/api/study/quiz-results",
  requireAuth,
  async (req, res) => {
    try {
      const auth0Id = req.auth?.payload?.sub;

      const {
        quizId,
        answers,
      } = req.body || {};

      // VALIDATE INPUT
      if (
        !auth0Id ||
        !Number.isInteger(Number(quizId)) ||
        !Array.isArray(answers)
      ) {
        return res.status(400).json({
          error:
            "Datele trimise pentru quiz sunt invalide.",
        });
      }

      // FIND AUTHENTICATED USER
      const userResult = await pool.query(
        `
        SELECT id
        FROM users
        WHERE auth0_id = $1
        LIMIT 1
        `,
        [auth0Id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error:
            "Utilizatorul nu există în baza de date.",
        });
      }

      const userId = userResult.rows[0].id;

      // FIND QUIZ + VERIFY OWNERSHIP
      const quizResult = await pool.query(
        `
        SELECT id, questions
        FROM quizzes
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [
          Number(quizId),
          userId,
        ]
      );

      if (quizResult.rows.length === 0) {
        return res.status(404).json({
          error: "Quizul nu a fost găsit.",
        });
      }

      const questions = quizResult.rows[0].questions;

      if (
        !Array.isArray(questions) ||
        questions.length === 0 ||
        answers.length !== questions.length
      ) {
        return res.status(400).json({
          error:
            "Numărul răspunsurilor nu corespunde quizului.",
        });
      }

      // VALIDATE + EVALUATE ANSWERS
      const answeredIndexes = new Set();

      let score = 0;

      const evaluatedAnswers = [];

      for (const answer of answers) {
        const questionIndex = Number(
          answer.questionIndex
        );

        const selectedAnswer = Number(
          answer.selectedAnswer
        );

        if (
          !Number.isInteger(questionIndex) ||
          questionIndex < 0 ||
          questionIndex >= questions.length ||
          answeredIndexes.has(questionIndex)
        ) {
          return res.status(400).json({
            error:
              "Există răspunsuri invalide sau duplicate.",
          });
        }

        const question = questions[questionIndex];

        if (
          !Number.isInteger(selectedAnswer) ||
          selectedAnswer < 0 ||
          selectedAnswer >= question.options.length
        ) {
          return res.status(400).json({
            error:
              "O variantă selectată nu este validă.",
          });
        }

        answeredIndexes.add(questionIndex);

        const isCorrect =
          selectedAnswer === question.correctAnswer;

        if (isCorrect) {
          score++;
        }

        evaluatedAnswers.push({
          questionIndex,
          selectedAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect,
        });
      }

      // SAVE RESULT IN TIGERDATA
      const savedResult = await pool.query(
        `
        INSERT INTO quiz_results
          (
            quiz_id,
            user_id,
            score,
            total_questions,
            answers,
            completed_at
          )
        VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5::jsonb,
            NOW()
          )

        RETURNING
          id,
          quiz_id,
          user_id,
          score,
          total_questions,
          answers,
          completed_at
        `,
        [
          Number(quizId),
          userId,
          score,
          questions.length,
          JSON.stringify(evaluatedAnswers),
        ]
      );

      console.log(
        "Rezultat quiz salvat în TigerData:",
        savedResult.rows[0].id
      );

      return res.status(201).json({
        success: true,
        message: "Rezultatul quizului a fost salvat!",
        result: savedResult.rows[0],
      });
    } catch (error) {
      console.error(
        "Eroare la salvarea rezultatului quizului:",
        error
      );

      return res.status(500).json({
        error:
          "Nu am putut salva rezultatul quizului.",
      });
    }
  }
);

// =========================================================
// ERROR HANDLER
// =========================================================

app.use(
  (error, req, res, next) => {
    console.error("Server error:", error);

    if (res.headersSent) {
      return next(error);
    }

    res.status(error.status || 500).json({
      success: false,
      error:
        error.message ||
        "A apărut o eroare pe server.",
    });
  }
);

// =========================================================
// START SERVER
// =========================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Paws & Pages API running on port ${PORT}`
    );

    console.log(
      `Model principal: ${PRIMARY_MODEL}`
    );

    console.log(
      `Model secundar: ${FALLBACK_MODEL}`
    );

    console.log(
      `Auth0 domain: ${process.env.AUTH0_DOMAIN}`
    );

    console.log(
      `Auth0 audience: ${process.env.AUTH0_AUDIENCE}`
    );
  }
);
