import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';

import { ApiError, useApi } from '@/lib/api';
import { useProfile } from '@/lib/profile';

// ---------------------------------------------------------------------------
// Types mirror server/campus.js responses.
// ---------------------------------------------------------------------------

export type BookStatus = 'available' | 'borrowed' | 'inactive';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'returned';

export type CampusBook = {
  id: number;
  title: string;
  author: string;
  description: string | null;
  category: string | null;
  notes: string | null;
  status: BookStatus;
  coverUrl: string | null;
  owner: { username: string };
  isOwner: boolean;
  myRequest: { id: number; status: RequestStatus } | null;
  pendingRequests: number | null;
  activeConversationId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BorrowRequest = {
  id: number;
  status: RequestStatus;
  message: string | null;
  direction: 'incoming' | 'outgoing';
  book: {
    id: number;
    title: string;
    author: string;
    status: BookStatus;
    removed: boolean;
    coverUrl: string | null;
  };
  otherUsername: string;
  conversationId: number | null;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  returnedAt: string | null;
};

export type ConversationSummary = {
  id: number;
  book: { id: number; title: string };
  otherUsername: string;
  iAmOwner: boolean;
  requestStatus: RequestStatus;
  isOpen: boolean;
  lastMessage: { body: string; fromMe: boolean; createdAt: string } | null;
  unread: number;
  createdAt: string;
};

export type Conversation = {
  id: number;
  requestId: number;
  requestStatus: RequestStatus;
  isOpen: boolean;
  iAmOwner: boolean;
  otherUsername: string;
  book: { id: number; title: string; author: string };
  createdAt: string;
};

export type ChatMessage = {
  id: number;
  body: string;
  fromMe: boolean;
  senderUsername: string;
  createdAt: string;
};

export type CampusSummary = {
  username: string;
  categories: string[];
  pendingIncoming: number;
  unreadMessages: number;
};

export type BookListParams = {
  q?: string;
  category?: string | null;
  availability?: 'available' | 'all';
  scope?: 'all' | 'mine';
  offset?: number;
};

export type BookInput = {
  title: string;
  author: string;
  description: string;
  category: string | null;
  notes: string;
  status?: 'available' | 'inactive';
};

export type CoverFile = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export const CAMPUS_CATEGORIES = [
  'Computer Science',
  'Engineering',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Economics',
  'Architecture',
  'Languages',
  'Literature',
  'Other',
];

export const BOOK_STATUS_LABEL: Record<BookStatus, string> = {
  available: 'Available',
  borrowed: 'Lent out',
  inactive: 'Hidden',
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Waiting for reply',
  accepted: 'Accepted',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

async function appendCover(form: FormData, cover: CoverFile) {
  const fileName = cover.fileName || 'cover.jpg';
  const mimeType = cover.mimeType || 'image/jpeg';

  if (Platform.OS === 'web') {
    const response = await fetch(cover.uri);

    if (!response.ok) {
      throw new Error("We couldn't read the selected image.");
    }

    form.append('cover', await response.blob(), fileName);
  } else {
    form.append('cover', { uri: cover.uri, name: fileName, type: mimeType } as any);
  }
}

async function buildBookForm(
  input: Partial<BookInput>,
  cover: CoverFile | null,
  removeCover: boolean
) {
  const form = new FormData();

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) form.append(key, value === null ? '' : String(value));
  }

  if (cover) await appendCover(form, cover);
  if (removeCover) form.append('removeCover', 'true');

  return form;
}

/** Campus endpoints. Access errors trigger a profile refresh so the gate updates. */
export function useCampusApi() {
  const { request } = useApi();
  const { refresh } = useProfile();

  const call = useCallback(
    async <T = any>(path: string, options: RequestInit = {}) => {
      try {
        return await request<T>(`/api/campus${path}`, options);
      } catch (error) {
        const code = error instanceof ApiError ? error.data?.code : null;

        if (code === 'CAMPUS_ACCESS_REQUIRED' || code === 'USERNAME_REQUIRED') {
          refresh();
        }

        throw error;
      }
    },
    [refresh, request]
  );

  const post = useCallback(
    <T = any>(path: string, body?: unknown) =>
      call<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
    [call]
  );

  return useMemo(
    () => ({
      summary: () => call<CampusSummary>('/summary'),

      listBooks: (params: BookListParams = {}) => {
        const query = new URLSearchParams();
        if (params.q) query.set('q', params.q);
        if (params.category) query.set('category', params.category);
        if (params.availability) query.set('availability', params.availability);
        if (params.scope) query.set('scope', params.scope);
        if (params.offset) query.set('offset', String(params.offset));
        const text = query.toString();

        return call<{ books: CampusBook[]; hasMore: boolean }>(`/books${text ? `?${text}` : ''}`);
      },

      getBook: (id: number | string) =>
        call<{ book: CampusBook }>(`/books/${encodeURIComponent(String(id))}`).then((data) => data.book),

      createBook: async (input: BookInput, cover: CoverFile | null) => {
        const form = await buildBookForm(input, cover, false);
        return call<{ book: CampusBook }>('/books', { method: 'POST', body: form }).then((data) => data.book);
      },

      updateBook: async (
        id: number,
        input: Partial<BookInput>,
        cover: CoverFile | null = null,
        removeCover = false
      ) => {
        const form = await buildBookForm(input, cover, removeCover);
        return call<{ book: CampusBook }>(`/books/${id}`, { method: 'PATCH', body: form }).then(
          (data) => data.book
        );
      },

      deleteBook: (id: number) => call(`/books/${id}`, { method: 'DELETE' }),

      listRequests: () => call<{ incoming: BorrowRequest[]; outgoing: BorrowRequest[] }>('/requests'),

      createRequest: (bookId: number, message: string) =>
        post<{ request: BorrowRequest }>('/requests', { bookId, message }).then((data) => data.request),

      actOnRequest: (id: number, action: 'accept' | 'reject' | 'cancel' | 'return') =>
        post<{ request: BorrowRequest; conversationId?: number }>(`/requests/${id}/${action}`),

      listConversations: () =>
        call<{ conversations: ConversationSummary[] }>('/conversations').then((data) => data.conversations),

      getMessages: (conversationId: number | string, after?: number | null) =>
        call<{ conversation: Conversation; messages: ChatMessage[]; hasOlder: boolean }>(
          `/conversations/${encodeURIComponent(String(conversationId))}/messages${after ? `?after=${after}` : ''}`
        ),

      getOlderMessages: (conversationId: number | string, before: number) =>
        call<{ conversation: Conversation; messages: ChatMessage[]; hasOlder: boolean }>(
          `/conversations/${encodeURIComponent(String(conversationId))}/messages?before=${before}`
        ),

      sendMessage: (conversationId: number | string, body: string) =>
        post<{ message: ChatMessage }>(
          `/conversations/${encodeURIComponent(String(conversationId))}/messages`,
          { body }
        ).then((data) => data.message),
    }),
    [call, post]
  );
}

export function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} d ago`;

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatMessageTime(iso: string) {
  const date = new Date(iso);
  const sameDay = new Date().toDateString() === date.toDateString();

  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}
