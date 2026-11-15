import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useAuth0 } from 'react-native-auth0';

// ---------------------------------------------------------------------------
// Single source of truth for the backend URL and Auth0 API settings.
//
// Production / physical devices: set EXPO_PUBLIC_API_URL in the project-root
// .env (for example https://api.example.com or http://192.168.1.20:3001).
// Local development falls back to localhost (10.0.2.2 on the Android emulator).
// ---------------------------------------------------------------------------

const LOCAL_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || LOCAL_API_URL).replace(
  /\/+$/,
  ''
);

export const API_AUDIENCE = 'https://paws-and-pages-api';
export const AUTH_SCOPE = 'openid profile email offline_access';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data: any = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const NETWORK_ERROR_MESSAGE =
  "We couldn't reach the Paws & Pages server. Check your connection and try again.";

function fallbackMessage(status: number) {
  if (status === 401 || status === 403) {
    return 'Your session has expired. Please log in again.';
  }

  if (status === 404) {
    return "We couldn't find what you were looking for.";
  }

  if (status >= 500) {
    return 'Something went wrong on our side. Please try again in a moment.';
  }

  return `Request failed (${status}).`;
}

export type ApiResponse<T = any> = {
  ok: boolean;
  status: number;
  data: T;
};

/**
 * Low-level request that never throws for HTTP errors. Use it when the caller
 * needs to inspect special statuses (for example 202 for pending Solana
 * transactions). Network failures still throw an ApiError with status 0.
 */
export async function apiFetch<T = any>(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(isFormData || !options.body
          ? {}
          : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  const text = await response.text();
  let data: any = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  return { ok: response.ok, status: response.status, data };
}

/**
 * Request that throws an ApiError unless the response is 2xx and the body
 * does not explicitly report `success: false`.
 */
export async function apiRequest<T = any>(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const { ok, status, data } = await apiFetch<any>(path, accessToken, options);

  if (!ok || data?.success === false) {
    throw new ApiError(data?.error || fallbackMessage(status), status, data);
  }

  return data as T;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

/** Auth0-aware helpers for screens that call the backend. */
export function useApi() {
  const { getCredentials } = useAuth0();

  const getAccessToken = useCallback(async () => {
    const credentials = await getCredentials(AUTH_SCOPE, 0, {
      audience: API_AUDIENCE,
    });

    if (!credentials?.accessToken) {
      throw new ApiError('Your session has expired. Please log in again.', 401);
    }

    return credentials.accessToken;
  }, [getCredentials]);

  const request = useCallback(
    async <T = any>(path: string, options: RequestInit = {}) =>
      apiRequest<T>(path, await getAccessToken(), options),
    [getAccessToken]
  );

  const fetchRaw = useCallback(
    async <T = any>(path: string, options: RequestInit = {}) =>
      apiFetch<T>(path, await getAccessToken(), options),
    [getAccessToken]
  );

  return { getAccessToken, request, fetchRaw };
}
