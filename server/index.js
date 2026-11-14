
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import mammoth from "mammoth";
import JSZip from "jszip";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Lipsește GEMINI_API_KEY din server/.env");
}

const app = express();
const PORT = process.env.PORT || 3001;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(cors());
app.use(express.json());

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

const responseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    keyPoints: {
      type: "array",
      items: { type: "string" },
    },
    quiz: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
          },
          correctAnswer: { type: "integer" },
          explanation: { type: "string" },
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
  required: ["title", "summary", "keyPoints", "quiz"],
};

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

  const parts = [{ text: prompt }];

  // PDF
  if (extension === ".pdf") {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: file.buffer.toString("base64"),
      },
    });
  }

  // Fotografii
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

  // Word
  else if (extension === ".docx") {
    const result = await mammoth.extractRawText({
      buffer: file.buffer,
      //console.log("1. Text extras din Word:", result.value.length, "caractere");
    });

    parts.push({
      text: `Conținut Word:\n\n${result.value}`,
    });
  }

  // PowerPoint
  else if (extension === ".pptx") {
    const text = await extractPptx(file.buffer);

    parts.push({
      text: `Conținut PowerPoint:\n\n${text}`,
    });
  }

  const response = await ai.models.generateContent({
    model: MODEL,
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

  return JSON.parse(response.text);
}

app.get("/", (req, res) => {
  res.json({
    message: "Paws & Pages API is running!",
  });
});

app.post(
  "/api/study/generate",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Nu ai selectat niciun fișier.",
        });
      }

      console.log("Fișier primit:", req.file.originalname);

      const result = await generateStudyMaterial(req.file);

      console.log("Material generat cu succes!");

      res.json(result);
    } catch (error) {
      console.error("Eroare:", error);

      res.status(500).json({
        error:
          error.message ||
          "A apărut o eroare la procesarea materialului.",
      });
    }
  }
);

// Gestionează și erorile de upload.
app.use((error, req, res, next) => {
  console.error("Upload error:", error);

  res.status(400).json({
    error: error.message || "Eroare la încărcarea fișierului.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Paws & Pages API running on port ${PORT}`);
});
