import { router, type Href } from 'expo-router';

/**
 * Go back when there is history, otherwise open a sensible parent screen.
 * Without this, back buttons do nothing after a page refresh on web or when a
 * screen is opened from a deep link.
 */
export function goBack(fallback: Href = '/home') {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}
