import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, MessagesSquare } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CampusShell } from '@/components/campus/CampusShell';
import { Notice, StateCard } from '@/components/ui/feedback';
import { FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage } from '@/lib/api';
import { formatRelativeTime, useCampusApi, type ConversationSummary } from '@/lib/campusApi';

const POLL_MS = 15_000;

export default function CampusMessagesScreen() {
  const campus = useCampusApi();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      const id = ++requestId.current;

      try {
        if (!quiet) setLoading(true);
        const data = await campus.listConversations();
        if (id !== requestId.current) return;
        setConversations(data);
        setLoaded(true);
        setError(null);
      } catch (err) {
        if (id === requestId.current) setError(getErrorMessage(err, "We couldn't load your conversations."));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [campus]
  );

  // Refresh on focus, then keep the list fresh while the screen is open.
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => load(true), POLL_MS);
      return () => clearInterval(timer);
    }, [load])
  );

  return (
    <CampusShell
      title="Messages"
      subtitle="Private chats with the students you’re lending to or borrowing from."
      refreshing={loading && loaded}
      onRefresh={() => load()}
    >
      {!loaded ? (
        <StateCard loading={loading} loadingText="Opening your chats..." error={error} onRetry={() => load()} />
      ) : conversations.length === 0 ? (
        <View style={styles.empty}>
          <MessagesSquare size={28} color={PALETTE.purple} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            A private chat opens when an owner accepts a borrow request, so you
            can agree where and when to meet.
          </Text>
          <Pressable
            onPress={() => router.navigate('/campus/requests')}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Go to requests</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {error ? <Notice tone="error" message={error} actionLabel="Try again" onAction={() => load()} style={styles.notice} /> : null}

          <View style={styles.list}>
            {conversations.map((conversation) => (
              <Pressable
                key={conversation.id}
                onPress={() => router.push(`/campus/chat/${conversation.id}`)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${conversation.otherUsername} about ${conversation.book.title}${
                  conversation.unread > 0 ? `, ${conversation.unread} unread` : ''
                }`}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{conversation.otherUsername.slice(0, 1).toUpperCase()}</Text>
                </View>

                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      @{conversation.otherUsername}
                    </Text>
                    <Text style={styles.time}>
                      {formatRelativeTime(conversation.lastMessage?.createdAt ?? conversation.createdAt)}
                    </Text>
                  </View>

                  <Text style={styles.book} numberOfLines={1}>
                    {conversation.iAmOwner ? 'Borrowing your ' : 'Lending you '}“{conversation.book.title}”
                    {conversation.isOpen ? '' : ' · ended'}
                  </Text>

                  <Text
                    style={[styles.preview, conversation.unread > 0 && styles.previewUnread]}
                    numberOfLines={1}
                  >
                    {conversation.lastMessage
                      ? `${conversation.lastMessage.fromMe ? 'You: ' : ''}${conversation.lastMessage.body}`
                      : 'Say hi and arrange the handover.'}
                  </Text>
                </View>

                {conversation.unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{conversation.unread > 99 ? '99+' : conversation.unread}</Text>
                  </View>
                ) : (
                  <ChevronRight size={18} color={PALETTE.muted} />
                )}
              </Pressable>
            ))}
          </View>
        </>
      )}
    </CampusShell>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: 14 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: PALETTE.lightPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: PALETTE.darkPink, fontSize: 18, fontFamily: FONT.heading },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { flex: 1, color: PALETTE.text, fontSize: 14, fontFamily: FONT.bodyExtraBold },
  time: { color: '#A99AAF', fontSize: 10, fontFamily: FONT.bodyBold },
  book: { color: PALETTE.purple, fontSize: 11, fontFamily: FONT.bodyBold, marginTop: 2 },
  preview: { color: PALETTE.muted, fontSize: 12, fontFamily: FONT.body, marginTop: 4 },
  previewUnread: { color: PALETTE.text, fontFamily: FONT.bodyBold },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: PALETTE.darkPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: PALETTE.white, fontSize: 11, fontFamily: FONT.bodyExtraBold },
  empty: {
    backgroundColor: PALETTE.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  emptyTitle: { color: PALETTE.text, fontSize: 18, fontFamily: FONT.heading, textAlign: 'center' },
  emptyText: { color: PALETTE.muted, fontSize: 12, lineHeight: 18, fontFamily: FONT.body, textAlign: 'center', maxWidth: 380 },
  button: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: PALETTE.lavender,
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: { color: PALETTE.text, fontSize: 13, fontFamily: FONT.bodyExtraBold },
  pressed: { opacity: 0.82 },
});
