import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useAuth0 } from 'react-native-auth0';

import { ApiError, getErrorMessage, useApi } from '@/lib/api';

// ---------------------------------------------------------------------------
// The signed-in user's Paws & Pages profile (username + Campus access), as
// decided by the backend. The frontend only displays it; every Campus
// endpoint re-checks access on the server.
// ---------------------------------------------------------------------------

export type CampusAccessReason =
  | 'OK'
  | 'NOT_A_STUDENT'
  | 'EMAIL_NOT_VERIFIED'
  | 'EMAIL_IN_USE'
  | 'VERIFICATION_EXPIRED'
  | 'RECHECK_REQUIRED'
  | 'USER_NOT_SYNCED';

export type CampusStatus = {
  access: boolean;
  reason: CampusAccessReason;
  studentEmail: string | null;
  method: 'login' | 'code' | null;
  verifiedAt: string | null;
  accountEmailIsStudent: boolean;
  accountEmailVerified: boolean;
  pendingStudentEmail: string | null;
  codeSentAt: string | null;
  verificationAvailable: boolean;
};

export type ProfileUser = {
  id: number;
  username: string | null;
  needsUsername: boolean;
};

export type ProfileResponse = {
  user: ProfileUser;
  campus: CampusStatus | null;
};

type ProfileStatus = 'signed-out' | 'loading' | 'ready' | 'not-synced' | 'error';

type ProfileContextValue = {
  status: ProfileStatus;
  user: ProfileUser | null;
  campus: CampusStatus | null;
  error: string | null;
  /** Reloads the profile from the backend. */
  refresh: () => Promise<void>;
  /** Asks the backend to re-check the account's email with Auth0. */
  recheckCampus: () => Promise<void>;
  /** Stores a profile returned by another endpoint (sync, username, verify). */
  apply: (data: Partial<ProfileResponse> | null | undefined) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

type ProfileState = {
  /** Auth0 user the data belongs to. */
  key: string;
  status: 'ready' | 'not-synced' | 'error';
  user: ProfileUser | null;
  campus: CampusStatus | null;
  error: string | null;
};

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user: auth0User } = useAuth0();
  const { request } = useApi();

  const authKey = auth0User?.sub ?? null;

  const [state, setState] = useState<ProfileState | null>(null);
  const requestId = useRef(0);

  const apply = useCallback((data: Partial<ProfileResponse> | null | undefined) => {
    const key = authKey;
    if (!data?.user || !key) return;

    const nextUser: ProfileUser = {
      id: data.user.id,
      username: data.user.username ?? null,
      needsUsername: !data.user.username,
    };

    setState((previous) => ({
      key,
      status: 'ready',
      user: nextUser,
      campus: data.campus ?? (previous?.key === key ? previous.campus : null),
      error: null,
    }));
  }, [authKey]);

  const load = useCallback(
    async (path: string, method: 'GET' | 'POST') => {
      const id = ++requestId.current;
      const key = authKey;
      if (!key) return;

      try {
        const data = await request<ProfileResponse>(path, { method });
        if (id === requestId.current) apply(data);
      } catch (err) {
        if (id !== requestId.current) return;

        const notSynced = err instanceof ApiError && err.data?.code === 'USER_NOT_SYNCED';

        if (!notSynced) console.error('Profile load error:', err);

        setState((previous) => {
          const kept = previous?.key === key && previous.status === 'ready';

          return {
            key,
            status: kept ? 'ready' : notSynced ? 'not-synced' : 'error',
            user: kept ? previous.user : null,
            campus: kept ? previous.campus : null,
            error: getErrorMessage(err, "We couldn't load your profile."),
          };
        });

        throw err;
      }
    },
    [apply, authKey, request]
  );

  const refresh = useCallback(async () => {
    await load('/api/me', 'GET').catch(() => {});
  }, [load]);

  const recheckCampus = useCallback(async () => {
    await load('/api/me/campus/refresh', 'POST');
  }, [load]);

  // Load the profile whenever a different user signs in.
  useEffect(() => {
    if (authKey) {
      load('/api/me', 'GET').catch(() => {});
    }
  }, [authKey, load]);

  const current = authKey && state?.key === authKey ? state : null;
  const status: ProfileStatus = !authKey ? 'signed-out' : current ? current.status : 'loading';

  const value = useMemo(
    () => ({
      status,
      user: current?.user ?? null,
      campus: current?.campus ?? null,
      error: current?.error ?? null,
      refresh,
      recheckCampus,
      apply,
    }),
    [status, current, refresh, recheckCampus, apply]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const value = useContext(ProfileContext);

  if (!value) {
    throw new Error('useProfile must be used inside ProfileProvider.');
  }

  return value;
}

// ---------------------------------------------------------------------------
// USERNAME RULES (mirrors server/validation.js; the server has the final say)
// ---------------------------------------------------------------------------

export const USERNAME_HINT =
  '3–20 characters: letters, numbers and underscores.';

export function checkUsernameLocally(input: string): string | null {
  const username = input.normalize('NFKC').trim();

  if (!username) return 'Please choose a username.';
  if (username.includes('@')) return "A username can't be an email address.";
  if (/\s/.test(username)) return "A username can't contain spaces.";
  if (username.length < 3) return 'Usernames need at least 3 characters.';
  if (username.length > 20) return 'Usernames can have at most 20 characters.';
  if (!/^[A-Za-z0-9_]+$/.test(username)) {
    return 'Use only letters, numbers and underscores.';
  }
  if (!/[A-Za-z]/.test(username)) return 'A username must contain at least one letter.';
  if (username.startsWith('_') || username.endsWith('_') || username.includes('__')) {
    return "Underscores can't be at the start or end, or next to each other.";
  }

  return null;
}
