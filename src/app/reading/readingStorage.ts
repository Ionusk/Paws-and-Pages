import { Platform } from 'react-native';

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

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:3001'
    : 'http://localhost:3001');
async function apiRequest(
  path: string,
  accessToken: string,
  options: RequestInit = {}
) {
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  const responseText = await response.text();

  let data: any;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error('Backend-ul a returnat un răspuns invalid.');
  }

  if (!response.ok || !data.success) {
    throw new Error(
      data.error || `Eroare server: ${response.status}`
    );
  }

  return data;
}

// =========================================================
// BOOKS
// =========================================================

export async function getReadingBooks(
  accessToken: string
): Promise<ReadingBook[]> {
  const data = await apiRequest(
    '/api/reading/books',
    accessToken
  );

  return data.books;
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
      // WEB: convertim imaginea în Blob
      const imageResponse = await fetch(cover.uri);

      if (!imageResponse.ok) {
        throw new Error('Nu am putut citi imaginea selectată.');
      }

      const blob = await imageResponse.blob();

      formData.append(
        'cover',
        blob,
        fileName
      );
    } else {
      // ANDROID / IOS: formatul React Native
      formData.append(
        'cover',
        {
          uri: cover.uri,
          name: fileName,
          type: mimeType,
        } as any
      );
    }
    
console.log("TRIMIT COPERTA:", cover);
console.log(
  "FORM DATA ENTRIES:",
  Array.from(formData.entries()).map(([key, value]) => ({
    key,
    value:
      value instanceof Blob
        ? {
            type: value.type,
            size: value.size,
            name: value instanceof File ? value.name : undefined,
          }
        : value,
  }))
);

  }

  const data = await apiRequest(
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
  const data = await apiRequest(
    '/api/reading/sessions',
    accessToken
  );

  return data.sessions;
}

export async function saveReadingSession(
  durationSeconds: number,
  accessToken: string
): Promise<ReadingSessionRecord> {
  const data = await apiRequest(
    '/api/reading/sessions',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        durationSeconds,
        startPage: 0,
        endPage: 0,
        impressions: '',
        bookId: null,
      }),
    }
  );

  return data.session;
}