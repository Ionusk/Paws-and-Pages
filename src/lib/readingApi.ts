import { Platform } from 'react-native';

import { apiRequest } from './api';

// Moved from src/app/reading/readingStorage.ts: files inside src/app are
// treated as routes by Expo Router, so non-screen code lives here instead.

export type ReadingBook = {
  id: string;
  title: string;
  author: string;
  pages: number;
  currentPage: number;
  coverUrl: string | null;
  createdAt?: string;
};

export type ReadingSessionRecord = {
  id: string;
  bookId: string | null;
  durationSeconds: number;
  startPage: number;
  endPage: number;
  impressions: string;
  date: string;
};

export type CoverUpload = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export function isBookFinished(book: ReadingBook) {
  return book.pages > 0 && book.currentPage >= book.pages;
}

export function getBookProgress(book: ReadingBook) {
  if (!book.pages) {
    return 0;
  }

  return Math.min(Math.max(book.currentPage / book.pages, 0), 1);
}

// =========================================================
// BOOKS
// =========================================================

export async function getReadingBooks(
  accessToken: string
): Promise<ReadingBook[]> {
  const data = await apiRequest<{ books: ReadingBook[] }>(
    '/api/reading/books',
    accessToken
  );

  return Array.isArray(data.books) ? data.books : [];
}

export async function addReadingBook(
  book: Omit<ReadingBook, 'id' | 'createdAt'>,
  accessToken: string,
  cover?: CoverUpload | null
): Promise<ReadingBook> {
  const formData = new FormData();

  formData.append('title', book.title);
  formData.append('author', book.author);
  formData.append('pages', String(book.pages));
  formData.append('currentPage', String(book.currentPage));

  if (cover) {
    const fileName = cover.fileName || 'book-cover.jpg';
    const mimeType = cover.mimeType || 'image/jpeg';

    if (Platform.OS === 'web') {
      // Web: convert the picked image to a Blob.
      const imageResponse = await fetch(cover.uri);

      if (!imageResponse.ok) {
        throw new Error("We couldn't read the selected image.");
      }

      const blob = await imageResponse.blob();
      formData.append('cover', blob, fileName);
    } else {
      // Android / iOS: React Native file object.
      formData.append('cover', {
        uri: cover.uri,
        name: fileName,
        type: mimeType,
      } as any);
    }
  }

  const data = await apiRequest<{ book: ReadingBook }>(
    '/api/reading/books',
    accessToken,
    {
      method: 'POST',
      body: formData,
    }
  );

  return data.book;
}

// =========================================================
// READING SESSIONS
// =========================================================

export async function getReadingSessions(
  accessToken: string
): Promise<ReadingSessionRecord[]> {
  const data = await apiRequest<{ sessions: ReadingSessionRecord[] }>(
    '/api/reading/sessions',
    accessToken
  );

  return Array.isArray(data.sessions) ? data.sessions : [];
}

export async function saveReadingSession(
  durationSeconds: number,
  accessToken: string,
  bookId: string | null = null
): Promise<ReadingSessionRecord> {
  const data = await apiRequest<{ session: ReadingSessionRecord }>(
    '/api/reading/sessions',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        durationSeconds,
        startPage: 0,
        endPage: 0,
        impressions: '',
        bookId,
      }),
    }
  );

  return data.session;
}
