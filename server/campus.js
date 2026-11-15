// /api/campus – book listings, borrow requests and private chats between
// verified UPT students. Every route runs behind requireCampusAccess, and the
// acting user always comes from req.campusUser (derived from the Auth0 token),
// never from the request body.
//
// Campus is completely separate from the PAW / Solana economy: nothing here
// reads or writes balances or token transactions.

import { Router } from "express";
import multer from "multer";
import sharp from "sharp";

import { Auth0RequestError } from "./auth0Client.js";
import { CAMPUS_CATEGORIES, cleanText, parsePositiveId } from "./validation.js";

const MAX_COVER_BYTES = 6 * 1024 * 1024;
const MESSAGES_PER_MINUTE = 20;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COVER_BYTES, files: 1, fields: 20 },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new HttpError(400, "INVALID_COVER", "The cover must be an image."));
    }

    callback(null, true);
  },
});

/** Re-encodes covers so stored images are small, valid and stripped of metadata. */
async function processCover(file) {
  if (!file) return null;

  try {
    const data = await sharp(file.buffer, { animated: false })
      .rotate()
      .resize({ width: 600, height: 900, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    return { data, mimeType: "image/jpeg" };
  } catch {
    throw new HttpError(400, "INVALID_COVER", "We couldn't read that image. Try a JPG or PNG.");
  }
}

function toId(value) {
  return value === null || value === undefined ? null : Number(value);
}

const COVER_SQL = `
  CASE WHEN b.cover_data IS NOT NULL THEN
    'data:' || COALESCE(b.cover_mime_type, 'image/jpeg') || ';base64,' ||
    replace(encode(b.cover_data, 'base64'), E'\\n', '')
  END`;

// $1 is always the current user's id.
const BOOK_SELECT = `
  SELECT
    b.id, b.owner_id, b.title, b.author, b.description, b.category, b.notes,
    b.status, b.created_at, b.updated_at,
    ${COVER_SQL} AS cover_url,
    owner.username AS owner_username,
    (
      SELECT jsonb_build_object('id', r.id, 'status', r.status)
      FROM campus_borrow_requests r
      WHERE r.book_id = b.id AND r.requester_id = $1
        AND r.status IN ('pending', 'accepted')
      LIMIT 1
    ) AS my_request,
    CASE WHEN b.owner_id = $1 THEN (
      SELECT COUNT(*)::int FROM campus_borrow_requests r
      WHERE r.book_id = b.id AND r.status = 'pending'
    ) END AS pending_requests,
    (
      SELECT c.id FROM campus_conversations c
      JOIN campus_borrow_requests r ON r.id = c.request_id
      WHERE c.book_id = b.id AND r.status = 'accepted'
        AND (c.owner_id = $1 OR c.requester_id = $1)
      LIMIT 1
    ) AS active_conversation_id
  FROM campus_books b
  JOIN users owner ON owner.id = b.owner_id`;

function mapBook(row, meId) {
  const isOwner = row.owner_id === meId;

  return {
    id: toId(row.id),
    title: row.title,
    author: row.author,
    description: row.description,
    category: row.category,
    notes: row.notes,
    status: row.status,
    coverUrl: row.cover_url ?? null,
    owner: { username: row.owner_username },
    isOwner,
    myRequest: row.my_request
      ? { id: toId(row.my_request.id), status: row.my_request.status }
      : null,
    pendingRequests: isOwner ? row.pending_requests ?? 0 : null,
    activeConversationId: toId(row.active_conversation_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REQUEST_SELECT = `
  SELECT
    r.id, r.status, r.message, r.created_at, r.updated_at, r.responded_at, r.returned_at,
    r.book_id, r.owner_id, r.requester_id,
    b.title, b.author, b.status AS book_status, (b.deleted_at IS NOT NULL) AS book_removed,
    ${COVER_SQL} AS cover_url,
    owner.username AS owner_username,
    requester.username AS requester_username,
    c.id AS conversation_id
  FROM campus_borrow_requests r
  JOIN campus_books b ON b.id = r.book_id
  JOIN users owner ON owner.id = r.owner_id
  JOIN users requester ON requester.id = r.requester_id
  LEFT JOIN campus_conversations c ON c.request_id = r.id`;

function mapRequest(row, meId) {
  const isOwner = row.owner_id === meId;

  return {
    id: toId(row.id),
    status: row.status,
    message: row.message,
    direction: isOwner ? "incoming" : "outgoing",
    book: {
      id: toId(row.book_id),
      title: row.title,
      author: row.author,
      status: row.book_status,
      removed: row.book_removed,
      coverUrl: row.cover_url ?? null,
    },
    otherUsername: isOwner ? row.requester_username : row.owner_username,
    conversationId: toId(row.conversation_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    respondedAt: row.responded_at,
    returnedAt: row.returned_at,
  };
}

function mapMessage(row, meId) {
  return {
    id: toId(row.id),
    body: row.body,
    fromMe: row.sender_id === meId,
    senderUsername: row.sender_username,
    createdAt: row.created_at,
  };
}

/** Validates listing fields. `partial` allows omitted fields (PATCH). */
function readBookFields(body, { partial }) {
  const fields = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body ?? {}, key);

  const specs = [
    ["title", { field: "Title", max: 200, required: true }],
    ["author", { field: "Author", max: 120, required: true }],
    ["description", { field: "Description", max: 2000, multiline: true }],
    ["notes", { field: "Notes", max: 1000, multiline: true }],
  ];

  for (const [key, spec] of specs) {
    if (partial && !has(key)) continue;

    const result = cleanText(body?.[key], spec);
    if (!result.ok) throw new HttpError(400, "INVALID_INPUT", result.error);
    fields[key] = result.value;
  }

  if (!partial || has("category")) {
    const category = cleanText(body?.category, { field: "Category", max: 60 });
    if (!category.ok) throw new HttpError(400, "INVALID_INPUT", category.error);

    if (category.value && !CAMPUS_CATEGORIES.includes(category.value)) {
      throw new HttpError(400, "INVALID_INPUT", "Please choose one of the listed categories.");
    }

    fields.category = category.value;
  }

  return fields;
}

function escapeLike(text) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function createCampusRouter({ requireAuth, pool, access }) {
  const router = Router();

  router.use(requireAuth, access.requireCampusAccess());

  async function inTransaction(work) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function loadBook(bookId, meId, db = pool) {
    const result = await db.query(
      `${BOOK_SELECT}
       WHERE b.id = $2 AND b.deleted_at IS NULL
         AND (b.owner_id = $1 OR b.status <> 'inactive')`,
      [meId, bookId]
    );

    return result.rows[0] ? mapBook(result.rows[0], meId) : null;
  }

  function requireId(value, label) {
    const id = parsePositiveId(value);
    if (!id) throw new HttpError(404, "NOT_FOUND", `${label} not found.`);
    return id;
  }

  // =====================================================
  // ACCESS CHECK + SUMMARY
  // =====================================================

  router.get("/summary", async (req, res, next) => {
    try {
      const me = req.campusUser.id;

      const result = await pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM campus_borrow_requests
            WHERE owner_id = $1 AND status = 'pending') AS pending_incoming,
           (SELECT COUNT(*)::int FROM campus_messages m
            JOIN campus_conversations c ON c.id = m.conversation_id
            WHERE (c.owner_id = $1 OR c.requester_id = $1)
              AND m.sender_id <> $1
              AND m.id > CASE WHEN c.owner_id = $1
                              THEN c.owner_last_read_id
                              ELSE c.requester_last_read_id END) AS unread_messages`,
        [me]
      );

      res.json({
        success: true,
        username: req.campusUser.username,
        categories: CAMPUS_CATEGORIES,
        pendingIncoming: result.rows[0].pending_incoming,
        unreadMessages: result.rows[0].unread_messages,
      });
    } catch (error) {
      next(error);
    }
  });

  // =====================================================
  // BOOKS
  // =====================================================

  router.get("/books", async (req, res, next) => {
    try {
      const me = req.campusUser.id;
      const conditions = ["b.deleted_at IS NULL"];
      const params = [me];

      if (req.query.scope === "mine") {
        conditions.push("b.owner_id = $1");
      } else {
        conditions.push("(b.owner_id = $1 OR b.status <> 'inactive')");
      }

      if (req.query.availability === "available") {
        conditions.push("b.status = 'available'");
      }

      const search = cleanText(req.query.q, { field: "Search", max: 100 });
      if (search.ok && search.value) {
        params.push(`%${escapeLike(search.value)}%`);
        conditions.push(
          `(b.title ILIKE $${params.length} ESCAPE '\\' OR b.author ILIKE $${params.length} ESCAPE '\\')`
        );
      }

      if (typeof req.query.category === "string" && CAMPUS_CATEGORIES.includes(req.query.category)) {
        params.push(req.query.category);
        conditions.push(`b.category = $${params.length}`);
      }

      const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 60);
      const offset = Math.min(Math.max(Number.parseInt(req.query.offset, 10) || 0, 0), 10_000);

      params.push(limit + 1, offset);

      const result = await pool.query(
        `${BOOK_SELECT}
         WHERE ${conditions.join(" AND ")}
         ORDER BY (b.status = 'available') DESC, b.created_at DESC, b.id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const rows = result.rows.slice(0, limit);

      res.json({
        success: true,
        books: rows.map((row) => mapBook(row, me)),
        hasMore: result.rows.length > limit,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/books/:id", async (req, res, next) => {
    try {
      const bookId = requireId(req.params.id, "Book");
      const book = await loadBook(bookId, req.campusUser.id);

      if (!book) throw new HttpError(404, "NOT_FOUND", "This book isn't available any more.");

      res.json({ success: true, book });
    } catch (error) {
      next(error);
    }
  });

  router.post("/books", coverUpload.single("cover"), async (req, res, next) => {
    try {
      const me = req.campusUser.id;
      const fields = readBookFields(req.body, { partial: false });
      const cover = await processCover(req.file);

      const inserted = await pool.query(
        `INSERT INTO campus_books
           (owner_id, title, author, description, category, notes, cover_data, cover_mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          me,
          fields.title,
          fields.author,
          fields.description,
          fields.category,
          fields.notes,
          cover?.data ?? null,
          cover?.mimeType ?? null,
        ]
      );

      const book = await loadBook(toId(inserted.rows[0].id), me);

      res.status(201).json({ success: true, book });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/books/:id", coverUpload.single("cover"), async (req, res, next) => {
    try {
      const me = req.campusUser.id;
      const bookId = requireId(req.params.id, "Book");
      const fields = readBookFields(req.body, { partial: true });
      const cover = await processCover(req.file);
      const removeCover = req.body?.removeCover === "true" || req.body?.removeCover === true;

      let nextStatus = null;
      if (req.body?.status !== undefined) {
        if (!["available", "inactive"].includes(req.body.status)) {
          throw new HttpError(400, "INVALID_INPUT", "A listing can only be set to available or unavailable.");
        }
        nextStatus = req.body.status;
      }

      await inTransaction(async (client) => {
        const locked = await client.query(
          `SELECT status FROM campus_books
           WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
           FOR UPDATE`,
          [bookId, me]
        );

        if (locked.rowCount === 0) {
          throw new HttpError(404, "NOT_FOUND", "Listing not found.");
        }

        const current = locked.rows[0].status;

        if (nextStatus && current === "borrowed" && nextStatus !== current) {
          throw new HttpError(409, "BOOK_BORROWED", "This book is lent out. Mark it as returned before changing its availability.");
        }

        const sets = [];
        const params = [bookId];
        const add = (column, value) => {
          params.push(value);
          sets.push(`${column} = $${params.length}`);
        };

        for (const [key, value] of Object.entries(fields)) add(key, value);

        if (cover) {
          add("cover_data", cover.data);
          add("cover_mime_type", cover.mimeType);
        } else if (removeCover) {
          sets.push("cover_data = NULL", "cover_mime_type = NULL");
        }

        if (nextStatus && current !== "borrowed") add("status", nextStatus);

        if (sets.length > 0) {
          sets.push("updated_at = NOW()");
          await client.query(`UPDATE campus_books SET ${sets.join(", ")} WHERE id = $1`, params);
        }

        // Hidden listings can't be borrowed, so close their waiting requests.
        if (nextStatus === "inactive") {
          await client.query(
            `UPDATE campus_borrow_requests
             SET status = 'cancelled', updated_at = NOW()
             WHERE book_id = $1 AND status = 'pending'`,
            [bookId]
          );
        }
      });

      res.json({ success: true, book: await loadBook(bookId, me) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/books/:id", async (req, res, next) => {
    try {
      const me = req.campusUser.id;
      const bookId = requireId(req.params.id, "Book");

      await inTransaction(async (client) => {
        const locked = await client.query(
          `SELECT status FROM campus_books
           WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
           FOR UPDATE`,
          [bookId, me]
        );

        if (locked.rowCount === 0) {
          throw new HttpError(404, "NOT_FOUND", "Listing not found.");
        }

        if (locked.rows[0].status === "borrowed") {
          throw new HttpError(409, "BOOK_BORROWED", "This book is lent out. Mark it as returned before removing it.");
        }

        await client.query(
          `UPDATE campus_books
           SET deleted_at = NOW(), status = 'inactive', updated_at = NOW()
           WHERE id = $1`,
          [bookId]
        );

        await client.query(
          `UPDATE campus_borrow_requests
           SET status = 'cancelled', updated_at = NOW()
           WHERE book_id = $1 AND status = 'pending'`,
          [bookId]
        );
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // =====================================================
  // BORROW REQUESTS
  // =====================================================

  router.get("/requests", async (req, res, next) => {
    try {
      const me = req.campusUser.id;

      const result = await pool.query(
        `${REQUEST_SELECT}
         WHERE r.owner_id = $1 OR r.requester_id = $1
         ORDER BY r.updated_at DESC, r.id DESC
         LIMIT 300`,
        [me]
      );

      const requests = result.rows.map((row) => mapRequest(row, me));

      res.json({
        success: true,
        incoming: requests.filter((request) => request.direction === "incoming"),
        outgoing: requests.filter((request) => request.direction === "outgoing"),
      });
    } catch (error) {
      next(error);
    }
  });

  async function loadRequest(requestId, meId, db = pool) {
    const result = await db.query(
      `${REQUEST_SELECT}
       WHERE r.id = $2 AND (r.owner_id = $1 OR r.requester_id = $1)`,
      [meId, requestId]
    );

    return result.rows[0] ? mapRequest(result.rows[0], meId) : null;
  }

  router.post("/requests", async (req, res, next) => {
    try {
      const me = req.campusUser.id;
      const bookId = parsePositiveId(req.body?.bookId);

      if (!bookId) throw new HttpError(400, "INVALID_INPUT", "Choose a book to borrow.");

      const note = cleanText(req.body?.message, { field: "Message", max: 500, multiline: true });
      if (!note.ok) throw new HttpError(400, "INVALID_INPUT", note.error);

      const requestId = await inTransaction(async (client) => {
        // FOR SHARE blocks an accept/return from changing the book meanwhile.
        const book = await client.query(
          `SELECT owner_id, status FROM campus_books
           WHERE id = $1 AND deleted_at IS NULL
           FOR SHARE`,
          [bookId]
        );

        const row = book.rows[0];

        if (!row || (row.status === "inactive" && row.owner_id !== me)) {
          throw new HttpError(404, "NOT_FOUND", "This book isn't available any more.");
        }

        if (row.owner_id === me) {
          throw new HttpError(400, "OWN_BOOK", "You can't borrow your own book.");
        }

        if (row.status !== "available") {
          throw new HttpError(409, "BOOK_UNAVAILABLE", "This book is currently lent out or unavailable.");
        }

        try {
          const inserted = await client.query(
            `INSERT INTO campus_borrow_requests (book_id, requester_id, owner_id, message)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [bookId, me, row.owner_id, note.value]
          );

          return toId(inserted.rows[0].id);
        } catch (error) {
          if (error.code === "23505") {
            throw new HttpError(409, "ALREADY_REQUESTED", "You already have an open request for this book.");
          }
          throw error;
        }
      });

      res.status(201).json({ success: true, request: await loadRequest(requestId, me) });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Runs a status change on one request inside a transaction. The book row is
   * always locked before the request row, the same order used everywhere, so
   * concurrent actions serialize instead of deadlocking.
   */
  async function transition(req, { role, from, apply }) {
    const me = req.campusUser.id;
    const requestId = requireId(req.params.id, "Request");
    const roleColumn = role === "owner" ? "owner_id" : "requester_id";

    const conversationId = await inTransaction(async (client) => {
      const lookup = await client.query(
        `SELECT book_id FROM campus_borrow_requests WHERE id = $1 AND ${roleColumn} = $2`,
        [requestId, me]
      );

      if (lookup.rowCount === 0) {
        throw new HttpError(404, "NOT_FOUND", "Request not found.");
      }

      const bookId = lookup.rows[0].book_id;

      const book = await client.query(
        `SELECT status, deleted_at FROM campus_books WHERE id = $1 FOR UPDATE`,
        [bookId]
      );

      const request = await client.query(
        `SELECT * FROM campus_borrow_requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );

      const current = request.rows[0];

      if (current.status !== from) {
        throw new HttpError(409, "REQUEST_CHANGED", `This request is already ${current.status}.`);
      }

      return apply(client, { request: current, book: book.rows[0] });
    });

    return { requestId, conversationId };
  }

  router.post("/requests/:id/accept", async (req, res, next) => {
    try {
      const { requestId, conversationId } = await transition(req, {
        role: "owner",
        from: "pending",
        apply: async (client, { request, book }) => {
          if (book.deleted_at || book.status !== "available") {
            throw new HttpError(409, "BOOK_UNAVAILABLE", "This book is already lent out or unavailable.");
          }

          try {
            await client.query(
              `UPDATE campus_borrow_requests
               SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
               WHERE id = $1`,
              [request.id]
            );
          } catch (error) {
            if (error.code === "23505") {
              throw new HttpError(409, "BOOK_UNAVAILABLE", "This book has already been lent to someone else.");
            }
            throw error;
          }

          await client.query(
            `UPDATE campus_books SET status = 'borrowed', updated_at = NOW() WHERE id = $1`,
            [request.book_id]
          );

          const conversation = await client.query(
            `INSERT INTO campus_conversations (request_id, book_id, owner_id, requester_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
             RETURNING id`,
            [request.id, request.book_id, request.owner_id, request.requester_id]
          );

          return toId(conversation.rows[0].id);
        },
      });

      res.json({
        success: true,
        request: await loadRequest(requestId, req.campusUser.id),
        conversationId,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/requests/:id/reject", async (req, res, next) => {
    try {
      const { requestId } = await transition(req, {
        role: "owner",
        from: "pending",
        apply: async (client, { request }) => {
          await client.query(
            `UPDATE campus_borrow_requests
             SET status = 'rejected', responded_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [request.id]
          );
          return null;
        },
      });

      res.json({ success: true, request: await loadRequest(requestId, req.campusUser.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/requests/:id/cancel", async (req, res, next) => {
    try {
      const { requestId } = await transition(req, {
        role: "requester",
        from: "pending",
        apply: async (client, { request }) => {
          await client.query(
            `UPDATE campus_borrow_requests
             SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1`,
            [request.id]
          );
          return null;
        },
      });

      res.json({ success: true, request: await loadRequest(requestId, req.campusUser.id) });
    } catch (error) {
      next(error);
    }
  });

  // The owner confirms they have the book back; it becomes available again.
  router.post("/requests/:id/return", async (req, res, next) => {
    try {
      const { requestId } = await transition(req, {
        role: "owner",
        from: "accepted",
        apply: async (client, { request, book }) => {
          await client.query(
            `UPDATE campus_borrow_requests
             SET status = 'returned', returned_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [request.id]
          );

          if (!book.deleted_at) {
            await client.query(
              `UPDATE campus_books SET status = 'available', updated_at = NOW()
               WHERE id = $1 AND status = 'borrowed'`,
              [request.book_id]
            );
          }
          return null;
        },
      });

      res.json({ success: true, request: await loadRequest(requestId, req.campusUser.id) });
    } catch (error) {
      next(error);
    }
  });

  // =====================================================
  // CONVERSATIONS
  // =====================================================

  /** Loads a conversation only if the current user is one of its two members. */
  async function loadConversation(conversationId, meId) {
    const result = await pool.query(
      `SELECT
         c.id, c.request_id, c.book_id, c.owner_id, c.requester_id, c.created_at,
         r.status AS request_status,
         b.title AS book_title, b.author AS book_author,
         owner.username AS owner_username,
         requester.username AS requester_username
       FROM campus_conversations c
       JOIN campus_borrow_requests r ON r.id = c.request_id
       JOIN campus_books b ON b.id = c.book_id
       JOIN users owner ON owner.id = c.owner_id
       JOIN users requester ON requester.id = c.requester_id
       WHERE c.id = $1 AND (c.owner_id = $2 OR c.requester_id = $2)`,
      [conversationId, meId]
    );

    const row = result.rows[0];

    // Same 404 whether it doesn't exist or belongs to someone else, so ids
    // can't be probed.
    if (!row) throw new HttpError(404, "NOT_FOUND", "Conversation not found.");

    const iAmOwner = row.owner_id === meId;

    return {
      id: toId(row.id),
      requestId: toId(row.request_id),
      requestStatus: row.request_status,
      isOpen: row.request_status === "accepted",
      iAmOwner,
      otherUsername: iAmOwner ? row.requester_username : row.owner_username,
      book: { id: toId(row.book_id), title: row.book_title, author: row.book_author },
      createdAt: row.created_at,
    };
  }

  router.get("/conversations", async (req, res, next) => {
    try {
      const me = req.campusUser.id;

      const result = await pool.query(
        `SELECT
           c.id, c.book_id, c.created_at, c.last_message_at, c.owner_id,
           r.status AS request_status,
           b.title AS book_title,
           CASE WHEN c.owner_id = $1 THEN requester.username ELSE owner.username END AS other_username,
           last.body AS last_body, last.sender_id AS last_sender_id, last.created_at AS last_created_at,
           (
             SELECT COUNT(*)::int FROM campus_messages m
             WHERE m.conversation_id = c.id AND m.sender_id <> $1
               AND m.id > CASE WHEN c.owner_id = $1
                               THEN c.owner_last_read_id
                               ELSE c.requester_last_read_id END
           ) AS unread
         FROM campus_conversations c
         JOIN campus_borrow_requests r ON r.id = c.request_id
         JOIN campus_books b ON b.id = c.book_id
         JOIN users owner ON owner.id = c.owner_id
         JOIN users requester ON requester.id = c.requester_id
         LEFT JOIN LATERAL (
           SELECT body, sender_id, created_at FROM campus_messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.id DESC LIMIT 1
         ) last ON TRUE
         WHERE c.owner_id = $1 OR c.requester_id = $1
         ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
         LIMIT 200`,
        [me]
      );

      res.json({
        success: true,
        conversations: result.rows.map((row) => ({
          id: toId(row.id),
          book: { id: toId(row.book_id), title: row.book_title },
          otherUsername: row.other_username,
          iAmOwner: row.owner_id === me,
          requestStatus: row.request_status,
          isOpen: row.request_status === "accepted",
          lastMessage: row.last_body
            ? {
                body: row.last_body.slice(0, 140),
                fromMe: row.last_sender_id === me,
                createdAt: row.last_created_at,
              }
            : null,
          unread: row.unread,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/:id", async (req, res, next) => {
    try {
      const conversationId = requireId(req.params.id, "Conversation");
      const conversation = await loadConversation(conversationId, req.campusUser.id);

      res.json({ success: true, conversation });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/:id/messages", async (req, res, next) => {
    try {
      const me = req.campusUser.id;
      const conversationId = requireId(req.params.id, "Conversation");
      const conversation = await loadConversation(conversationId, me);

      const after = parsePositiveId(req.query.after);
      const before = parsePositiveId(req.query.before);

      let rows;

      if (after) {
        // Polling for new messages.
        const result = await pool.query(
          `SELECT m.id, m.body, m.sender_id, m.created_at, u.username AS sender_username
           FROM campus_messages m JOIN users u ON u.id = m.sender_id
           WHERE m.conversation_id = $1 AND m.id > $2
           ORDER BY m.id ASC LIMIT 100`,
          [conversationId, after]
        );
        rows = result.rows;
      } else {
        // Latest page, or older history when `before` is given.
        const result = await pool.query(
          `SELECT m.id, m.body, m.sender_id, m.created_at, u.username AS sender_username
           FROM campus_messages m JOIN users u ON u.id = m.sender_id
           WHERE m.conversation_id = $1 AND ($2::bigint IS NULL OR m.id < $2)
           ORDER BY m.id DESC LIMIT 50`,
          [conversationId, before]
        );
        rows = result.rows.reverse();
      }

      const messages = rows.map((row) => mapMessage(row, me));
      const newest = messages.length > 0 ? messages[messages.length - 1].id : null;

      if (newest && !before) {
        const column = conversation.iAmOwner ? "owner_last_read_id" : "requester_last_read_id";

        await pool.query(
          `UPDATE campus_conversations
           SET ${column} = GREATEST(${column}, $2)
           WHERE id = $1`,
          [conversationId, newest]
        );
      }

      res.json({
        success: true,
        conversation,
        messages,
        hasOlder: !after && rows.length === 50,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/conversations/:id/messages", async (req, res, next) => {
    try {
      const me = req.campusUser.id;
      const conversationId = requireId(req.params.id, "Conversation");
      const conversation = await loadConversation(conversationId, me);

      if (!conversation.isOpen) {
        throw new HttpError(409, "CONVERSATION_CLOSED", "This borrowing has ended, so the chat is now read-only.");
      }

      const body = cleanText(req.body?.body, { field: "Message", max: 2000, required: true, multiline: true });
      if (!body.ok) throw new HttpError(400, "INVALID_INPUT", body.error);

      const recent = await pool.query(
        `SELECT COUNT(*)::int AS n FROM campus_messages
         WHERE conversation_id = $1 AND sender_id = $2
           AND created_at > NOW() - INTERVAL '1 minute'`,
        [conversationId, me]
      );

      if (recent.rows[0].n >= MESSAGES_PER_MINUTE) {
        throw new HttpError(429, "TOO_MANY_MESSAGES", "You're sending messages very quickly. Please wait a moment.");
      }

      const message = await inTransaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO campus_messages (conversation_id, sender_id, body)
           VALUES ($1, $2, $3)
           RETURNING id, body, sender_id, created_at`,
          [conversationId, me, body.value]
        );

        const row = inserted.rows[0];
        const column = conversation.iAmOwner ? "owner_last_read_id" : "requester_last_read_id";

        await client.query(
          `UPDATE campus_conversations
           SET last_message_at = $2, ${column} = GREATEST(${column}, $3)
           WHERE id = $1`,
          [conversationId, row.created_at, row.id]
        );

        return row;
      });

      res.status(201).json({
        success: true,
        message: mapMessage({ ...message, sender_username: req.campusUser.username }, me),
      });
    } catch (error) {
      next(error);
    }
  });

  // =====================================================
  // ERRORS
  // =====================================================

  router.use(campusErrorHandler);

  return router;
}

/** Shared by the Campus and profile routers: never leaks SQL errors. */
export function campusErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof HttpError || error instanceof Auth0RequestError) {
    return res.status(error.status).json({ success: false, code: error.code, error: error.message });
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "The cover image must be smaller than 6 MB."
        : "The upload couldn't be processed.";

    return res.status(400).json({ success: false, code: "INVALID_UPLOAD", error: message });
  }

  if (error?.status === 401 || error?.statusCode === 401) {
    return res.status(401).json({ success: false, code: "UNAUTHENTICATED", error: "Please log in again." });
  }

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, code: "INVALID_INPUT", error: "The request body isn't valid JSON." });
  }

  console.error("Campus/profile error:", error);

  return res.status(500).json({
    success: false,
    code: "SERVER_ERROR",
    error: "Something went wrong on our side. Please try again.",
  });
}
