// Integration tests for book reviews. Like the Campus tests, they run the
// real router and migration in a throwaway PostgreSQL schema that is dropped
// afterwards. Auth0 is replaced by the x-test-sub header.

import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, test } from "node:test";

import express from "express";
import pg from "pg";

import { createReviewsRouter } from "../reviews.js";

const SCHEMA = `reviews_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

let pool;
let server;
let baseUrl;
const ids = {};

function connectionString() {
  const url = new URL(process.env.TIGER_DATABASE_URL);
  url.searchParams.delete("sslmode");
  return url.toString();
}

async function api(sub, method, path, body) {
  const headers = { "x-test-sub": sub };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { status: response.status, data: await response.json().catch(() => ({})) };
}

before(async () => {
  const admin = new pg.Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${SCHEMA}"`);
  await admin.end();

  pool = new pg.Pool({ connectionString: connectionString(), ssl: { rejectUnauthorized: false }, max: 5 });
  pool.on("connect", (client) => {
    client.query(`SET search_path TO "${SCHEMA}", public`);
  });

  // Same shapes as production (reading_books.user_id is TEXT).
  await pool.query(`
    CREATE TABLE users (id SERIAL PRIMARY KEY, auth0_id TEXT NOT NULL UNIQUE);
    CREATE TABLE reading_books (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Unknown author',
      total_pages INTEGER NOT NULL,
      current_page INTEGER NOT NULL DEFAULT 0,
      cover_url TEXT,
      cover_data BYTEA,
      cover_mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'reading',
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`);

  for (const sub of ["alice", "bob"]) {
    const user = await pool.query(`INSERT INTO users (auth0_id) VALUES ($1) RETURNING id`, [sub]);
    ids[sub] = user.rows[0].id;
  }

  const addBook = async (owner, title, status) =>
    (
      await pool.query(
        `INSERT INTO reading_books (user_id, title, total_pages, current_page, status, finished_at)
         VALUES ($1, $2, 300, $3, $4, CASE WHEN $4 = 'finished' THEN NOW() END)
         RETURNING id`,
        [String(ids[owner]), title, status === "finished" ? 300 : 40, status]
      )
    ).rows[0].id;

  ids.finished = await addBook("alice", "Dune", "finished");
  ids.reading = await addBook("alice", "Emma", "reading");
  ids.bobBook = await addBook("bob", "Bob's book", "finished");

  const migration = await readFile(new URL("../migrations/008_book_reviews.sql", import.meta.url), "utf8");
  await pool.query(migration);
  await pool.query(migration); // re-running is harmless

  const app = express();
  app.use(express.json());

  const requireAuth = (req, res, next) => {
    const sub = req.get("x-test-sub");
    if (!sub) return res.status(401).json({ success: false });
    req.auth = { payload: { sub } };
    next();
  };

  app.use("/api/reading/reviews", createReviewsRouter({ requireAuth, pool }));

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server?.close(resolve));
  await pool?.end();

  const admin = new pg.Client({ connectionString: connectionString(), ssl: { rejectUnauthorized: false } });
  await admin.connect();
  await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await admin.end();
});

describe("book reviews", () => {
  test("a finished book without a review is listed as awaiting", async () => {
    const { status, data } = await api("alice", "GET", "/api/reading/reviews");
    assert.equal(status, 200);
    assert.equal(data.reviews.length, 0);
    assert.deepEqual(data.awaiting.map((book) => book.title), ["Dune"]);
  });

  test("a book that isn't finished can't be reviewed", async () => {
    const detail = await api("alice", "GET", `/api/reading/reviews/${ids.reading}`);
    assert.equal(detail.data.canReview, false);

    const { status, data } = await api("alice", "PUT", `/api/reading/reviews/${ids.reading}`, { rating: 4 });
    assert.equal(status, 409);
    assert.equal(data.code, "BOOK_NOT_FINISHED");
  });

  test("ratings and text are validated", async () => {
    for (const rating of [0, 6, 2.5, "five", null]) {
      const { status } = await api("alice", "PUT", `/api/reading/reviews/${ids.finished}`, { rating });
      assert.equal(status, 400, `rating ${rating} should be rejected`);
    }

    const tooLong = await api("alice", "PUT", `/api/reading/reviews/${ids.finished}`, {
      rating: 5,
      body: "x".repeat(4001),
    });
    assert.equal(tooLong.status, 400);
  });

  test("the owner can review a finished book, and edit it", async () => {
    const created = await api("alice", "PUT", `/api/reading/reviews/${ids.finished}`, {
      rating: 4,
      body: "  Loved the desert.\u0000  ",
    });
    assert.equal(created.status, 200, JSON.stringify(created.data));
    assert.equal(created.data.review.rating, 4);
    assert.equal(created.data.review.body, "Loved the desert.");

    const edited = await api("alice", "PUT", `/api/reading/reviews/${ids.finished}`, { rating: 5, body: "" });
    assert.equal(edited.status, 200);
    assert.equal(edited.data.review.rating, 5);
    assert.equal(edited.data.review.body, null, "a rating alone is a valid review");

    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM book_reviews WHERE book_id = $1`, [ids.finished]);
    assert.equal(count.rows[0].n, 1, "editing doesn't create a second review");

    const list = await api("alice", "GET", "/api/reading/reviews");
    assert.equal(list.data.reviews.length, 1);
    assert.equal(list.data.reviews[0].book.title, "Dune");
    assert.equal(list.data.awaiting.length, 0);
  });

  test("a review stays editable after the book is opened again", async () => {
    await pool.query(`UPDATE reading_books SET status = 'reading', finished_at = NULL WHERE id = $1`, [ids.finished]);

    const detail = await api("alice", "GET", `/api/reading/reviews/${ids.finished}`);
    assert.equal(detail.data.canReview, true);

    const edited = await api("alice", "PUT", `/api/reading/reviews/${ids.finished}`, { rating: 3 });
    assert.equal(edited.status, 200);
  });

  test("users can't read or change someone else's reviews", async () => {
    assert.equal((await api("bob", "GET", `/api/reading/reviews/${ids.finished}`)).status, 404);
    assert.equal((await api("bob", "PUT", `/api/reading/reviews/${ids.finished}`, { rating: 1 })).status, 404);
    assert.equal((await api("bob", "DELETE", `/api/reading/reviews/${ids.finished}`)).status, 404);

    const bobList = await api("bob", "GET", "/api/reading/reviews");
    assert.equal(bobList.data.reviews.length, 0);
    assert.deepEqual(bobList.data.awaiting.map((book) => book.title), ["Bob's book"]);

    const rating = await pool.query(`SELECT rating FROM book_reviews WHERE book_id = $1`, [ids.finished]);
    assert.equal(rating.rows[0].rating, 3, "Bob's attempts changed nothing");
  });

  test("invalid ids and unknown users are rejected", async () => {
    assert.equal((await api("alice", "GET", "/api/reading/reviews/not-a-uuid")).status, 404);
    assert.equal((await api("nobody", "GET", "/api/reading/reviews")).status, 404);
    assert.equal((await api("alice", "GET", "/api/reading/reviews/00000000-0000-4000-8000-000000000000")).status, 404);
  });

  test("the owner can delete a review", async () => {
    const removed = await api("alice", "DELETE", `/api/reading/reviews/${ids.finished}`);
    assert.equal(removed.status, 200);

    const again = await api("alice", "DELETE", `/api/reading/reviews/${ids.finished}`);
    assert.equal(again.status, 404);
  });
});
