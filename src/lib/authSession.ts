import { Platform } from 'react-native';

export const CUSTOM_SCHEME = 'pawsandpages';

// Used by login.tsx to limit a web session to 4 hours.
export const LOGIN_TIME_KEY = 'paws_pages_login_time';

// On web, Auth0 always sends the browser back to the site root ("/") after
// login. This flag tells the index screen that the user just logged in, so it
// forwards them to /login (which syncs the user and opens /home) instead of
// logging them out.
const POST_LOGIN_KEY = 'paws_pages_post_login';

export function markLoginStarted() {
  if (Platform.OS === 'web') {
    sessionStorage.setItem(POST_LOGIN_KEY, '1');
  }
}

/** Returns true once if a web login redirect just finished, then clears it. */
export function consumeLoginReturn() {
  if (Platform.OS !== 'web') {
    return false;
  }

  const returning = sessionStorage.getItem(POST_LOGIN_KEY) === '1';
  sessionStorage.removeItem(POST_LOGIN_KEY);
  return returning;
}

export function clearLoginTime() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(LOGIN_TIME_KEY);
  }
}
