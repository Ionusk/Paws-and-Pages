// Integration tests for friends. They run the real router and migrations in a
// throwaway PostgreSQL schema that is dropped afterwards. Auth0 is replaced
// by the x-test-sub header.

import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, test } from "node:test";

import express from "express";
import pg from "pg";

import { createFriendsRouter } from "../friends.js";

const SCHEMA = `friends_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const SECRET_NOTE = "my private session note";

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

  // Same shapes as production (reading tables store user_id as TEXT).
  await pool.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      auth0_id TEXT NOT NULL UNIQUE,
      email TEXT,
      username TEXT
    );
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
    );
    CREATE TABLE reading_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      book_id UUID,
      duration_seconds INTEGER NOT NULL,
      start_page INTEGER,
      end_page INTEGER,
      impressions TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE quiz_results (
      id SERIAL PRIMARY KEY,
      quiz_id INTEGER,
      user_id INTEGER,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      completed_at TIMESTAMPTZ DEFAULT NOW()
    );`);

  const people = [
    ["alice", "Alice"],
    ["bob", "bob_reads"],
    ["carol", "Carol"],
    ["dave", null], // hasn't picked a username yet
    ["eve", "Eve"],
    ["alfred", "Alfred"],
  ];

  for (const [sub, username] of people) {
    const user = await pool.query(
      `INSERT INTO users (auth0_id, email, username) VALUES ($1, $2, $3) RETURNING id`,
      [sub, `${sub}@example.com`, username]
    );
    ids[sub] = user.rows[0].id;
  }

  for (const file of ["008_book_reviews.sql", "009_friends.sql"]) {
    const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    await pool.query(sql);
    await pool.query(sql); // re-running is harmless
  }

  // Bob: one book in progress (with a session), one finished and reviewed.
  const bobKey = String(ids.bob);
  const reading = await pool.query(
    `INSERT INTO reading_books (user_id, title, total_pages, current_page, created_at)
     VALUES ($1, 'Emma', 400, 120, NOW() - INTERVAL '2 days') RETURNING id`,
    [bobKey]
  );
  ids.bobReading = reading.rows[0].id;

  const finished = await pool.query(
    `INSERT INTO reading_books (user_id, title, total_pages, current_page, status, finished_at, created_at)
     VALUES ($1, 'Dune', 600, 600, 'finished', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '5 days')
     RETURNING id`,
    [bobKey]
  );
  ids.bobFinished = finished.rows[0].id;

  await pool.query(
    `INSERT INTO reading_sessions (user_id, book_id, duration_seconds, impressions)
     VALUES ($1, $2, 1500, $3), ($1, $2, 300, '')`,
    [bobKey, ids.bobReading, SECRET_NOTE]
  );

  await pool.query(
    `INSERT INTO book_reviews (user_id, book_id, rating, body) VALUES ($1, $2, 5, 'Spice must flow.')`,
    [ids.bob, ids.bobFinished]
  );

  await pool.query(
    `INSERT INTO quiz_results (user_id, score, total_questions) VALUES ($1, 6, 10), ($1, 9, 10)`,
    [ids.bob]
  );

  // Eve isn't Alice's friend; her activity must stay hidden.
  const eveBook = await pool.query(
    `INSERT INTO reading_books (user_id, title, total_pages, current_page, status, finished_at)
     VALUES ($1, 'Eve secret book', 100, 100, 'finished', NOW()) RETURNING id`,
    [String(ids.eve)]
  );
  await pool.query(
    `INSERT INTO book_reviews (user_id, book_id, rating, body) VALUES ($1, $2, 2, 'Eve review')`,
    [ids.eve, eveBook.rows[0].id]
  );

  const app = express();
  app.use(express.json());

  const requireAuth = (req, res, next) => {
    const sub = req.get("x-test-sub");
    if (!sub) return res.status(401).json({ success: false });
    req.auth = { payload: { sub } };
    next();
  };

  app.use("/api/friends", createFriendsRouter({ requireAuth, pool }));

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

describe("friends", () => {
  test("search finds usernames by prefix and reveals nothing else", async () => {
    const { status, data } = await api("alice", "GET", "/api/friends/search?q=AL");
    assert.equal(status, 200);
    assert.deepEqual(data.results.map((r) => r.user.username), ["Alfred"], "Alice herself is excluded");
    assert.equal(data.results[0].relationship, "none");
    assert.ok(!JSON.stringify(data).includes("@example.com"), "no emails in search results");

    const underscore = await api("alice", "GET", "/api/friends/search?q=bob_");
    assert.deepEqual(underscore.data.results.map((r) => r.user.username), ["bob_reads"]);

    // "_" must not act as a wildcard.
    const wildcard = await api("alice", "GET", "/api/friends/search?q=a_");
    assert.equal(wildcard.data.results.length, 0);

    assert.equal((await api("alice", "GET", "/api/friends/search?q=a")).data.results.length, 0);
    assert.equal((await api("alice", "GET", "/api/friends/search?q=%25")).data.results.length, 0);
  });

  test("sending a friend request", async () => {
    assert.equal((await api("alice", "POST", "/api/friends/requests", { username: "Alice" })).status, 400);
    assert.equal((await api("alice", "POST", "/api/friends/requests", { username: "nobody" })).status, 404);
    assert.equal((await api("alice", "POST", "/api/friends/requests", {})).status, 400);

    const noName = await api("dave", "POST", "/api/friends/requests", { username: "Alice" });
    assert.equal(noName.status, 403);
    assert.equal(noName.data.code, "USERNAME_REQUIRED");

    const sent = await api("alice", "POST", "/api/friends/requests", { username: "@BOB_READS" });
    assert.equal(sent.status, 201, JSON.stringify(sent.data));
    assert.equal(sent.data.relationship, "outgoing");

    const again = await api("alice", "POST", "/api/friends/requests", { username: "bob_reads" });
    assert.equal(again.status, 200);
    assert.equal(again.data.relationship, "outgoing", "sending twice is harmless");

    const aliceList = await api("alice", "GET", "/api/friends");
    assert.deepEqual(aliceList.data.outgoing.map((r) => r.user.username), ["bob_reads"]);

    const bobList = await api("bob", "GET", "/api/friends");
    assert.deepEqual(bobList.data.incoming.map((r) => r.user.username), ["Alice"]);

    const search = await api("bob", "GET", "/api/friends/search?q=ali");
    assert.equal(search.data.results[0].relationship, "incoming");
  });

  test("nothing is shared before the request is accepted", async () => {
    assert.equal((await api("alice", "GET", `/api/friends/${ids.bob}`)).status, 404);
    assert.equal((await api("alice", "GET", "/api/friends/activity")).data.items.length, 0);
    assert.equal((await api("alice", "GET", "/api/friends/reviews")).data.reviews.length, 0);
  });

  test("accepting a request makes both people friends", async () => {
    assert.equal((await api("alice", "POST", `/api/friends/requests/${ids.bob}/accept`)).status, 404,
      "the sender can't accept their own request");

    const accepted = await api("bob", "POST", `/api/friends/requests/${ids.alice}/accept`);
    assert.equal(accepted.status, 200);

    const aliceList = await api("alice", "GET", "/api/friends");
    assert.equal(aliceList.data.friends.length, 1);
    assert.equal(aliceList.data.friends[0].user.username, "bob_reads");
    assert.equal(aliceList.data.friends[0].currentlyReading.title, "Emma");
    assert.equal(aliceList.data.outgoing.length, 0);

    const bobList = await api("bob", "GET", "/api/friends");
    assert.equal(bobList.data.friends[0].user.username, "Alice");
    assert.equal(bobList.data.incoming.length, 0);
  });

  test("the activity feed shows friends' reading and studying, not private notes", async () => {
    const { status, data } = await api("alice", "GET", "/api/friends/activity");
    assert.equal(status, 200, JSON.stringify(data));

    const byType = Object.fromEntries(data.items.map((item) => [item.type, item]));
    assert.deepEqual(Object.keys(byType).sort(), ["finished", "quiz", "reading", "review", "started"]);

    assert.equal(byType.finished.book.title, "Dune");
    assert.deepEqual(
      data.items.filter((item) => item.type === "started").map((item) => item.book.title),
      ["Emma", "Dune"],
      "newest first"
    );
    assert.equal(byType.review.rating, 5);
    assert.equal(byType.review.excerpt, "Spice must flow.");
    assert.equal(byType.reading.minutes, 30);
    assert.equal(byType.reading.book.title, "Emma");
    assert.equal(byType.quiz.quizCount, 2);
    assert.equal(byType.quiz.bestScore, 9);
    assert.equal(byType.quiz.bestTotal, 10);

    assert.ok(data.items.every((item) => item.user.username === "bob_reads"), "only friends appear");
    assert.ok(!JSON.stringify(data).includes(SECRET_NOTE), "session notes stay private");
    assert.ok(!JSON.stringify(data).includes("Eve"), "non-friends stay hidden");
  });

  test("friends' reviews are shared with friends only", async () => {
    const { data } = await api("alice", "GET", "/api/friends/reviews");
    assert.deepEqual(data.reviews.map((r) => r.book.title), ["Dune"]);
    assert.equal(data.reviews[0].user.username, "bob_reads");

    const eve = await api("eve", "GET", "/api/friends/reviews");
    assert.equal(eve.data.reviews.length, 0);
  });

  test("a friend's profile has their books, stats and reviews", async () => {
    const { status, data } = await api("alice", "GET", `/api/friends/${ids.bob}`);
    assert.equal(status, 200, JSON.stringify(data));

    assert.equal(data.user.username, "bob_reads");
    assert.equal(data.stats.booksFinished, 1);
    assert.equal(data.stats.finishedThisYear, 1);
    assert.equal(data.stats.minutesThisWeek, 30);
    assert.equal(data.stats.reviewCount, 1);
    assert.equal(data.stats.averageRating, 5);
    assert.deepEqual(data.currentlyReading.map((b) => [b.title, b.currentPage]), [["Emma", 120]]);
    assert.equal(data.recentlyFinished[0].rating, 5);
    assert.equal(data.reviews[0].body, "Spice must flow.");
    assert.ok(!JSON.stringify(data).includes(SECRET_NOTE));

    assert.equal((await api("eve", "GET", `/api/friends/${ids.bob}`)).status, 404, "strangers can't see it");
  });

  test("asking someone who already asked you accepts their request", async () => {
    assert.equal((await api("carol", "POST", "/api/friends/requests", { username: "alice" })).status, 201);

    const mutual = await api("alice", "POST", "/api/friends/requests", { username: "carol" });
    assert.equal(mutual.status, 200);
    assert.equal(mutual.data.relationship, "friends");

    const rows = await pool.query(`SELECT COUNT(*)::int AS n FROM friendships`);
    assert.equal(rows.rows[0].n, 2, "still one row per pair");
  });

  test("declining and cancelling requests", async () => {
    await api("eve", "POST", "/api/friends/requests", { username: "alice" });

    const declined = await api("alice", "DELETE", `/api/friends/requests/${ids.eve}`);
    assert.equal(declined.status, 200);
    assert.equal((await api("eve", "GET", "/api/friends")).data.outgoing.length, 0);

    await api("eve", "POST", "/api/friends/requests", { username: "alfred" });
    assert.equal((await api("eve", "DELETE", `/api/friends/requests/${ids.alfred}`)).status, 200, "cancel");
    assert.equal((await api("eve", "DELETE", `/api/friends/requests/${ids.alfred}`)).status, 404);

    // Friends can't be removed through the requests endpoint.
    assert.equal((await api("alice", "DELETE", `/api/friends/requests/${ids.bob}`)).status, 404);
  });

  test("removing a friend stops sharing", async () => {
    assert.equal((await api("alice", "DELETE", `/api/friends/${ids.bob}`)).status, 200);
    assert.equal((await api("alice", "DELETE", `/api/friends/${ids.bob}`)).status, 404);

    assert.equal((await api("alice", "GET", `/api/friends/${ids.bob}`)).status, 404);
    assert.equal((await api("bob", "GET", "/api/friends")).data.friends.length, 0);

    const feed = await api("alice", "GET", "/api/friends/activity");
    assert.ok(feed.data.items.every((item) => item.user.username !== "bob_reads"));
  });

  test("invalid ids and unknown users are rejected", async () => {
    assert.equal((await api("alice", "GET", "/api/friends/abc")).status, 404);
    assert.equal((await api("alice", "POST", "/api/friends/requests/0/accept")).status, 404);
    assert.equal((await api("nobody", "GET", "/api/friends")).status, 404);
    assert.equal((await api("alice", "GET", "/api/friends/999999")).status, 404);
  });
});
