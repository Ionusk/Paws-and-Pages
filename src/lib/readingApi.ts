import { Platform } from 'react-native';

import { apiRequest } from './api';

// Moved from src/app/reading/readingStorage.ts: files inside src/app are
// treated as routes by Expo Router, so non-screen code lives here instead.

export type BookStatus = 'reading' | 'finished';

export type ReadingBook = {
  id: string;
  title: string;
  author: string;
  pages: number;
  currentPage: number;
  coverUrl: string | null;
  status: BookStatus;
  finishedAt?: string | null;
  openLibraryKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
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

/** A book found on Open Library (https://openlibrary.org). */
export type OpenLibraryBook = {
  openLibraryKey: string;
  title: string;
  author: string;
  pages: number | null;
  year: number | null;
  coverUrl: string | null;
};

export function isBookFinished(book: ReadingBook) {
  if (book.status) return book.status === 'finished';
  return book.pages > 0 && book.currentPage >= book.pages;
}

export function getBookProgress(book: ReadingBook) {
  if (isBookFinished(book)) return 1;
  if (!book.pages) return 0;

  return Math.min(Math.max(book.currentPage / book.pages, 0), 1);
}

// =========================================================
// OPEN LIBRARY SEARCH (through our server)
// =========================================================

export async function searchOpenLibrary(
  query: string,
  accessToken: string
): Promise<OpenLibraryBook[]> {
  const data = await apiRequest<{ results: OpenLibraryBook[] }>(
    `/api/books/search?q=${encodeURIComponent(query)}`,
    accessToken
  );

  return Array.isArray(data.results) ? data.results : [];
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

export type NewReadingBook = {
  title: string;
  author: string;
  pages: number;
  currentPage: number;
  status: BookStatus;
  /** Open Library cover URL, used when no cover image is uploaded. */
  coverUrl?: string | null;
  openLibraryKey?: string | null;
};

export async function addReadingBook(
  book: NewReadingBook,
  accessToken: string,
  cover?: CoverUpload | null
): Promise<ReadingBook> {
  const formData = new FormData();

  formData.append('title', book.title);
  formData.append('author', book.author);
  formData.append('pages', String(book.pages));
  formData.append('currentPage', String(book.currentPage));
  formData.append('status', book.status);

  if (book.coverUrl) formData.append('coverUrl', book.coverUrl);
  if (book.openLibraryKey) formData.append('openLibraryKey', book.openLibraryKey);

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

export type BookProgressChange = {
  currentPage?: number;
  totalPages?: number;
  status?: BookStatus;
};

/**
 * Update the current page or status. Reaching the last page marks the book
 * finished automatically; setting status "reading" reopens a finished book.
 */
export async function updateReadingBook(
  bookId: string,
  changes: BookProgressChange,
  accessToken: string
): Promise<ReadingBook> {
  const data = await apiRequest<{ book: ReadingBook }>(
    `/api/reading/books/${encodeURIComponent(bookId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(changes),
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

export type NewReadingSession = {
  durationSeconds: number;
  bookId?: string | null;
  /** Page the book was on when the session started. */
  startPage?: number;
  /** Page reached at the end; also becomes the book's current page. */
  endPage?: number | null;
  finishedBook?: boolean;
  impressions?: string;
};

export async function saveReadingSession(
  session: NewReadingSession,
  accessToken: string
): Promise<{ session: ReadingSessionRecord; book: ReadingBook | null }> {
  return apiRequest<{ session: ReadingSessionRecord; book: ReadingBook | null }>(
    '/api/reading/sessions',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        durationSeconds: session.durationSeconds,
        bookId: session.bookId ?? null,
        startPage: session.startPage ?? 0,
        endPage: session.endPage ?? null,
        finishedBook: session.finishedBook ?? false,
        impressions: session.impressions ?? '',
      }),
    }
  );
}
