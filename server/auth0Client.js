// Small wrapper around the Auth0 Authentication API endpoints the backend
// needs: /userinfo (trusted email + email_verified for the signed-in user)
// and the passwordless email OTP flow used to verify a UPT student address.

const TIMEOUT_MS = 10_000;

export class Auth0RequestError extends Error {
  constructor(message, { status = 502, code = "AUTH0_ERROR", auth0Error = null } = {}) {
    super(message);
    this.name = "Auth0RequestError";
    this.status = status;
    this.code = code;
    this.auth0Error = auth0Error;
  }
}

export function createAuth0Client({
  domain,
  passwordlessClientId = null,
  passwordlessClientSecret = null,
  fetchImpl = fetch,
}) {
  if (!domain) {
    throw new Error("createAuth0Client requires an Auth0 domain.");
  }

  const baseUrl = `https://${domain}`;

  async function call(path, options) {
    let response;

    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...options,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new Auth0RequestError("We couldn't reach Auth0. Please try again.", {
        status: 503,
        code: "AUTH0_UNREACHABLE",
      });
    }

    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    return { response, data };
  }

  /** Returns the Auth0 profile for an access token issued with the openid scope. */
  async function fetchUserInfo(accessToken) {
    const { response, data } = await call("/userinfo", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 429) {
      throw new Auth0RequestError("Auth0 is rate limiting profile checks. Please try again in a minute.", {
        status: 503,
        code: "AUTH0_RATE_LIMITED",
      });
    }

    if (!response.ok) {
      throw new Auth0RequestError("Auth0 could not confirm your account details.", {
        status: response.status === 401 ? 401 : 502,
        code: "AUTH0_USERINFO_FAILED",
        auth0Error: data?.error ?? null,
      });
    }

    return data;
  }

  const isPasswordlessConfigured = Boolean(passwordlessClientId);

  function clientCredentials() {
    return {
      client_id: passwordlessClientId,
      ...(passwordlessClientSecret ? { client_secret: passwordlessClientSecret } : {}),
    };
  }

  /** Asks Auth0 to email a one-time code to the address. */
  async function startPasswordless(email) {
    if (!isPasswordlessConfigured) {
      throw new Auth0RequestError("Student email verification isn't configured on the server yet.", {
        status: 503,
        code: "VERIFICATION_NOT_CONFIGURED",
      });
    }

    const { response, data } = await call("/passwordless/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...clientCredentials(),
        connection: "email",
        email,
        send: "code",
      }),
    });

    if (!response.ok) {
      console.error("Auth0 passwordless/start failed:", response.status, data?.error, data?.error_description);

      throw new Auth0RequestError("Auth0 couldn't send the verification code. Please try again later.", {
        status: response.status === 429 ? 429 : 502,
        code: "VERIFICATION_SEND_FAILED",
        auth0Error: data?.error ?? null,
      });
    }
  }

  /**
   * Exchanges the emailed code for tokens, then reads the verified email from
   * /userinfo. The tokens come straight from Auth0 over TLS, so the result can
   * be trusted; they are not stored.
   */
  async function verifyPasswordless(email, code) {
    if (!isPasswordlessConfigured) {
      throw new Auth0RequestError("Student email verification isn't configured on the server yet.", {
        status: 503,
        code: "VERIFICATION_NOT_CONFIGURED",
      });
    }

    const { response, data } = await call("/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...clientCredentials(),
        grant_type: "http://auth0.com/oauth/grant-type/passwordless/otp",
        username: email,
        otp: code,
        realm: "email",
        scope: "openid email",
      }),
    });

    if (!response.ok || !data.access_token) {
      const wrongCode = response.status === 403 || data?.error === "invalid_grant";

      if (!wrongCode) {
        console.error("Auth0 passwordless OTP exchange failed:", response.status, data?.error, data?.error_description);
      }

      throw new Auth0RequestError(
        wrongCode
          ? "That code is incorrect or has expired."
          : "Auth0 couldn't check the code. Please try again later.",
        {
          status: wrongCode ? 400 : 502,
          code: wrongCode ? "INVALID_CODE" : "VERIFICATION_FAILED",
          auth0Error: data?.error ?? null,
        }
      );
    }

    const profile = await fetchUserInfo(data.access_token);

    return {
      email: typeof profile.email === "string" ? profile.email.trim().toLowerCase() : null,
      emailVerified: profile.email_verified === true,
    };
  }

  return {
    fetchUserInfo,
    startPasswordless,
    verifyPasswordless,
    isPasswordlessConfigured,
  };
}
