import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { getErrorMessage, useApi } from '@/lib/api';
import { getReadingBooks, type ReadingBook } from '@/lib/readingApi';

/** Loads the user's books and reloads them whenever the screen is focused. */
export function useReadingBooks() {
  const { getAccessToken } = useApi();

  const [books, setBooks] = useState<ReadingBook[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;

    try {
      setLoading(true);
      setError(null);

      const result = await getReadingBooks(await getAccessToken());

      if (id === requestId.current) {
        setBooks(result);
        setLoaded(true);
      }
    } catch (err) {
      console.error('Error loading reading books:', err);

      if (id === requestId.current) {
        setError(getErrorMessage(err, "We couldn't load your books."));
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, [getAccessToken]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { books, loaded, loading, error, refresh };
}
