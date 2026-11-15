// /api/reading/reviews – star ratings and written reviews for the books a
// user has finished. A user can only see and change reviews of their own
// books; the acting user always comes from the Auth0 token.

import { Router } from "express";

import { cleanText } from "./validation.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 4000;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Same cover logic as BOOK_COLUMNS in index.js.
const BOOK_FIELDS = `
  b.id AS book_id,
  b.title,
  b.author,
  b.total_pages,
  b.status AS book_status,
  b.finished_at,
  CASE
    WHEN b.cover_data IS NOT NULL THEN
      'data:' || COALESCE(b.cover_mime_type, 'image/jpeg') || ';base64,' ||
      replace(encode(b.cover_data, 'base64'), E'\\n', '')
    ELSE b.cover_url
  END AS cover_url`;

function mapBook(row) {
  return {
    id: row.book_id,
    title: row.title,
    author: row.author,
    pages: row.total_pages,
    status: row.book_status,
    finishedAt: row.finished_at,
    coverUrl: row.cover_url ?? null,
  };
}

function mapReview(row) {
  if (row.review_id === null || row.review_id === undefined) return null;

  return {
    id: Number(row.review_id),
    bookId: row.book_id,
    rating: row.rating,
    body: row.body,
    createdAt: row.review_created_at,
    updatedAt: row.review_updated_at,
  };
}

const REVIEW_FIELDS = `
  r.id AS review_id,
  r.rating,
  r.body,
  r.created_at AS review_created_at,
  r.updated_at AS review_updated_at`;

export function createReviewsRouter({ requireAuth, pool }) {
  const router = Router();

  router.use(requireAuth);

  async function getUserId(req) {
    const auth0Id = req.auth?.payload?.sub;

    if (!auth0Id) {
      throw new HttpError(401, "UNAUTHENTICATED", "Please log in again.");
    }

    const result = await pool.query(
      `SELECT id FROM users WHERE auth0_id = $1 LIMIT 1`,
      [auth0Id]
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "USER_NOT_SYNCED", "Your account isn't set up yet. Please log in again.");
    }

    return result.rows[0].id;
  }

  function requireBookId(value) {
    if (!UUID.test(String(value ?? ""))) {
      throw new HttpError(404, "NOT_FOUND", "Book not found.");
    }
    return value;
  }

  /** The user's own book plus its review (if any). Null if not theirs. */
  async function loadBookWithReview(userId, bookId, db = pool) {
    const result = await db.query(
      `SELECT ${BOOK_FIELDS}, ${REVIEW_FIELDS}
       FROM reading_books b
       LEFT JOIN book_reviews r ON r.book_id = b.id
       WHERE b.id = $1 AND b.user_id = $2::text`,
      [bookId, userId]
    );

    return result.rows[0] ?? null;
  }

  // -------------------------------------------------------
  // GET /api/reading/reviews
  // All reviews, plus finished books still waiting for one.
  // -------------------------------------------------------

  router.get("/", async (req, res, next) => {
    try {
      const userId = await getUserId(req);

      const result = await pool.query(
        `SELECT ${BOOK_FIELDS}, ${REVIEW_FIELDS}
         FROM reading_books b
         LEFT JOIN book_reviews r ON r.book_id = b.id
         WHERE b.user_id = $1::text
           AND (r.id IS NOT NULL OR b.status = 'finished')
         ORDER BY
           (r.id IS NULL) DESC,
           COALESCE(r.updated_at, b.finished_at, b.updated_at) DESC`,
        [userId]
      );

      const reviews = [];
      const awaiting = [];

      for (const row of result.rows) {
        const review = mapReview(row);

        if (review) {
          reviews.push({ ...review, book: mapBook(row) });
        } else {
          awaiting.push(mapBook(row));
        }
      }

      res.json({ success: true, reviews, awaiting });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // GET /api/reading/reviews/:bookId
  // -------------------------------------------------------

  router.get("/:bookId", async (req, res, next) => {
    try {
      const userId = await getUserId(req);
      const bookId = requireBookId(req.params.bookId);
      const row = await loadBookWithReview(userId, bookId);

      if (!row) throw new HttpError(404, "NOT_FOUND", "Book not found.");

      const review = mapReview(row);

      res.json({
        success: true,
        book: mapBook(row),
        review,
        // Reviews are for finished books; an existing review stays editable
        // even if the book is being re-read.
        canReview: row.book_status === "finished" || Boolean(review),
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // PUT /api/reading/reviews/:bookId – create or update
  // -------------------------------------------------------

  router.put("/:bookId", async (req, res, next) => {
    const client = await pool.connect();
    let open = false;

    try {
      const userId = await getUserId(req);
      const bookId = requireBookId(req.params.bookId);

      const rating = Number(req.body?.rating);

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new HttpError(400, "INVALID_RATING", "Choose a rating from 1 to 5 stars.");
      }

      const body = cleanText(req.body?.body, {
        field: "Your review",
        max: MAX_BODY,
        multiline: true,
      });

      if (!body.ok) throw new HttpError(400, "INVALID_INPUT", body.error);

      await client.query("BEGIN");
      open = true;

      // Lock the book so a concurrent "read again" can't slip in between
      // the check and the insert.
      const book = await client.query(
        `SELECT b.status, r.id AS review_id
         FROM reading_books b
         LEFT JOIN book_reviews r ON r.book_id = b.id
         WHERE b.id = $1 AND b.user_id = $2::text
         FOR UPDATE OF b`,
        [bookId, userId]
      );

      if (book.rowCount === 0) throw new HttpError(404, "NOT_FOUND", "Book not found.");

      if (book.rows[0].status !== "finished" && !book.rows[0].review_id) {
        throw new HttpError(409, "BOOK_NOT_FINISHED", "You can review a book once you've finished it.");
      }

      await client.query(
        `INSERT INTO book_reviews (user_id, book_id, rating, body)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (book_id) DO UPDATE SET
           rating = EXCLUDED.rating,
           body = EXCLUDED.body,
           updated_at = NOW()`,
        [userId, bookId, rating, body.value]
      );

      await client.query("COMMIT");
      open = false;

      const row = await loadBookWithReview(userId, bookId);

      res.json({ success: true, book: mapBook(row), review: mapReview(row) });
    } catch (error) {
      if (open) await client.query("ROLLBACK").catch(() => {});
      next(error);
    } finally {
      client.release();
    }
  });

  // -------------------------------------------------------
  // DELETE /api/reading/reviews/:bookId
  // -------------------------------------------------------

  router.delete("/:bookId", async (req, res, next) => {
    try {
      const userId = await getUserId(req);
      const bookId = requireBookId(req.params.bookId);

      const result = await pool.query(
        `DELETE FROM book_reviews r
         USING reading_books b
         WHERE r.book_id = b.id
           AND b.id = $1
           AND b.user_id = $2
           AND r.user_id = $3`,
        // reading_books.user_id is TEXT, book_reviews.user_id is INTEGER.
        [bookId, String(userId), userId]
      );

      if (result.rowCount === 0) throw new HttpError(404, "NOT_FOUND", "Review not found.");

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Errors stay inside this router so SQL details never leak.
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    if (error instanceof HttpError) {
      return res.status(error.status).json({ success: false, code: error.code, error: error.message });
    }

    if (error?.status === 401 || error?.statusCode === 401) {
      return res.status(401).json({ success: false, code: "UNAUTHENTICATED", error: "Please log in again." });
    }

    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ success: false, code: "INVALID_INPUT", error: "The request body isn't valid JSON." });
    }

    console.error("Reviews error:", error);

    res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      error: "Something went wrong on our side. Please try again.",
    });
  });

  return router;
}
