import { router, type Href } from 'expo-router';

/**
 * Go to the previous screen. If there is none (e.g. the page was reloaded
 * on web, or the screen was opened directly), open `fallback` instead, so the
 * back button never does nothing.
 */
export function goBack(fallback: Href = '/home') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
