import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { auth } from "express-oauth2-jwt-bearer";
import JSZip from "jszip";
import mammoth from "mammoth";
import multer from "multer";
import sharp from "sharp";

import { pool } from "./db.js";
import { createShopRouter } from "./shop.js";
import { getOrCreateUserWallet, getPawBalance } from "./solana.js";

dotenv.config();

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

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.8-flash";

// --------------------------------------------------
// AUTH0
// --------------------------------------------------

const requireAuth = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  audience: process.env.AUTH0_AUDIENCE,
});

// --------------------------------------------------
// GENERAL CONFIG
// --------------------------------------------------

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// SHOP - SOLANA PAW TOKEN
// --------------------------------------------------

app.use("/api/shop", createShopRouter({ requireAuth }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// --------------------------------------------------
// FILE UPLOAD
// --------------------------------------------------

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
        new Error("Format nesuportat. Încarcă PDF, DOCX, PPTX sau o imagine."),
      );
    }

    callback(null, true);
  },
});

// --------------------------------------------------
// XML HELPERS
// --------------------------------------------------

function decodeXml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    );
}

// --------------------------------------------------
// POWERPOINT EXTRACTION
// --------------------------------------------------

async function extractPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numberA = Number(a.match(/slide(\d+)\.xml$/)[1]);

      const numberB = Number(b.match(/slide(\d+)\.xml$/)[1]);

      return numberA - numberB;
    });

  const slides = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");

    const texts = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXml(match[1]))
      .filter(Boolean);

    if (texts.length > 0) {
      slides.push(`Slide ${i + 1}:\n${texts.join(" ")}`);
    }
  }

  return slides.join("\n\n");
}

// --------------------------------------------------
// GEMINI RESPONSE SCHEMA
// --------------------------------------------------

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

        required: ["question", "options", "correctAnswer", "explanation"],
      },
    },
  },

  required: ["title", "summary", "keyPoints", "quiz"],
};

// --------------------------------------------------
// GEMINI ERROR HELPERS
// --------------------------------------------------

function getErrorStatus(error) {
  const status = error?.status || error?.code || error?.response?.status;

  if (typeof status === "number") {
    return status;
  }

  const message = String(error?.message || "");

  const match = message.match(/\b(400|401|403|404|429|500|502|503|504)\b/);

  return match ? Number(match[1]) : null;
}

function isTemporaryError(error) {
  const status = getErrorStatus(error);

  if ([429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = String(error?.message || "").toLowerCase();

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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --------------------------------------------------
// GEMINI - MAXIMUM 5 ATTEMPTS
// --------------------------------------------------

async function generateWithModel(model, parts) {
  const maxAttempts = 5;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `Gemini model: ${model} | încercarea ${attempt}/${maxAttempts}`,
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
        throw new Error("Gemini nu a returnat un răspuns.");
      }

      const result = JSON.parse(response.text);

      if (
        !result.title ||
        !result.summary ||
        !Array.isArray(result.keyPoints) ||
        !Array.isArray(result.quiz)
      ) {
        throw new Error("Răspunsul Gemini are un format invalid.");
      }

      if (
        result.quiz.length !== 5 ||
        result.quiz.some(
          (question) =>
            !Array.isArray(question.options) ||
            question.options.length !== 4 ||
            !Number.isInteger(question.correctAnswer) ||
            question.correctAnswer < 0 ||
            question.correctAnswer > 3,
        )
      ) {
        throw new Error(
          "Gemini nu a generat un quiz valid cu 5 întrebări și 4 variante.",
        );
      }

      return result;
    } catch (error) {
      lastError = error;

      console.error(
        `Eroare Gemini (${model}, încercarea ${attempt}/${maxAttempts}):`,
        error?.message || error,
      );

      if (!isTemporaryError(error) || attempt === maxAttempts) {
        throw error;
      }

      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 16000);

      console.log(`Reîncercăm în ${delay / 1000} secunde...`);

      await wait(delay);
    }
  }

  throw lastError;
}

// --------------------------------------------------
// GEMINI FALLBACK
// --------------------------------------------------

async function generateWithFallback(parts) {
  const models = [...new Set([PRIMARY_MODEL, FALLBACK_MODEL])];

  let lastError;

  for (let index = 0; index < models.length; index++) {
    const model = models[index];

    try {
      const result = await generateWithModel(model, parts);

      console.log(`Material generat cu modelul ${model}`);

      return result;
    } catch (error) {
      lastError = error;

      const status = getErrorStatus(error);

      console.error(`Modelul ${model} a eșuat. Status: ${status}`);

      if (index === models.length - 1) {
        break;
      }

      if (!isTemporaryError(error) && status !== 404) {
        throw error;
      }

      console.log(`Încercăm modelul secundar: ${models[index + 1]}`);
    }
  }

  throw lastError || new Error("Toate modelele Gemini au eșuat.");
}

// --------------------------------------------------
// STUDY MATERIAL GENERATION
// --------------------------------------------------

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
    throw new Error("Format de fișier nesuportat.");
  }

  return generateWithFallback(parts);
}

// --------------------------------------------------
// AUTH0 USER SYNC + SOLANA WALLET
// --------------------------------------------------

app.post("/api/auth/sync", requireAuth, async (req, res) => {
  try {
    const auth0Id = req.auth?.payload?.sub;

    if (!auth0Id) {
      return res.status(401).json({
        error: "Nu am putut identifica utilizatorul Auth0.",
      });
    }

    const email = req.auth?.payload?.email || req.body?.email || null;

    const name =
      req.auth?.payload?.name ||
      req.auth?.payload?.nickname ||
      req.body?.name ||
      null;

    // SAVE / UPDATE USER
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
      [auth0Id, email, name],
    );

    const user = userResult.rows[0];

    console.log("Utilizator sincronizat cu TigerData:", user.id);

    // CREATE / RETRIEVE SOLANA WALLET
    const walletAddress = await getOrCreateUserWallet(user.id);

    // READ REAL PAW BALANCE FROM SOLANA
    const pawBalance = await getPawBalance(walletAddress);

    console.log("Wallet Solana:", walletAddress);

    console.log("Sold PAW:", pawBalance);

    return res.json({
      success: true,
      message: "Utilizator sincronizat cu TigerData!",
      user: {
        ...user,
        solana_wallet_address: walletAddress,
      },
      wallet: {
        address: walletAddress,
        pawBalance,
      },
    });
  } catch (error) {
    console.error("Eroare la sincronizarea utilizatorului:", error);

    return res.status(500).json({
      error: "Nu am putut sincroniza utilizatorul sau wallet-ul Solana.",
    });
  }
});

// --------------------------------------------------
// SOLANA WALLET - GET BALANCE
// --------------------------------------------------

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
      [auth0Id],
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

// --------------------------------------------------
// ROOT
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    message: "Paws & Pages API is running!",
  });
});

// --------------------------------------------------
// GENERATE STUDY MATERIAL
// --------------------------------------------------

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

      console.log("Fișier primit:", req.file.originalname);

      // GEMINI
      const result = await generateStudyMaterial(req.file);

      console.log("Material generat cu succes!");

      // AUTH0 USER
      const auth0Id = req.auth?.payload?.sub;

      if (!auth0Id) {
        return res.status(401).json({
          error: "Nu am putut identifica utilizatorul Auth0.",
        });
      }

      const email = req.auth?.payload?.email || null;

      const name =
        req.auth?.payload?.name || req.auth?.payload?.nickname || null;

      console.log("Utilizator Auth0:", auth0Id);

      // SAVE / UPDATE USER
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
        [auth0Id, email, name],
      );

      const userId = userResult.rows[0].id;

      console.log("User Tiger Data ID:", userId);

      // SAVE STUDY MATERIAL
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
        [userId, req.file.originalname, req.file.mimetype, result.summary],
      );

      const materialId = materialResult.rows[0].id;

      console.log("Material Tiger Data ID:", materialId);

      // SAVE QUIZ
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
        [materialId, userId, result.title, JSON.stringify(result.quiz)],
      );

      const quizId = quizResult.rows[0].id;

      console.log("Quiz Tiger Data ID:", quizId);

      // RESPONSE
      return res.json({
        ...result,
        materialId,
        quizId,
      });
    } catch (error) {
      console.error("Eroare la generarea materialului:", error);

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
          error: "Nu ești autentificat sau token-ul Auth0 nu este valid.",
          code: "AUTHENTICATION_FAILED",
        });
      }

      return res.status(status === 400 ? 400 : 500).json({
        error: error.message || "A apărut o eroare la procesarea materialului.",
        code: "GENERATION_FAILED",
      });
    }
  },
);

// --------------------------------------------------
// SAVE QUIZ RESULT
// --------------------------------------------------

app.post("/api/study/quiz-results", requireAuth, async (req, res) => {
  try {
    const auth0Id = req.auth?.payload?.sub;
    const { quizId, answers } = req.body;

    // VALIDATE INPUT
    if (
      !auth0Id ||
      !Number.isInteger(Number(quizId)) ||
      !Array.isArray(answers)
    ) {
      return res.status(400).json({
        error: "Datele trimise pentru quiz sunt invalide.",
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
      [auth0Id],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "Utilizatorul nu există în baza de date.",
      });
    }

    const userId = userResult.rows[0].id;

    // FIND QUIZ AND VERIFY OWNERSHIP
    const quizResult = await pool.query(
      `
        SELECT id, questions
        FROM quizzes
        WHERE id = $1 AND user_id = $2
        LIMIT 1
        `,
      [Number(quizId), userId],
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
        error: "Numărul răspunsurilor nu corespunde quizului.",
      });
    }

    // VALIDATE AND EVALUATE ANSWERS ON THE SERVER
    const answeredIndexes = new Set();
    let score = 0;

    const evaluatedAnswers = [];

    for (const answer of answers) {
      const questionIndex = Number(answer.questionIndex);
      const selectedAnswer = Number(answer.selectedAnswer);

      if (
        !Number.isInteger(questionIndex) ||
        questionIndex < 0 ||
        questionIndex >= questions.length ||
        answeredIndexes.has(questionIndex)
      ) {
        return res.status(400).json({
          error: "Există răspunsuri invalide sau duplicate.",
        });
      }

      const question = questions[questionIndex];

      if (
        !Number.isInteger(selectedAnswer) ||
        selectedAnswer < 0 ||
        selectedAnswer >= question.options.length
      ) {
        return res.status(400).json({
          error: "O variantă selectată nu este validă.",
        });
      }

      answeredIndexes.add(questionIndex);

      const isCorrect = selectedAnswer === question.correctAnswer;

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
          (quiz_id, user_id, score, total_questions, answers, completed_at)
        VALUES
          ($1, $2, $3, $4, $5::jsonb, NOW())
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
      ],
    );

    console.log("Rezultat quiz salvat în TigerData:", savedResult.rows[0].id);

    return res.status(201).json({
      success: true,
      message: "Rezultatul quizului a fost salvat!",
      result: savedResult.rows[0],
    });
  } catch (error) {
    console.error("Eroare la salvarea rezultatului quizului:", error);

    return res.status(500).json({
      error: "Nu am putut salva rezultatul quizului.",
    });
  }
});

// --------------------------------------------------
// UPLOAD ERROR HANDLER
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error("Upload error:", error);

  res.status(400).json({
    error: error.message || "Eroare la încărcarea fișierului.",
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Paws & Pages API running on port ${PORT}`);

  console.log(`Model principal: ${PRIMARY_MODEL}`);

  console.log(`Model secundar: ${FALLBACK_MODEL}`);

  console.log(`Auth0 domain: ${process.env.AUTH0_DOMAIN}`);

  console.log(`Auth0 audience: ${process.env.AUTH0_AUDIENCE}`);
});
