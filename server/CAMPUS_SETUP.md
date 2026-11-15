# Usernames, UPT verification and Campus – setup

## 1. Database

Apply the migration once (it is additive and safe to re-run):

```
cd server
npm run migrate -- 004_usernames_campus.sql
```

## 2. Who gets Campus access

The backend grants access only for a verified `@student.upt.ro` address, in one of two ways:

| Method | How it's proven | Re-checked |
| --- | --- | --- |
| `login` | The Auth0 account's own email, read from Auth0 `/userinfo` with `email_verified: true` | On every login, and at least every 12 hours |
| `code` | A one-time code Auth0 emails to the UPT address (passwordless OTP) | Expires after 180 days |

Users never enter a UPT password. One UPT address can unlock only one Paws & Pages account.

## 3. Auth0 dashboard configuration

**Method `login` needs no extra setup.** It works for:
- Database (email + password) sign-ups with a `@student.upt.ro` address, once the user clicks Auth0's verification email.
- Social logins whose provider reports a verified UPT address.

To make sure verification emails are delivered reliably, configure an email provider under **Branding → Email Provider**. Auth0's built-in test provider is rate limited.

**Method `code` lets a user signed in with e.g. Gmail verify their UPT address.** It needs:

1. **Authentication → Passwordless → Email**: enable it. OTP length 6 is the default the UI expects.
2. **Applications → (the Native app used by the mobile client, or a dedicated Native app) → Connections**: enable the `email` passwordless connection.
3. Same application → **Settings → Advanced Settings → Grant Types**: enable **Passwordless OTP**.
4. Set the backend environment variables:
   - `AUTH0_PASSWORDLESS_CLIENT_ID`: that application's Client ID.
   - `AUTH0_PASSWORDLESS_CLIENT_SECRET`: only if it is a Regular Web Application (confidential client).

If `AUTH0_PASSWORDLESS_CLIENT_ID` is not set, the app explains that code verification isn't available and offers the `login` method only.

Auth0 creates a separate passwordless user for the verified address. Paws & Pages doesn't use it; access stays tied to the user's existing account.

## 4. Tests

```
cd server
npm test
```

The tests run the real routers and migration in a throwaway PostgreSQL schema, which is dropped afterwards. Auth0 is stubbed.
