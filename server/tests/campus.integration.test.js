// End-to-end tests for usernames, Campus access, listings, borrow requests
// and chat. They run the real routers and the real migration against
// PostgreSQL, inside a throwaway schema that is dropped afterwards, so the
// app's own data is never touched.
//
// Auth0 is replaced by stubs: the fake requireAuth reads the user from the
// x-test-sub header, and /userinfo answers from the PROFILES table below.
//
// Run: npm test   (needs TIGER_DATABASE_URL in server/.env)

import "dotenv/config";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, test } from "node:test";

import express from "express";
import pg from "pg";

import { Auth0RequestError } from "../auth0Client.js";
import { createAccessService } from "../campusAccess.js";
import { createCampusRouter } from "../campus.js";
import { createProfileRouter } from "../profile.js";

const SCHEMA = `campus_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

// Auth0 profiles returned by the /userinfo stub, keyed by Auth0 user id.
const PROFILES = {
  alice: { email: "alice@student.upt.ro", email_verified: true },
  bob: { email: "bob@student.upt.ro", email_verified: true },
  carol: { email: "carol@student.upt.ro", email_verified: true },
  dave: { email: "dave@gmail.com", email_verified: true },
  erin: { email: "erin@student.upt.ro", email_verified: false },
  frank: { email: "frank@gmail.com", email_verified: true },
  gina: { email: "gina@gmail.com", email_verified: true },
  hank: { email: "hank@yahoo.com", email_verified: true },
};

const VALID_CODE = "123456";

let pool;
let server;
let baseUrl;

function buildApp() {
  const app = express();
  app.use(express.json());

  const requireAuth = (req, res, next) => {
    const sub = req.get("x-test-sub");
    if (!sub) return res.status(401).json({ success: false, error: "no auth" });
    req.auth = { payload: { sub }, token: `token-for-${sub}` };
    next();
  };

  const auth0 = {
    isPasswordlessConfigured: true,
    sentCodes: [],
    async fetchUserInfo(token) {
      const sub = token.replace("token-for-", "");
      return PROFILES[sub];
    },
    async startPasswordless(email) {
      this.sentCodes.push(email);
    },
    async verifyPasswordless(email, code) {
      if (code !== VALID_CODE) {
        throw new Auth0RequestError("That code is incorrect or has expired.", { status: 400, code: "INVALID_CODE" });
      }
      return { email, emailVerified: true };
    },
  };

  const access = createAccessService({ pool, auth0 });

  app.use("/api/me", createProfileRouter({ requireAuth, pool, auth0, access }));
  app.use("/api/campus", createCampusRouter({ requireAuth, pool, access }));

  return app;
}

async function api(sub, method, path, body) {
  const headers = { "x-test-sub": sub };
  let payload;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: payload });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function bookForm(fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

before(async () => {
  const url = new URL(process.env.TIGER_DATABASE_URL);
  url.searchParams.delete("sslmode");

  const admin = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${SCHEMA}"`);
  await admin.end();

  pool = new pg.Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false }, max: 8 });
  pool.on("connect", (client) => {
    client.query(`SET search_path TO "${SCHEMA}"`);
  });

  // Same shape as the production users table before migration 004.
  await pool.query(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      auth0_id TEXT NOT NULL UNIQUE,
      email TEXT,
      name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      solana_wallet_address TEXT
    )`);

  for (const sub of Object.keys(PROFILES)) {
    await pool.query(`INSERT INTO users (auth0_id, email) VALUES ($1, $2)`, [sub, PROFILES[sub].email]);
  }

  const migration = await readFile(new URL("../migrations/004_usernames_campus.sql", import.meta.url), "utf8");
  await pool.query(migration);
  // Running it twice must be harmless.
  await pool.query(migration);

  server = buildApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server?.close(resolve));
  await pool?.end();

  const url = new URL(process.env.TIGER_DATABASE_URL);
  url.searchParams.delete("sslmode");
  const admin = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  await admin.connect();
  await admin.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await admin.end();
});

describe("usernames", () => {
  test("an existing user without a username is told to pick one", async () => {
    const { status, data } = await api("alice", "GET", "/api/me");
    assert.equal(status, 200);
    assert.equal(data.user.username, null);
    assert.equal(data.user.needsUsername, true);
  });

  test("invalid usernames are rejected by the backend", async () => {
    for (const username of ["al", "has space", "alice@student.upt.ro", "admin", "__x__", "123"]) {
      const { status, data } = await api("alice", "PUT", "/api/me/username", { username });
      assert.equal(status, 400, `${username} should be invalid`);
      assert.equal(data.code, "INVALID_USERNAME");
    }
  });

  test("users can set a username", async () => {
    for (const [sub, username] of [
      ["alice", "Alice_UPT"],
      ["bob", "bob"],
      ["carol", "Carol"],
      ["dave", "dave"],
      ["erin", "erin"],
      ["frank", "frank"],
      ["gina", "gina"],
    ]) {
      const { status, data } = await api(sub, "PUT", "/api/me/username", { username });
      assert.equal(status, 200, JSON.stringify(data));
      assert.equal(data.user.username, username);
      assert.equal(data.user.needsUsername, false);
    }
  });

  test("duplicate usernames are rejected case-insensitively", async () => {
    const taken = await api("hank", "PUT", "/api/me/username", { username: "ALICE_upt" });
    assert.equal(taken.status, 409);
    assert.equal(taken.data.code, "USERNAME_TAKEN");

    const check = await api("hank", "GET", "/api/me/username-availability?username=alice_UPT");
    assert.equal(check.data.available, false);

    const own = await api("alice", "GET", "/api/me/username-availability?username=alice_upt");
    assert.equal(own.data.available, true, "your own name counts as available");

    // Changing only the capitalization of your own name is allowed.
    const recase = await api("alice", "PUT", "/api/me/username", { username: "alice_upt" });
    assert.equal(recase.status, 200);
    await api("alice", "PUT", "/api/me/username", { username: "Alice_UPT" });
  });

  test("the database also refuses duplicate and malformed usernames", async () => {
    await assert.rejects(
      pool.query(`UPDATE users SET username = 'BOB' WHERE auth0_id = 'hank'`),
      (error) => error.code === "23505"
    );
    await assert.rejects(
      pool.query(`UPDATE users SET username = 'bad name' WHERE auth0_id = 'hank'`),
      (error) => error.code === "23514"
    );
  });
});

describe("campus access", () => {
  test("a non-UPT user cannot use Campus", async () => {
    const { status, data } = await api("dave", "GET", "/api/campus/books");
    assert.equal(status, 403);
    assert.equal(data.code, "CAMPUS_ACCESS_REQUIRED");
    assert.equal(data.reason, "NOT_A_STUDENT");
  });

  test("an unverified @student.upt.ro email cannot use Campus", async () => {
    const { status, data } = await api("erin", "GET", "/api/campus/books");
    assert.equal(status, 403);
    assert.equal(data.reason, "EMAIL_NOT_VERIFIED");

    const me = await api("erin", "GET", "/api/me");
    assert.equal(me.data.campus.access, false);
    assert.equal(me.data.campus.accountEmailIsStudent, true);
    assert.equal(me.data.campus.accountEmailVerified, false);
  });

  test("a verified @student.upt.ro user can use Campus", async () => {
    const { status } = await api("alice", "GET", "/api/campus/books");
    assert.equal(status, 200);

    const me = await api("alice", "GET", "/api/me");
    assert.equal(me.data.campus.access, true);
    assert.equal(me.data.campus.method, "login");
  });

  test("a verified student without a username is asked to choose one", async () => {
    await pool.query(`INSERT INTO users (auth0_id, email) VALUES ('ivy', 'ivy@student.upt.ro')`);
    PROFILES.ivy = { email: "ivy@student.upt.ro", email_verified: true };

    const { status, data } = await api("ivy", "GET", "/api/campus/books");
    assert.equal(status, 403);
    assert.equal(data.code, "USERNAME_REQUIRED");
  });

  test("an unknown account is rejected", async () => {
    const { status, data } = await api("nobody", "GET", "/api/campus/books");
    assert.equal(status, 403);
    assert.equal(data.code, "USER_NOT_SYNCED");
  });

  test("a frontend-supplied email or flag is ignored", async () => {
    const { status } = await api("dave", "GET", "/api/campus/books?email=x@student.upt.ro&isStudent=true");
    assert.equal(status, 403);
  });

  test("a gmail user can verify a UPT address with an Auth0 email code", async () => {
    const notStudent = await api("frank", "POST", "/api/me/student-email/start", { email: "frank@gmail.com" });
    assert.equal(notStudent.status, 400);

    const start = await api("frank", "POST", "/api/me/student-email/start", { email: "Frank@Student.upt.ro" });
    assert.equal(start.status, 200, JSON.stringify(start.data));
    assert.equal(start.data.pendingStudentEmail, "frank@student.upt.ro");

    const resend = await api("frank", "POST", "/api/me/student-email/start", { email: "frank@student.upt.ro" });
    assert.equal(resend.status, 429, "codes are rate limited");

    const wrong = await api("frank", "POST", "/api/me/student-email/verify", { code: "000000" });
    assert.equal(wrong.status, 400);

    const right = await api("frank", "POST", "/api/me/student-email/verify", { code: VALID_CODE });
    assert.equal(right.status, 200, JSON.stringify(right.data));
    assert.equal(right.data.campus.access, true);
    assert.equal(right.data.campus.method, "code");

    assert.equal((await api("frank", "GET", "/api/campus/books")).status, 200);
  });

  test("one UPT address cannot unlock two accounts", async () => {
    const { status, data } = await api("gina", "POST", "/api/me/student-email/start", { email: "alice@student.upt.ro" });
    assert.equal(status, 409);
    assert.equal(data.code, "EMAIL_IN_USE");
  });

  test("code guesses are limited", async () => {
    await pool.query(
      `UPDATE users SET pending_student_email = 'gina@student.upt.ro', student_code_sent_at = NOW(), student_code_attempts = 0
       WHERE auth0_id = 'gina'`
    );

    for (let attempt = 0; attempt < 5; attempt++) {
      const { status } = await api("gina", "POST", "/api/me/student-email/verify", { code: "999999" });
      assert.equal(status, 400);
    }

    const blocked = await api("gina", "POST", "/api/me/student-email/verify", { code: VALID_CODE });
    assert.equal(blocked.status, 400);
    assert.equal(blocked.data.code, "CODE_EXPIRED");
  });
});

describe("listings, requests and chat", () => {
  let bookId;
  let bobRequestId;
  let carolRequestId;
  let conversationId;

  test("a verified student can publish a book", async () => {
    const missing = await api("alice", "POST", "/api/campus/books", bookForm({ title: "  ", author: "X" }));
    assert.equal(missing.status, 400);

    const badCategory = await api(
      "alice",
      "POST",
      "/api/campus/books",
      bookForm({ title: "T", author: "A", category: "Wizardry" })
    );
    assert.equal(badCategory.status, 400);

    const { status, data } = await api(
      "alice",
      "POST",
      "/api/campus/books",
      bookForm({
        title: "Introduction to Algorithms",
        author: "Cormen",
        description: "Good condition, a few notes in pencil.",
        category: "Computer Science",
      })
    );

    assert.equal(status, 201, JSON.stringify(data));
    assert.equal(data.book.status, "available");
    assert.equal(data.book.owner.username, "Alice_UPT");
    assert.equal(data.book.isOwner, true);
    bookId = data.book.id;
  });

  test("listings never expose email addresses", async () => {
    const { data } = await api("bob", "GET", "/api/campus/books");
    const text = JSON.stringify(data);
    assert.equal(text.includes("@"), false, "no email address in the listing response");
  });

  test("another student sees and can search the book", async () => {
    const all = await api("bob", "GET", "/api/campus/books");
    assert.ok(all.data.books.some((book) => book.id === bookId));

    const search = await api("bob", "GET", `/api/campus/books?q=${encodeURIComponent("cormen")}`);
    assert.equal(search.data.books.length, 1);

    const likeInjection = await api("bob", "GET", `/api/campus/books?q=${encodeURIComponent("%")}`);
    assert.equal(likeInjection.data.books.length, 0, "% is treated literally");

    const category = await api("bob", "GET", "/api/campus/books?category=Physics");
    assert.equal(category.data.books.length, 0);
  });

  test("only the owner can edit or delete a listing", async () => {
    const patch = await api("bob", "PATCH", `/api/campus/books/${bookId}`, bookForm({ title: "Hacked" }));
    assert.equal(patch.status, 404);

    const remove = await api("bob", "DELETE", `/api/campus/books/${bookId}`);
    assert.equal(remove.status, 404);

    const ownerPatch = await api("alice", "PATCH", `/api/campus/books/${bookId}`, bookForm({ notes: "Pick up near the library" }));
    assert.equal(ownerPatch.status, 200);
    assert.equal(ownerPatch.data.book.title, "Introduction to Algorithms");
    assert.equal(ownerPatch.data.book.notes, "Pick up near the library");
  });

  test("a student cannot request their own book", async () => {
    const { status, data } = await api("alice", "POST", "/api/campus/requests", { bookId });
    assert.equal(status, 400);
    assert.equal(data.code, "OWN_BOOK");
  });

  test("duplicate active requests are rejected, even when sent at the same time", async () => {
    const [first, second] = await Promise.all([
      api("bob", "POST", "/api/campus/requests", { bookId, message: "Could I borrow it this week?" }),
      api("bob", "POST", "/api/campus/requests", { bookId }),
    ]);

    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [201, 409]);
    bobRequestId = (first.status === 201 ? first : second).data.request.id;

    const carol = await api("carol", "POST", "/api/campus/requests", { bookId });
    assert.equal(carol.status, 201);
    carolRequestId = carol.data.request.id;
  });

  test("the owner sees incoming requests and the requester sees outgoing ones", async () => {
    const owner = await api("alice", "GET", "/api/campus/requests");
    assert.equal(owner.data.incoming.length, 2);
    assert.ok(owner.data.incoming.every((request) => request.status === "pending"));
    assert.ok(owner.data.incoming.some((request) => request.otherUsername === "bob"));

    const requester = await api("bob", "GET", "/api/campus/requests");
    assert.equal(requester.data.outgoing.length, 1);
    assert.equal(requester.data.outgoing[0].otherUsername, "Alice_UPT");
  });

  test("only the right person can accept, reject or cancel", async () => {
    assert.equal((await api("bob", "POST", `/api/campus/requests/${bobRequestId}/accept`)).status, 404);
    assert.equal((await api("carol", "POST", `/api/campus/requests/${bobRequestId}/reject`)).status, 404);
    assert.equal((await api("alice", "POST", `/api/campus/requests/${bobRequestId}/cancel`)).status, 404);
  });

  test("two simultaneous accepts lend the book to only one student", async () => {
    const [bob, carol] = await Promise.all([
      api("alice", "POST", `/api/campus/requests/${bobRequestId}/accept`),
      api("alice", "POST", `/api/campus/requests/${carolRequestId}/accept`),
    ]);

    const statuses = [bob.status, carol.status].sort();
    assert.deepEqual(statuses, [200, 409], `${JSON.stringify(bob.data)} ${JSON.stringify(carol.data)}`);

    const accepted = await pool.query(
      `SELECT COUNT(*)::int AS n FROM campus_borrow_requests WHERE book_id = $1 AND status = 'accepted'`,
      [bookId]
    );
    assert.equal(accepted.rows[0].n, 1);

    // Make the rest of the test deterministic: Bob is the borrower.
    if (carol.status === 200) {
      await pool.query(`UPDATE campus_borrow_requests SET status = 'pending' WHERE id = $1`, [carolRequestId]);
      await pool.query(`DELETE FROM campus_conversations WHERE request_id = $1`, [carolRequestId]);
      await pool.query(`UPDATE campus_books SET status = 'available' WHERE id = $1`, [bookId]);
      const retry = await api("alice", "POST", `/api/campus/requests/${bobRequestId}/accept`);
      assert.equal(retry.status, 200);
      conversationId = retry.data.conversationId;
    } else {
      conversationId = bob.data.conversationId;
    }

    assert.ok(conversationId, "accepting opens a conversation");
  });

  test("a borrowed book cannot be requested, deleted or set available", async () => {
    const book = await api("bob", "GET", `/api/campus/books/${bookId}`);
    assert.equal(book.data.book.status, "borrowed");

    const request = await api("hank", "POST", "/api/campus/requests", { bookId });
    assert.equal(request.status, 403, "hank isn't even a student");

    const dave = await api("frank", "POST", "/api/campus/requests", { bookId });
    assert.equal(dave.status, 409);
    assert.equal(dave.data.code, "BOOK_UNAVAILABLE");

    assert.equal((await api("alice", "DELETE", `/api/campus/books/${bookId}`)).status, 409);
    assert.equal(
      (await api("alice", "PATCH", `/api/campus/books/${bookId}`, bookForm({ status: "available" }))).status,
      409
    );
  });

  test("the waiting request can't be accepted while the book is lent", async () => {
    const { status } = await api("alice", "POST", `/api/campus/requests/${carolRequestId}/accept`);
    assert.equal(status, 409);
  });

  test("both participants can exchange messages", async () => {
    const empty = await api("bob", "POST", `/api/campus/conversations/${conversationId}/messages`, { body: "   " });
    assert.equal(empty.status, 400);

    const fromBob = await api("bob", "POST", `/api/campus/conversations/${conversationId}/messages`, {
      body: "Hi! Can we meet at the library at 2pm?\u0007",
    });
    assert.equal(fromBob.status, 201, JSON.stringify(fromBob.data));
    assert.equal(fromBob.data.message.body, "Hi! Can we meet at the library at 2pm?");

    const aliceList = await api("alice", "GET", "/api/campus/conversations");
    assert.equal(aliceList.data.conversations[0].unread, 1);
    assert.equal(aliceList.data.conversations[0].otherUsername, "bob");

    const fromAlice = await api("alice", "POST", `/api/campus/conversations/${conversationId}/messages`, {
      body: "Sure, see you there.",
    });
    assert.equal(fromAlice.status, 201);

    const history = await api("alice", "GET", `/api/campus/conversations/${conversationId}/messages`);
    assert.equal(history.data.messages.length, 2);
    assert.equal(history.data.messages[0].fromMe, false);
    assert.equal(history.data.messages[1].fromMe, true);
    assert.equal(JSON.stringify(history.data).includes("@student"), false);

    const poll = await api("bob", "GET", `/api/campus/conversations/${conversationId}/messages?after=${fromBob.data.message.id}`);
    assert.equal(poll.data.messages.length, 1);
    assert.equal(poll.data.messages[0].body, "Sure, see you there.");

    const summary = await api("alice", "GET", "/api/campus/summary");
    assert.equal(summary.data.unreadMessages, 0, "reading the chat marks it read");
  });

  test("a third student cannot read or write the conversation", async () => {
    assert.equal((await api("carol", "GET", `/api/campus/conversations/${conversationId}`)).status, 404);
    assert.equal((await api("carol", "GET", `/api/campus/conversations/${conversationId}/messages`)).status, 404);
    assert.equal(
      (await api("carol", "POST", `/api/campus/conversations/${conversationId}/messages`, { body: "hi" })).status,
      404
    );
    const list = await api("carol", "GET", "/api/campus/conversations");
    assert.equal(list.data.conversations.length, 0);

    assert.equal((await api("bob", "GET", "/api/campus/conversations/999999999/messages")).status, 404);
    assert.equal((await api("bob", "GET", "/api/campus/conversations/abc/messages")).status, 404);
  });

  test("returning the book reopens it and makes the chat read-only", async () => {
    assert.equal((await api("bob", "POST", `/api/campus/requests/${bobRequestId}/return`)).status, 404);

    const returned = await api("alice", "POST", `/api/campus/requests/${bobRequestId}/return`);
    assert.equal(returned.status, 200);
    assert.equal(returned.data.request.status, "returned");

    const book = await api("carol", "GET", `/api/campus/books/${bookId}`);
    assert.equal(book.data.book.status, "available");

    const closed = await api("bob", "POST", `/api/campus/conversations/${conversationId}/messages`, { body: "thanks" });
    assert.equal(closed.status, 409);
    assert.equal(closed.data.code, "CONVERSATION_CLOSED");

    const stillReadable = await api("bob", "GET", `/api/campus/conversations/${conversationId}/messages`);
    assert.equal(stillReadable.status, 200);
  });

  test("rejecting a request does not open a chat", async () => {
    const rejected = await api("alice", "POST", `/api/campus/requests/${carolRequestId}/reject`);
    assert.equal(rejected.status, 200);
    assert.equal(rejected.data.request.status, "rejected");
    assert.equal(rejected.data.request.conversationId, null);
  });

  test("a requester can cancel a pending request", async () => {
    const created = await api("carol", "POST", "/api/campus/requests", { bookId });
    assert.equal(created.status, 201);

    const cancelled = await api("carol", "POST", `/api/campus/requests/${created.data.request.id}/cancel`);
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.request.status, "cancelled");
  });

  test("an unavailable book cannot be requested and is hidden from others", async () => {
    const pending = await api("carol", "POST", "/api/campus/requests", { bookId });
    assert.equal(pending.status, 201);

    const hidden = await api("alice", "PATCH", `/api/campus/books/${bookId}`, bookForm({ status: "inactive" }));
    assert.equal(hidden.status, 200);
    assert.equal(hidden.data.book.status, "inactive");

    const closed = await api("carol", "GET", "/api/campus/requests");
    assert.equal(
      closed.data.outgoing.find((request) => request.id === pending.data.request.id).status,
      "cancelled",
      "hiding a listing closes its waiting requests"
    );

    const request = await api("frank", "POST", "/api/campus/requests", { bookId });
    assert.equal(request.status, 404);

    const list = await api("frank", "GET", "/api/campus/books");
    assert.equal(list.data.books.some((book) => book.id === bookId), false);

    const ownList = await api("alice", "GET", "/api/campus/books?scope=mine");
    assert.equal(ownList.data.books.some((book) => book.id === bookId), true);
  });

  test("the owner can delete a listing that isn't lent out", async () => {
    const removed = await api("alice", "DELETE", `/api/campus/books/${bookId}`);
    assert.equal(removed.status, 200);

    const gone = await api("alice", "GET", `/api/campus/books/${bookId}`);
    assert.equal(gone.status, 404);
  });
});

describe("access stays in sync with Auth0", () => {
  test("access is revoked when the account email stops being a UPT address", async () => {
    PROFILES.alice = { email: "alice@gmail.com", email_verified: true };
    await pool.query(
      `UPDATE users SET auth_email_checked_at = NOW() - INTERVAL '13 hours' WHERE auth0_id = 'alice'`
    );

    const { status, data } = await api("alice", "GET", "/api/campus/books");
    assert.equal(status, 403);
    assert.equal(data.reason, "NOT_A_STUDENT");
  });

  test("code-verified access does not depend on the login email", async () => {
    await pool.query(
      `UPDATE users SET auth_email_checked_at = NOW() - INTERVAL '13 hours' WHERE auth0_id = 'frank'`
    );
    assert.equal((await api("frank", "GET", "/api/campus/books")).status, 200);
  });

  test("code-verified access expires after 180 days", async () => {
    await pool.query(
      `UPDATE users SET student_email_verified_at = NOW() - INTERVAL '181 days' WHERE auth0_id = 'frank'`
    );
    const { status, data } = await api("frank", "GET", "/api/campus/books");
    assert.equal(status, 403);
    assert.equal(data.reason, "VERIFICATION_EXPIRED");
  });
});
