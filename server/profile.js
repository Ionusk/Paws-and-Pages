// /api/me – the signed-in user's own profile: username and Campus access.

import { Router } from "express";

import { campusErrorHandler } from "./campus.js";
import {
    STUDENT_EMAIL_DOMAIN,
    isStudentEmail,
    normalizeEmail,
    validateUsername,
} from "./validation.js";

const CODE_RESEND_SECONDS = 60;
const CODE_VALID_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;

function fail(res, status, code, error, extra = {}) {
  return res.status(status).json({ success: false, code, error, ...extra });
}

export function createProfileRouter({ requireAuth, pool, auth0, access }) {
  const router = Router();

  router.use(requireAuth);

  async function loadState(req, options) {
    return access.resolve(req.auth.payload.sub, req.auth.token, options);
  }

  function respondWithProfile(res, state) {
    return res.json({
      success: true,
      user: {
        id: state.user.id,
        username: state.user.username,
        needsUsername: !state.user.username,
      },
      campus: access.describe(state, {
        verificationAvailable: auth0.isPasswordlessConfigured,
      }),
    });
  }

  // -------------------------------------------------------
  // GET /api/me
  // -------------------------------------------------------

  router.get("/", async (req, res, next) => {
    try {
      const state = await loadState(req);

      if (!state.user) {
        return fail(res, 404, "USER_NOT_SYNCED", "Your account isn't set up yet. Please log in again.");
      }

      return respondWithProfile(res, state);
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // USERNAME
  // -------------------------------------------------------

  router.get("/username-availability", async (req, res, next) => {
    try {
      const check = validateUsername(req.query.username);

      if (!check.ok) {
        return res.json({ success: true, available: false, error: check.error });
      }

      const result = await pool.query(
        `SELECT auth0_id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
        [check.username]
      );

      const owner = result.rows[0];
      const available = !owner || owner.auth0_id === req.auth.payload.sub;

      return res.json({
        success: true,
        available,
        username: check.username,
        error: available ? null : "That username is already taken.",
      });
    } catch (error) {
      next(error);
    }
  });

  router.put("/username", async (req, res, next) => {
    try {
      const check = validateUsername(req.body?.username);

      if (!check.ok) {
        return fail(res, 400, "INVALID_USERNAME", check.error);
      }

      let result;

      try {
        result = await pool.query(
          `UPDATE users
           SET username = $2, updated_at = NOW()
           WHERE auth0_id = $1
           RETURNING id`,
          [req.auth.payload.sub, check.username]
        );
      } catch (error) {
        if (error.code === "23505") {
          return fail(res, 409, "USERNAME_TAKEN", "That username is already taken.");
        }

        throw error;
      }

      if (result.rowCount === 0) {
        return fail(res, 404, "USER_NOT_SYNCED", "Your account isn't set up yet. Please log in again.");
      }

      return respondWithProfile(res, await loadState(req));
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------
  // CAMPUS ACCESS
  // -------------------------------------------------------

  // Re-reads the account's email from Auth0, e.g. right after the user
  // clicked Auth0's "verify your email" link.
  router.post("/campus/refresh", async (req, res, next) => {
    try {
      const state = await loadState(req, { force: true });

      if (!state.user) {
        return fail(res, 404, "USER_NOT_SYNCED", "Your account isn't set up yet. Please log in again.");
      }

      return respondWithProfile(res, state);
    } catch (error) {
      next(error);
    }
  });

  // Step 1: Auth0 emails a one-time code to the UPT address.
  router.post("/student-email/start", async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);

      if (!isStudentEmail(email) || email.length > 254) {
        return fail(res, 400, "INVALID_STUDENT_EMAIL", `Enter your university address ending in @${STUDENT_EMAIL_DOMAIN}.`);
      }

      if (!auth0.isPasswordlessConfigured) {
        return fail(res, 503, "VERIFICATION_NOT_CONFIGURED", "Student email verification isn't set up on the server yet.");
      }

      const user = await access.getUserByAuth0Id(req.auth.payload.sub);

      if (!user) {
        return fail(res, 404, "USER_NOT_SYNCED", "Your account isn't set up yet. Please log in again.");
      }

      const taken = await pool.query(
        `SELECT 1 FROM users WHERE student_email = $1 AND id <> $2 LIMIT 1`,
        [email, user.id]
      );

      if (taken.rowCount > 0) {
        return fail(res, 409, "EMAIL_IN_USE", "This UPT address is already linked to another Paws & Pages account.");
      }

      // Atomic cooldown so repeated clicks can't trigger many emails.
      const reserved = await pool.query(
        `UPDATE users
         SET pending_student_email = $2,
             student_code_sent_at = NOW(),
             student_code_attempts = 0
         WHERE id = $1
           AND (student_code_sent_at IS NULL
                OR student_code_sent_at < NOW() - make_interval(secs => $3))
         RETURNING student_code_sent_at`,
        [user.id, email, CODE_RESEND_SECONDS]
      );

      if (reserved.rowCount === 0) {
        return fail(res, 429, "CODE_RECENTLY_SENT", `Please wait a minute before asking for another code.`, {
          retryAfterSeconds: CODE_RESEND_SECONDS,
        });
      }

      await auth0.startPasswordless(email);

      return res.json({
        success: true,
        pendingStudentEmail: email,
        codeSentAt: reserved.rows[0].student_code_sent_at,
        resendAfterSeconds: CODE_RESEND_SECONDS,
      });
    } catch (error) {
      next(error);
    }
  });

  // Step 2: the user types the code; Auth0 confirms it and the address.
  router.post("/student-email/verify", async (req, res, next) => {
    try {
      const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";

      if (!/^[0-9]{4,10}$/.test(code)) {
        return fail(res, 400, "INVALID_CODE", "Enter the code from the email.");
      }

      // Count the attempt first so guesses are limited even when they race.
      const attempt = await pool.query(
        `UPDATE users
         SET student_code_attempts = student_code_attempts + 1
         WHERE auth0_id = $1
           AND pending_student_email IS NOT NULL
           AND student_code_sent_at > NOW() - make_interval(mins => $2)
           AND student_code_attempts < $3
         RETURNING id, pending_student_email`,
        [req.auth.payload.sub, CODE_VALID_MINUTES, MAX_CODE_ATTEMPTS]
      );

      if (attempt.rowCount === 0) {
        return fail(res, 400, "CODE_EXPIRED", "This code has expired or too many attempts were made. Request a new code.");
      }

      const { id: userId, pending_student_email: pendingEmail } = attempt.rows[0];

      const verified = await auth0.verifyPasswordless(pendingEmail, code);

      if (!verified.emailVerified || verified.email !== pendingEmail || !isStudentEmail(verified.email)) {
        return fail(res, 400, "VERIFICATION_MISMATCH", "Auth0 didn't confirm this UPT address. Please request a new code.");
      }

      try {
        await pool.query(
          `UPDATE users
           SET student_email = $2,
               student_email_source = 'code',
               student_email_verified_at = NOW(),
               pending_student_email = NULL,
               student_code_sent_at = NULL,
               student_code_attempts = 0
           WHERE id = $1`,
          [userId, pendingEmail]
        );
      } catch (error) {
        if (error.code === "23505") {
          return fail(res, 409, "EMAIL_IN_USE", "This UPT address is already linked to another Paws & Pages account.");
        }

        throw error;
      }

      return respondWithProfile(res, await loadState(req));
    } catch (error) {
      next(error);
    }
  });

  // Removes a code-verified address (e.g. to link a different one).
  router.delete("/student-email", async (req, res, next) => {
    try {
      await pool.query(
        `UPDATE users
         SET student_email = NULL,
             student_email_source = NULL,
             student_email_verified_at = NULL,
             pending_student_email = NULL,
             student_code_sent_at = NULL,
             student_code_attempts = 0
         WHERE auth0_id = $1 AND student_email_source = 'code'`,
        [req.auth.payload.sub]
      );

      const state = await loadState(req);

      if (!state.user) {
        return fail(res, 404, "USER_NOT_SYNCED", "Your account isn't set up yet. Please log in again.");
      }

      return respondWithProfile(res, state);
    } catch (error) {
      next(error);
    }
  });

  router.use(campusErrorHandler);

  return router;
}
