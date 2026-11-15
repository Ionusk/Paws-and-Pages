// /api/friends – friend requests, the friends activity feed, friends'
// reviews and friend profiles.
//
// Privacy rules:
// - Search only reveals usernames, never emails or names.
// - Reading progress, finished books, reviews and quiz scores are visible to
//   accepted friends only. Session notes ("impressions"), study files and
//   quiz titles are never shared.
// - The acting user always comes from the Auth0 token.

import { Router } from "express";

import { parsePositiveId } from "./validation.js";

const MAX_PENDING_OUTGOING = 50;
const FEED_DAYS = 30;
const FEED_LIMIT = 50;
const SHARED_REVIEWS_LIMIT = 60;
const EXCERPT_LENGTH = 280;
const SEARCH_LIMIT = 10;

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Uploaded covers are stored as bytes and would be sent as large data URIs.
// The feed and shared reviews list many books, so they only use Open Library
// cover URLs; friend profiles (a handful of books) also include uploads.
const FULL_COVER = `
  CASE
    WHEN b.cover_data IS NOT NULL THEN
      'data:' || COALESCE(b.cover_mime_type, 'image/jpeg') || ';base64,' ||
      replace(encode(b.cover_data, 'base64'), E'\\n', '')
    ELSE b.cover_url
  END`;

/** Ids of the user's accepted friends. $1 = the user's id. */
const FRIEND_IDS = `
  SELECT CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS id
  FROM friendships f
  WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)`;

/** "@Alice" or " alice " -> "alice"; null if it can't be a username. */
function normalizeHandle(value) {
  if (typeof value !== "string") return null;

  const handle = value.normalize("NFKC").trim().replace(/^@/, "");

  return /^[A-Za-z0-9_]{1,20}$/.test(handle) ? handle : null;
}

function relationshipOf(row, meId) {
  if (!row?.status) return "none";
  if (row.status === "accepted") return "friends";
  return row.requester_id === meId ? "outgoing" : "incoming";
}

export function createFriendsRouter({ requireAuth, pool }) {
  const router = Router();

  router.use(requireAuth);

  async function getMe(req, { requireUsername = false } = {}) {
    const auth0Id = req.auth?.payload?.sub;

    if (!auth0Id) {
      throw new HttpError(401, "UNAUTHENTICATED", "Please log in again.");
    }

    const result = await pool.query(
      `SELECT id, username FROM users WHERE auth0_id = $1 LIMIT 1`,
      [auth0Id]
    );

    const me = result.rows[0];

    if (!me) {
      throw new HttpError(404, "USER_NOT_SYNCED", "Your account isn't set up yet. Please log in again.");
    }

    if (requireUsername && !me.username) {
      throw new HttpError(403, "USERNAME_REQUIRED", "Choose a username first, so friends can find you.");
    }

    return me;
  }

  function requireUserId(value) {
    const id = parsePositiveId(value);
    if (!id) throw new HttpError(404, "NOT_FOUND", "We couldn't find this person.");
    return id;
  }

  async function getFriendIds(meId) {
    const result = await pool.query(FRIEND_IDS, [meId]);
    return result.rows.map((row) => row.id);
  }

  // -------------------------------------------------------
  // GET /api/friends – friends and pending requests
  // -------------------------------------------------------

  router.get("/", async (req, res, next) => {
    try {
      const me = await getMe(req);

      const result = await pool.query(
        `SELECT
           f.status,
           f.requester_id,
           f.created_at,
           f.accepted_at,
           u.id AS user_id,
           u.username,
           current.title AS current_title,
           current.author AS current_author
         FROM friendships f
         JOIN users u
           ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
         LEFT JOIN LATERAL (
           SELECT b.title, b.author
           FROM reading_books b
           WHERE f.status = 'accepted'
             AND b.user_id = u.id::text
             AND b.status = 'reading'
           ORDER BY b.updated_at DESC
           LIMIT 1
         ) current ON TRUE
         WHERE f.requester_id = $1 OR f.addressee_id = $1
         ORDER BY LOWER(u.username)`,
        [me.id]
      );

      const friends = [];
      const incoming = [];
      const outgoing = [];

      for (const row of result.rows) {
        const user = { id: row.user_id, username: row.username };
        const relationship = relationshipOf(row, me.id);

        if (relationship === "friends") {
          friends.push({
            user,
            since: row.accepted_at ?? row.created_at,
            currentlyReading: row.current_title
              ? { title: row.current_title, author: row.current_author }
              : null,
          });
        } else if (relationship === "incoming") {
          incoming.push({ user, sentAt: row.created_at });
        } else {
          outgoing.push({ user, sentAt: row.created_at });
        }
      }

      // Newest requests first.
      const newestFirst = (a, b) => new Date(b.sentAt) - new Date(a.sentAt);
      incoming.sort(newestFirst);
      outgoing.sort(newestFirst);

      res.json({ success: true, hasUsername: Boolean(me.username), friends, incoming, outgoing });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // GET /api/friends/search?q=ali – find people by username
  // -------------------------------------------------------

  router.get("/search", async (req, res, next) => {
    try {
      const me = await getMe(req);
      const query = normalizeHandle(req.query.q);

      if (!query || query.length < 2) {
        return res.json({ success: true, results: [] });
      }

      // "_" is a LIKE wildcard; escape it so it only matches itself.
      const pattern = `${query.toLowerCase().replace(/_/g, "\\_")}%`;

      const result = await pool.query(
        `SELECT u.id, u.username, f.status, f.requester_id
         FROM users u
         LEFT JOIN friendships f
           ON LEAST(f.requester_id, f.addressee_id) = LEAST(u.id, $1)
          AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(u.id, $1)
         WHERE u.username IS NOT NULL
           AND LOWER(u.username) LIKE $2 ESCAPE '\\'
           AND u.id <> $1
         ORDER BY (LOWER(u.username) = $3) DESC, LENGTH(u.username), LOWER(u.username)
         LIMIT ${SEARCH_LIMIT}`,
        [me.id, pattern, query.toLowerCase()]
      );

      res.json({
        success: true,
        results: result.rows.map((row) => ({
          user: { id: row.id, username: row.username },
          relationship: relationshipOf(row, me.id),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // POST /api/friends/requests { username } – send a request.
  // If that person already asked you, this accepts their request.
  // -------------------------------------------------------

  router.post("/requests", async (req, res, next) => {
    let client;
    let open = false;

    try {
      const me = await getMe(req, { requireUsername: true });
      const handle = normalizeHandle(req.body?.username);

      if (!handle) {
        throw new HttpError(400, "INVALID_USERNAME", "Enter a username.");
      }

      const target = (
        await pool.query(
          `SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
          [handle]
        )
      ).rows[0];

      if (!target) {
        throw new HttpError(404, "USER_NOT_FOUND", `We couldn't find anyone called @${handle}.`);
      }

      if (target.id === me.id) {
        throw new HttpError(400, "CANNOT_FRIEND_SELF", "That's you! Add someone else.");
      }

      const user = { id: target.id, username: target.username };

      client = await pool.connect();

      // Two attempts: if both people send a request at the same moment, the
      // second insert hits the unique pair index and is retried as an accept.
      for (let attempt = 0; attempt < 2; attempt++) {
        await client.query("BEGIN");
        open = true;

        const existing = (
          await client.query(
            `SELECT id, status, requester_id
             FROM friendships
             WHERE LEAST(requester_id, addressee_id) = LEAST($1::int, $2::int)
               AND GREATEST(requester_id, addressee_id) = GREATEST($1::int, $2::int)
             FOR UPDATE`,
            [me.id, target.id]
          )
        ).rows[0];

        if (existing) {
          let relationship = relationshipOf(existing, me.id);

          if (relationship === "incoming") {
            await client.query(
              `UPDATE friendships SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
              [existing.id]
            );
            relationship = "friends";
          }

          await client.query("COMMIT");
          open = false;

          return res.json({ success: true, relationship, user });
        }

        const pending = await client.query(
          `SELECT COUNT(*)::int AS n FROM friendships WHERE requester_id = $1 AND status = 'pending'`,
          [me.id]
        );

        if (pending.rows[0].n >= MAX_PENDING_OUTGOING) {
          throw new HttpError(
            429,
            "TOO_MANY_REQUESTS",
            "You have a lot of requests waiting. Cancel some before sending more."
          );
        }

        try {
          await client.query(
            `INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)`,
            [me.id, target.id]
          );
        } catch (error) {
          if (error.code === "23505" && attempt === 0) {
            await client.query("ROLLBACK");
            open = false;
            continue;
          }

          throw error;
        }

        await client.query("COMMIT");
        open = false;

        return res.status(201).json({ success: true, relationship: "outgoing", user });
      }

      throw new HttpError(409, "CONFLICT", "Something changed in the meantime. Please try again.");
    } catch (error) {
      if (open) await client.query("ROLLBACK").catch(() => {});
      next(error);
    } finally {
      client?.release();
    }
  });

  // -------------------------------------------------------
  // POST /api/friends/requests/:userId/accept
  // -------------------------------------------------------

  router.post("/requests/:userId/accept", async (req, res, next) => {
    try {
      const me = await getMe(req, { requireUsername: true });
      const otherId = requireUserId(req.params.userId);

      const result = await pool.query(
        `UPDATE friendships
         SET status = 'accepted', accepted_at = NOW()
         WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
         RETURNING id`,
        [otherId, me.id]
      );

      if (result.rowCount === 0) {
        throw new HttpError(404, "REQUEST_NOT_FOUND", "This friend request isn't there anymore.");
      }

      res.json({ success: true, relationship: "friends" });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // DELETE /api/friends/requests/:userId – decline or cancel
  // -------------------------------------------------------

  router.delete("/requests/:userId", async (req, res, next) => {
    try {
      const me = await getMe(req);
      const otherId = requireUserId(req.params.userId);

      const result = await pool.query(
        `DELETE FROM friendships
         WHERE status = 'pending'
           AND ((requester_id = $1 AND addressee_id = $2)
             OR (requester_id = $2 AND addressee_id = $1))`,
        [me.id, otherId]
      );

      if (result.rowCount === 0) {
        throw new HttpError(404, "REQUEST_NOT_FOUND", "This friend request isn't there anymore.");
      }

      res.json({ success: true, relationship: "none" });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // GET /api/friends/activity – what friends did lately
  // -------------------------------------------------------

  router.get("/activity", async (req, res, next) => {
    try {
      const me = await getMe(req);
      const friendIds = await getFriendIds(me.id);

      if (friendIds.length === 0) {
        return res.json({ success: true, items: [] });
      }

      // $1 = friend ids (INTEGER tables), $2 = the same ids as TEXT
      // (reading_books / reading_sessions store user_id as TEXT).
      const result = await pool.query(
        `WITH events AS (
           SELECT 'finished' AS type, b.user_id AS user_key, b.finished_at AS at,
                  b.id::text AS ref, b.title, b.author, b.cover_url,
                  NULL::int AS rating, NULL::text AS excerpt,
                  NULL::int AS minutes, NULL::int AS item_count,
                  NULL::int AS best_score, NULL::int AS best_total
           FROM reading_books b
           WHERE b.user_id = ANY($2::text[])
             AND b.status = 'finished'
             AND b.finished_at >= NOW() - make_interval(days => $3)

           UNION ALL

           -- Books added as "already finished" only show as finished.
           SELECT 'started', b.user_id, b.created_at, b.id::text, b.title, b.author, b.cover_url,
                  NULL, NULL, NULL, NULL, NULL, NULL
           FROM reading_books b
           WHERE b.user_id = ANY($2::text[])
             AND b.created_at >= NOW() - make_interval(days => $3)
             AND (b.finished_at IS NULL OR b.finished_at > b.created_at + INTERVAL '1 minute')

           UNION ALL

           SELECT 'review', r.user_id::text, r.created_at, r.id::text, b.title, b.author, b.cover_url,
                  r.rating, LEFT(r.body, ${EXCERPT_LENGTH}), NULL, NULL, NULL, NULL
           FROM book_reviews r
           JOIN reading_books b ON b.id = r.book_id
           WHERE r.user_id = ANY($1::int[])
             AND r.created_at >= NOW() - make_interval(days => $3)

           UNION ALL

           -- Reading time, one entry per friend per day (UTC).
           SELECT 'reading', s.user_id, MAX(s.created_at),
                  s.user_id || ':' || to_char(date_trunc('day', s.created_at), 'YYYY-MM-DD'),
                  CASE WHEN COUNT(DISTINCT s.book_id) = 1 THEN MAX(b.title) END,
                  CASE WHEN COUNT(DISTINCT s.book_id) = 1 THEN MAX(b.author) END,
                  CASE WHEN COUNT(DISTINCT s.book_id) = 1 THEN MAX(b.cover_url) END,
                  NULL, NULL,
                  (SUM(s.duration_seconds) / 60)::int,
                  COUNT(DISTINCT s.book_id)::int,
                  NULL, NULL
           FROM reading_sessions s
           LEFT JOIN reading_books b ON b.id = s.book_id
           WHERE s.user_id = ANY($2::text[])
             AND s.created_at >= NOW() - make_interval(days => $3)
           GROUP BY s.user_id, date_trunc('day', s.created_at)
           HAVING SUM(s.duration_seconds) >= 60

           UNION ALL

           -- Quizzes, one entry per friend per day with the best score.
           SELECT 'quiz', q.user_id::text, MAX(q.completed_at),
                  q.user_id::text || ':' || to_char(date_trunc('day', q.completed_at), 'YYYY-MM-DD'),
                  NULL, NULL, NULL, NULL, NULL, NULL,
                  COUNT(*)::int,
                  (ARRAY_AGG(q.score ORDER BY q.score::float / NULLIF(q.total_questions, 0) DESC NULLS LAST))[1],
                  (ARRAY_AGG(q.total_questions ORDER BY q.score::float / NULLIF(q.total_questions, 0) DESC NULLS LAST))[1]
           FROM quiz_results q
           WHERE q.user_id = ANY($1::int[])
             AND q.completed_at >= NOW() - make_interval(days => $3)
           GROUP BY q.user_id, date_trunc('day', q.completed_at)
         )
         SELECT e.*, u.id AS user_id, u.username
         FROM events e
         JOIN users u ON u.id = ANY($1::int[]) AND u.id::text = e.user_key
         WHERE e.at IS NOT NULL
         ORDER BY e.at DESC
         LIMIT ${FEED_LIMIT}`,
        [friendIds, friendIds.map(String), FEED_DAYS]
      );

      res.json({
        success: true,
        items: result.rows.map((row) => ({
          id: `${row.type}:${row.ref}`,
          type: row.type,
          at: row.at,
          user: { id: row.user_id, username: row.username },
          book: row.title
            ? { title: row.title, author: row.author, coverUrl: row.cover_url ?? null }
            : null,
          rating: row.rating,
          excerpt: row.excerpt,
          minutes: row.minutes,
          bookCount: row.type === "reading" ? row.item_count : null,
          quizCount: row.type === "quiz" ? row.item_count : null,
          bestScore: row.best_score,
          bestTotal: row.best_total,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // GET /api/friends/reviews – friends' book reviews
  // -------------------------------------------------------

  router.get("/reviews", async (req, res, next) => {
    try {
      const me = await getMe(req);

      const result = await pool.query(
        `SELECT r.id, r.rating, r.body, r.created_at, r.updated_at,
                b.title, b.author, b.cover_url,
                u.id AS user_id, u.username
         FROM book_reviews r
         JOIN reading_books b ON b.id = r.book_id
         JOIN users u ON u.id = r.user_id
         WHERE r.user_id IN (${FRIEND_IDS})
         ORDER BY r.updated_at DESC
         LIMIT ${SHARED_REVIEWS_LIMIT}`,
        [me.id]
      );

      res.json({
        success: true,
        reviews: result.rows.map((row) => ({
          id: Number(row.id),
          rating: row.rating,
          body: row.body,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          user: { id: row.user_id, username: row.username },
          book: { title: row.title, author: row.author, coverUrl: row.cover_url ?? null },
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // GET /api/friends/:userId – a friend's reading profile
  // -------------------------------------------------------

  router.get("/:userId", async (req, res, next) => {
    try {
      const me = await getMe(req);
      const friendId = requireUserId(req.params.userId);

      const friendship = (
        await pool.query(
          `SELECT f.accepted_at, f.created_at, u.id, u.username
           FROM friendships f
           JOIN users u ON u.id = $2
           WHERE f.status = 'accepted'
             AND ((f.requester_id = $1 AND f.addressee_id = $2)
               OR (f.requester_id = $2 AND f.addressee_id = $1))`,
          [me.id, friendId]
        )
      ).rows[0];

      if (!friendship) {
        throw new HttpError(404, "NOT_FRIENDS", "This person isn't on your friends list.");
      }

      const key = String(friendId);

      const [stats, reading, finished, reviews] = await Promise.all([
        pool.query(
          `SELECT
             (SELECT COUNT(*)::int FROM reading_books
              WHERE user_id = $1 AND status = 'finished') AS books_finished,
             (SELECT COUNT(*)::int FROM reading_books
              WHERE user_id = $1 AND status = 'finished'
                AND finished_at >= date_trunc('year', NOW())) AS finished_this_year,
             (SELECT COALESCE(SUM(duration_seconds), 0)::int / 60 FROM reading_sessions
              WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days') AS minutes_this_week,
             (SELECT COUNT(*)::int FROM book_reviews WHERE user_id = $2) AS review_count,
             (SELECT ROUND(AVG(rating)::numeric, 1)::float FROM book_reviews WHERE user_id = $2) AS average_rating`,
          [key, friendId]
        ),
        pool.query(
          `SELECT b.id, b.title, b.author, b.total_pages, b.current_page, ${FULL_COVER} AS cover_url
           FROM reading_books b
           WHERE b.user_id = $1 AND b.status = 'reading'
           ORDER BY b.updated_at DESC
           LIMIT 5`,
          [key]
        ),
        pool.query(
          `SELECT b.id, b.title, b.author, b.finished_at, ${FULL_COVER} AS cover_url, r.rating
           FROM reading_books b
           LEFT JOIN book_reviews r ON r.book_id = b.id
           WHERE b.user_id = $1 AND b.status = 'finished'
           ORDER BY b.finished_at DESC NULLS LAST
           LIMIT 8`,
          [key]
        ),
        pool.query(
          `SELECT r.id, r.rating, r.body, r.updated_at, b.title, b.author, b.cover_url
           FROM book_reviews r
           JOIN reading_books b ON b.id = r.book_id
           WHERE r.user_id = $1
           ORDER BY r.updated_at DESC
           LIMIT 20`,
          [friendId]
        ),
      ]);

      const totals = stats.rows[0];

      res.json({
        success: true,
        user: { id: friendship.id, username: friendship.username },
        since: friendship.accepted_at ?? friendship.created_at,
        stats: {
          booksFinished: totals.books_finished,
          finishedThisYear: totals.finished_this_year,
          minutesThisWeek: totals.minutes_this_week,
          reviewCount: totals.review_count,
          averageRating: totals.average_rating,
        },
        currentlyReading: reading.rows.map((row) => ({
          id: row.id,
          title: row.title,
          author: row.author,
          pages: row.total_pages,
          currentPage: row.current_page,
          coverUrl: row.cover_url ?? null,
        })),
        recentlyFinished: finished.rows.map((row) => ({
          id: row.id,
          title: row.title,
          author: row.author,
          finishedAt: row.finished_at,
          coverUrl: row.cover_url ?? null,
          rating: row.rating,
        })),
        reviews: reviews.rows.map((row) => ({
          id: Number(row.id),
          rating: row.rating,
          body: row.body,
          updatedAt: row.updated_at,
          book: { title: row.title, author: row.author, coverUrl: row.cover_url ?? null },
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // DELETE /api/friends/:userId – remove a friend
  // -------------------------------------------------------

  router.delete("/:userId", async (req, res, next) => {
    try {
      const me = await getMe(req);
      const friendId = requireUserId(req.params.userId);

      const result = await pool.query(
        `DELETE FROM friendships
         WHERE status = 'accepted'
           AND ((requester_id = $1 AND addressee_id = $2)
             OR (requester_id = $2 AND addressee_id = $1))`,
        [me.id, friendId]
      );

      if (result.rowCount === 0) {
        throw new HttpError(404, "NOT_FRIENDS", "This person isn't on your friends list.");
      }

      res.json({ success: true, relationship: "none" });
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

    console.error("Friends error:", error);

    res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      error: "Something went wrong on our side. Please try again.",
    });
  });

  return router;
}
