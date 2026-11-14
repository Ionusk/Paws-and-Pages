import { Platform } from 'react-native';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android'
    ? 'http://10.0.2.2:3001'
    : 'http://localhost:3001');

export const API_AUDIENCE = 'https://paws-and-pages-api';
export const AUTH_SCOPE = 'openid profile email';

export type VoiceMessage = {
  role: 'user' | 'agent';
  text: string;
  at: string | null;
};

export type VoiceConversationSummary = {
  id: number;
  title: string;
  bookTitle: string | null;
  durationSeconds: number;
  messageCount: number;
  preview: string | null;
  startedAt: string;
};

export type VoiceConversation = {
  id: number;
  title: string;
  bookTitle: string | null;
  durationSeconds: number;
  messages: VoiceMessage[];
  startedAt: string;
};

export type NewVoiceConversation = {
  elevenlabsConversationId?: string | null;
  title?: string;
  bookTitle?: string | null;
  messages: VoiceMessage[];
  durationSeconds: number;
  startedAt: string;
};

async function request(
  path: string,
  accessToken: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Server error: ${response.status}`);
  }

  return data;
}

export async function saveVoiceConversation(
  accessToken: string,
  conversation: NewVoiceConversation
): Promise<number> {
  const data = await request('/api/voice/conversations', accessToken, {
    method: 'POST',
    body: JSON.stringify(conversation),
  });

  return data.id;
}

export async function listVoiceConversations(
  accessToken: string
): Promise<VoiceConversationSummary[]> {
  const data = await request('/api/voice/conversations', accessToken);
  return data.conversations;
}

export async function getVoiceConversation(
  accessToken: string,
  id: string | number
): Promise<VoiceConversation> {
  const data = await request(
    `/api/voice/conversations/${encodeURIComponent(String(id))}`,
    accessToken
  );
  return data.conversation;
}

export async function deleteVoiceConversation(
  accessToken: string,
  id: string | number
): Promise<void> {
  await request(
    `/api/voice/conversations/${encodeURIComponent(String(id))}`,
    accessToken,
    { method: 'DELETE' }
  );
}

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds}s`;
}

export function formatDate(iso: string) {
  const date = new Date(iso);

  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
