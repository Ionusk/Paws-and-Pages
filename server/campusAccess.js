// Decides, on the server only, whether a user may use Campus.
//
// Access requires a verified @student.upt.ro address, proven one of two ways:
//   1. 'login' – the Auth0 account's own email, read from Auth0 /userinfo and
//      re-checked at least every AUTH_RECHECK_MS, so it is revoked if the
//      account's email changes or stops being verified.
//   2. 'code'  – a one-time code that Auth0 emailed to the address (see
//      profile.js). It expires after CODE_VERIFICATION_MAX_AGE_MS.
// Nothing sent by the frontend (email, flags, ids) is ever trusted here.

import { isStudentEmail, normalizeEmail } from "./validation.js";

export const AUTH_RECHECK_MS = 12 * 60 * 60 * 1000;
export const CODE_VERIFICATION_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const FORCED_REFRESH_MIN_INTERVAL_MS = 20 * 1000;

const USER_COLUMNS = `
  id, auth0_id, username,
  auth_email, auth_email_verified, auth_email_checked_at,
  student_email, student_email_source, student_email_verified_at,
  pending_student_email, student_code_sent_at
`;

function isOlderThan(date, ms) {
  return !date || Date.now() - new Date(date).getTime() > ms;
}

export class CampusAccessError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Pure evaluation of a user row. */
export function evaluateCampusAccess(user) {
  if (!user) {
    return { access: false, reason: "USER_NOT_SYNCED" };
  }

  if (!user.student_email || !user.student_email_verified_at) {
    const primaryIsStudent = isStudentEmail(user.auth_email);

    return {
      access: false,
      reason:
        primaryIsStudent && !user.auth_email_verified
          ? "EMAIL_NOT_VERIFIED"
          : "NOT_A_STUDENT",
    };
  }

  if (
    user.student_email_source === "code" &&
    isOlderThan(user.student_email_verified_at, CODE_VERIFICATION_MAX_AGE_MS)
  ) {
    return { access: false, reason: "VERIFICATION_EXPIRED" };
  }

  if (
    user.student_email_source === "login" &&
    isOlderThan(user.auth_email_checked_at, AUTH_RECHECK_MS)
  ) {
    return { access: false, reason: "RECHECK_REQUIRED" };
  }

  return { access: true, reason: "OK" };
}

function needsAuthRefresh(user) {
  // Re-check stale data, and periodically check users without access in case
  // their Auth0 email has become a verified UPT address.
  return isOlderThan(user.auth_email_checked_at, AUTH_RECHECK_MS);
}

export function createAccessService({ pool, auth0 }) {
  async function getUserByAuth0Id(auth0Id, db = pool) {
    const result = await db.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE auth0_id = $1 LIMIT 1`,
      [auth0Id]
    );

    return result.rows[0] ?? null;
  }

  async function getUserById(id, db = pool) {
    const result = await db.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Reads the email + email_verified for the token's user from Auth0 and
   * updates the stored access state. Returns { user, conflict }.
   */
  async function refreshFromAuth0(user, accessToken) {
    const profile = await auth0.fetchUserInfo(accessToken);

    const email = normalizeEmail(profile.email) || null;
    const verified = profile.email_verified === true;
    const qualifies = Boolean(email) && verified && isStudentEmail(email);

    const client = await pool.connect();
    let conflict = false;

    try {
      await client.query("BEGIN");

      const locked = await client.query(
        `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 FOR UPDATE`,
        [user.id]
      );
      const current = locked.rows[0];

      await client.query(
        `UPDATE users
         SET auth_email = $2,
             auth_email_verified = $3,
             auth_email_checked_at = NOW()
         WHERE id = $1`,
        [current.id, email, verified]
      );

      if (qualifies && current.student_email_source !== "code") {
        // The login email itself proves student status.
        await client.query("SAVEPOINT link_student_email");

        try {
          await client.query(
            `UPDATE users
             SET student_email = $2,
                 student_email_source = 'login',
                 student_email_verified_at = NOW()
             WHERE id = $1`,
            [current.id, email]
          );
        } catch (error) {
          if (error.code !== "23505") throw error;

          // Another account already uses this UPT address.
          await client.query("ROLLBACK TO SAVEPOINT link_student_email");
          conflict = true;
        }
      } else if (!qualifies && current.student_email_source === "login") {
        // The email that granted access changed or is no longer verified.
        await client.query(
          `UPDATE users
           SET student_email = NULL,
               student_email_source = NULL,
               student_email_verified_at = NULL
           WHERE id = $1`,
          [current.id]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    return { user: await getUserById(user.id), conflict };
  }

  /**
   * Loads the user and their access, refreshing from Auth0 when the stored
   * data is stale (or always, when force is true).
   */
  async function resolve(auth0Id, accessToken, { force = false } = {}) {
    let user = await getUserByAuth0Id(auth0Id);

    if (!user) {
      return { user: null, conflict: false, ...evaluateCampusAccess(null) };
    }

    let conflict = false;
    // Forced refreshes are still throttled to protect the Auth0 rate limit.
    const shouldRefresh = force
      ? isOlderThan(user.auth_email_checked_at, FORCED_REFRESH_MIN_INTERVAL_MS)
      : needsAuthRefresh(user);

    if (shouldRefresh && accessToken) {
      try {
        ({ user, conflict } = await refreshFromAuth0(user, accessToken));
      } catch (error) {
        // Without a fresh check, evaluateCampusAccess denies stale 'login'
        // access on its own; code-verified access is unaffected.
        console.error("Campus access refresh failed:", error.message);

        if (force) throw error;
      }
    }

    return { user, conflict, ...evaluateCampusAccess(user) };
  }

  /** Shape sent to the signed-in user about their own access. */
  function describe(state, { verificationAvailable }) {
    const { user } = state;

    return {
      access: state.access,
      reason: state.conflict ? "EMAIL_IN_USE" : state.reason,
      studentEmail: user?.student_email ?? null,
      method: user?.student_email_source ?? null,
      verifiedAt: user?.student_email_verified_at ?? null,
      accountEmailIsStudent: isStudentEmail(user?.auth_email),
      accountEmailVerified: Boolean(user?.auth_email_verified),
      pendingStudentEmail: user?.pending_student_email ?? null,
      codeSentAt: user?.student_code_sent_at ?? null,
      verificationAvailable,
    };
  }

  /** Express middleware for every Campus endpoint. Sets req.campusUser. */
  function requireCampusAccess() {
    return async (req, res, next) => {
      try {
        const auth0Id = req.auth?.payload?.sub;

        if (!auth0Id) {
          return res.status(401).json({
            success: false,
            code: "UNAUTHENTICATED",
            error: "Please log in again.",
          });
        }

        const state = await resolve(auth0Id, req.auth?.token);

        if (!state.user) {
          return res.status(403).json({
            success: false,
            code: "USER_NOT_SYNCED",
            error: "Your account isn't set up yet. Please log in again.",
          });
        }

        if (!state.access) {
          return res.status(403).json({
            success: false,
            code: "CAMPUS_ACCESS_REQUIRED",
            reason: state.conflict ? "EMAIL_IN_USE" : state.reason,
            error: "Campus is only available to verified UPT students.",
          });
        }

        if (!state.user.username) {
          return res.status(403).json({
            success: false,
            code: "USERNAME_REQUIRED",
            error: "Choose a username before using Campus.",
          });
        }

        req.campusUser = {
          id: state.user.id,
          username: state.user.username,
        };

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  return {
    getUserByAuth0Id,
    refreshFromAuth0,
    resolve,
    describe,
    requireCampusAccess,
  };
}
