// Shared input validation for usernames, student emails and free text.
// Everything here is pure so it can be unit-tested without a database.

export const STUDENT_EMAIL_DOMAIN = "student.upt.ro";

const STUDENT_EMAIL_PATTERN = /^[a-z0-9._%+-]+@student\.upt\.ro$/;

/** True only for addresses whose domain is exactly student.upt.ro. */
export function isStudentEmail(email) {
  if (typeof email !== "string") return false;
  return STUDENT_EMAIL_PATTERN.test(email.trim().toLowerCase());
}

export function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// ---------------------------------------------------------
// USERNAMES
// ---------------------------------------------------------

export const USERNAME_RULES =
  "3–20 characters: letters, numbers and underscores. It must contain a letter and can't start or end with an underscore.";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

// Names that could be mistaken for staff, the app itself or system values.
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "campus",
  "help",
  "laica",
  "me",
  "mod",
  "moderator",
  "null",
  "official",
  "paws",
  "pawsandpages",
  "pawspages",
  "root",
  "security",
  "staff",
  "support",
  "system",
  "undefined",
  "upt",
]);

/**
 * Validates and normalizes a username. Returns { ok, username, error }.
 * The display form keeps the user's capitalization; uniqueness is checked
 * case-insensitively by the database index on LOWER(username).
 */
export function validateUsername(input) {
  if (typeof input !== "string") {
    return { ok: false, error: "Please choose a username." };
  }

  // NFKC folds look-alike forms (full-width letters, ligatures) before the
  // ASCII-only check, so they are rejected instead of slipping through.
  const username = input.normalize("NFKC").trim();

  if (!username) {
    return { ok: false, error: "Please choose a username." };
  }

  if (username.includes("@")) {
    return { ok: false, error: "A username can't be an email address." };
  }

  if (/\s/.test(username)) {
    return { ok: false, error: "A username can't contain spaces." };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return { ok: false, error: `Usernames must be ${USERNAME_RULES}` };
  }

  if (!/[A-Za-z]/.test(username)) {
    return { ok: false, error: "A username must contain at least one letter." };
  }

  if (username.startsWith("_") || username.endsWith("_") || username.includes("__")) {
    return {
      ok: false,
      error: "Underscores can't be at the start or end, or next to each other.",
    };
  }

  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { ok: false, error: "That username is reserved. Please pick another one." };
  }

  return { ok: true, username };
}

// ---------------------------------------------------------
// FREE TEXT
// ---------------------------------------------------------

/**
 * Removes control characters (keeping newlines when multiline), normalizes
 * line endings and trims. Returns { ok, value, error }; value is null for
 * empty optional fields.
 */
export function cleanText(input, { field, max, required = false, multiline = false }) {
  if (input === undefined || input === null) {
    input = "";
  }

  if (typeof input !== "string") {
    return { ok: false, error: `${field} must be text.` };
  }

  let value = input.normalize("NFC").replace(/\r\n?/g, "\n");

  value = multiline
    ? value.replace(/[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    : value.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, " ");

  if (multiline) {
    value = value.replace(/\n{3,}/g, "\n\n");
  } else {
    value = value.replace(/\s+/g, " ");
  }

  value = value.trim();

  if (!value) {
    return required
      ? { ok: false, error: `${field} is required.` }
      : { ok: true, value: null };
  }

  if (value.length > max) {
    return { ok: false, error: `${field} can be at most ${max} characters.` };
  }

  return { ok: true, value };
}

export const CAMPUS_CATEGORIES = [
  "Computer Science",
  "Engineering",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Economics",
  "Architecture",
  "Languages",
  "Literature",
  "Other",
];

export function parsePositiveId(value) {
  const text = String(value ?? "");
  if (!/^[1-9][0-9]{0,15}$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) ? id : null;
}
