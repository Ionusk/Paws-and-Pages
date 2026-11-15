import { apiRequest } from './api';

// Client for /api/friends (server/friends.js).

export type FriendUser = {
  id: number;
  username: string;
};

export type Relationship = 'none' | 'friends' | 'incoming' | 'outgoing';

export type Friend = {
  user: FriendUser;
  since: string;
  currentlyReading: { title: string; author: string } | null;
};

export type FriendRequest = {
  user: FriendUser;
  sentAt: string;
};

export type FriendsOverview = {
  hasUsername: boolean;
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
};

export type FriendSearchResult = {
  user: FriendUser;
  relationship: Relationship;
};

export type FeedBook = {
  title: string;
  author: string;
  coverUrl: string | null;
};

export type ActivityItem = {
  id: string;
  type: 'finished' | 'started' | 'review' | 'reading' | 'quiz';
  at: string;
  user: FriendUser;
  book: FeedBook | null;
  rating: number | null;
  excerpt: string | null;
  minutes: number | null;
  bookCount: number | null;
  quizCount: number | null;
  bestScore: number | null;
  bestTotal: number | null;
};

export type SharedReview = {
  id: number;
  rating: number;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  user: FriendUser;
  book: FeedBook;
};

export type FriendProfile = {
  user: FriendUser;
  since: string;
  stats: {
    booksFinished: number;
    finishedThisYear: number;
    minutesThisWeek: number;
    reviewCount: number;
    averageRating: number | null;
  };
  currentlyReading: {
    id: string;
    title: string;
    author: string;
    pages: number;
    currentPage: number;
    coverUrl: string | null;
  }[];
  recentlyFinished: {
    id: string;
    title: string;
    author: string;
    finishedAt: string | null;
    coverUrl: string | null;
    rating: number | null;
  }[];
  reviews: {
    id: number;
    rating: number;
    body: string | null;
    updatedAt: string;
    book: FeedBook;
  }[];
};

export async function getFriends(accessToken: string): Promise<FriendsOverview> {
  const data = await apiRequest<Partial<FriendsOverview>>('/api/friends', accessToken);

  return {
    hasUsername: data.hasUsername !== false,
    friends: Array.isArray(data.friends) ? data.friends : [],
    incoming: Array.isArray(data.incoming) ? data.incoming : [],
    outgoing: Array.isArray(data.outgoing) ? data.outgoing : [],
  };
}

export async function searchPeople(
  query: string,
  accessToken: string
): Promise<FriendSearchResult[]> {
  const data = await apiRequest<{ results: FriendSearchResult[] }>(
    `/api/friends/search?q=${encodeURIComponent(query)}`,
    accessToken
  );

  return Array.isArray(data.results) ? data.results : [];
}

/** Sends a request, or accepts theirs if they already asked you. */
export async function sendFriendRequest(
  username: string,
  accessToken: string
): Promise<Relationship> {
  const data = await apiRequest<{ relationship: Relationship }>(
    '/api/friends/requests',
    accessToken,
    { method: 'POST', body: JSON.stringify({ username }) }
  );

  return data.relationship;
}

export async function acceptFriendRequest(userId: number, accessToken: string) {
  await apiRequest(`/api/friends/requests/${userId}/accept`, accessToken, {
    method: 'POST',
  });
}

/** Declines a request you received, or cancels one you sent. */
export async function dismissFriendRequest(userId: number, accessToken: string) {
  await apiRequest(`/api/friends/requests/${userId}`, accessToken, {
    method: 'DELETE',
  });
}

export async function removeFriend(userId: number, accessToken: string) {
  await apiRequest(`/api/friends/${userId}`, accessToken, { method: 'DELETE' });
}

export async function getFriendActivity(accessToken: string): Promise<ActivityItem[]> {
  const data = await apiRequest<{ items: ActivityItem[] }>(
    '/api/friends/activity',
    accessToken
  );

  return Array.isArray(data.items) ? data.items : [];
}

export async function getFriendReviews(accessToken: string): Promise<SharedReview[]> {
  const data = await apiRequest<{ reviews: SharedReview[] }>(
    '/api/friends/reviews',
    accessToken
  );

  return Array.isArray(data.reviews) ? data.reviews : [];
}

export async function getFriendProfile(
  userId: string,
  accessToken: string
): Promise<FriendProfile> {
  return apiRequest<FriendProfile>(
    `/api/friends/${encodeURIComponent(userId)}`,
    accessToken
  );
}

/** "just now", "5 min ago", "yesterday", "12 Mar". `now` comes from load time. */
export function formatRelativeTime(iso: string, now: number) {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';

  const minutes = Math.max(0, Math.round((now - time) / 60000));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;

  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
