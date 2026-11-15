import { apiRequest } from './api';

// API settings now live in src/lib/api.ts; re-exported so existing imports
// keep working.
export { API_AUDIENCE, API_URL, AUTH_SCOPE } from './api';

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

export async function saveVoiceConversation(
  accessToken: string,
  conversation: NewVoiceConversation
): Promise<number> {
  const data = await apiRequest('/api/voice/conversations', accessToken, {
    method: 'POST',
    body: JSON.stringify(conversation),
  });

  return data.id;
}

export async function listVoiceConversations(
  accessToken: string
): Promise<VoiceConversationSummary[]> {
  const data = await apiRequest('/api/voice/conversations', accessToken);

  return data.conversations;
}

export async function getVoiceConversation(
  accessToken: string,
  id: string | number
): Promise<VoiceConversation> {
  const data = await apiRequest(
    `/api/voice/conversations/${encodeURIComponent(String(id))}`,
    accessToken
  );

  return data.conversation;
}

export async function deleteVoiceConversation(
  accessToken: string,
  id: string | number
): Promise<void> {
  await apiRequest(
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
