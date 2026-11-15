import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { getErrorMessage, useApi } from '@/lib/api';
import {
  getReadingBooks,
  getReadingSessions,
  isBookFinished,
  type ReadingBook,
  type ReadingSessionRecord,
} from '@/lib/readingApi';

export type ProgressStats = {
  books: ReadingBook[];
  sessions: ReadingSessionRecord[];
  booksFinished: number;
  pagesRead: number;
  studyMaterials: number;
  quizzes: number;
};

/**
 * Loads the user's real reading and study numbers from the backend.
 * Refreshes every time the screen regains focus.
 */
export function useProgressStats() {
  const { getAccessToken, request } = useApi();

  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;

    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();

      const [books, sessions, study] = await Promise.all([
        getReadingBooks(token),
        getReadingSessions(token),
        request<{ stats?: { materials?: number; quizzes?: number } }>(
          '/api/study/stats'
        ),
      ]);

      if (id !== requestId.current) return;

      setStats({
        books,
        sessions,
        booksFinished: books.filter(isBookFinished).length,
        pagesRead: books.reduce(
          (total, book) => total + Math.max(Number(book.currentPage) || 0, 0),
          0
        ),
        studyMaterials: Number(study.stats?.materials ?? 0),
        quizzes: Number(study.stats?.quizzes ?? 0),
      });
    } catch (err) {
      console.error('Progress stats error:', err);

      if (id === requestId.current) {
        setError(getErrorMessage(err, "We couldn't load your progress."));
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, [getAccessToken, request]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { stats, loading, error, refresh };
}
