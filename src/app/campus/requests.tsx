import { router, useFocusEffect } from 'expo-router';
import { Check, Inbox, MessagesSquare, PackageCheck, Send, X } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CampusShell } from '@/components/campus/CampusShell';
import { Notice, StateCard } from '@/components/ui/feedback';
import { FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage } from '@/lib/api';
import {
    REQUEST_STATUS_LABEL,
    formatRelativeTime,
    useCampusApi,
    type BorrowRequest,
    type RequestStatus,
} from '@/lib/campusApi';
import { confirmAction } from '@/lib/feedback';

type Section = 'incoming' | 'outgoing' | 'active' | 'history';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'incoming', label: 'Incoming' },
  { id: 'outgoing', label: 'Outgoing' },
  { id: 'active', label: 'Borrowings' },
  { id: 'history', label: 'History' },
];

const EMPTY_TEXT: Record<Section, { title: string; text: string }> = {
  incoming: {
    title: 'No one has asked for your books yet',
    text: 'When a student asks to borrow one of your books, you’ll accept or decline it here.',
  },
  outgoing: {
    title: 'No waiting requests',
    text: 'Find a book on Campus and tap “Request to borrow”.',
  },
  active: {
    title: 'No active borrowings',
    text: 'Accepted requests show up here with a private chat to arrange the handover.',
  },
  history: {
    title: 'Nothing here yet',
    text: 'Declined, cancelled and returned requests are kept here.',
  },
};

const STATUS_COLORS: Record<RequestStatus, { background: string; color: string }> = {
  pending: { background: '#FFF4E5', color: '#9A6A3C' },
  accepted: { background: PALETTE.successSoft, color: PALETTE.success },
  rejected: { background: PALETTE.dangerSoft, color: PALETTE.danger },
  cancelled: { background: '#EFEAF1', color: PALETTE.muted },
  returned: { background: PALETTE.lavender, color: PALETTE.purple },
};

export default function CampusRequestsScreen() {
  const campus = useCampusApi();

  const [section, setSection] = useState<Section>('incoming');
  const [incoming, setIncoming] = useState<BorrowRequest[]>([]);
  const [outgoing, setOutgoing] = useState<BorrowRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await campus.listRequests();
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
      setLoaded(true);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't load your requests."));
    } finally {
      setLoading(false);
    }
  }, [campus]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const lists: Record<Section, BorrowRequest[]> = {
    incoming: incoming.filter((request) => request.status === 'pending'),
    outgoing: outgoing.filter((request) => request.status === 'pending'),
    active: [...incoming, ...outgoing].filter((request) => request.status === 'accepted'),
    history: [...incoming, ...outgoing]
      .filter((request) => ['rejected', 'cancelled', 'returned'].includes(request.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };

  const act = async (request: BorrowRequest, action: 'accept' | 'reject' | 'cancel' | 'return') => {
    if (busy) return;

    const prompts = {
      accept: {
        title: `Lend “${request.book.title}” to @${request.otherUsername}?`,
        message: 'The book will be marked as lent out and a private chat will open so you can arrange the handover. Other waiting requests stay pending until the book is returned.',
        confirmText: 'Accept',
        destructive: false,
      },
      reject: {
        title: `Decline @${request.otherUsername}’s request?`,
        message: 'They’ll see that their request was declined.',
        confirmText: 'Decline',
        destructive: true,
      },
      cancel: {
        title: 'Cancel your request?',
        message: `@${request.otherUsername} won’t be able to accept it any more.`,
        confirmText: 'Cancel request',
        destructive: true,
      },
      return: {
        title: 'Mark the book as returned?',
        message: `Confirm that @${request.otherUsername} gave “${request.book.title}” back. The book becomes available again and the chat becomes read-only.`,
        confirmText: 'Mark as returned',
        destructive: false,
      },
    }[action];

    const confirmed = await confirmAction({ ...prompts, cancelText: action === 'cancel' ? 'Keep it' : 'Cancel' });
    if (!confirmed) return;

    try {
      setBusy(`${action}-${request.id}`);
      setFeedback(null);

      const result = await campus.actOnRequest(request.id, action);

      setFeedback({
        tone: 'success',
        message: {
          accept: `You accepted @${request.otherUsername}’s request. Say hi in the chat!`,
          reject: 'The request was declined.',
          cancel: 'Your request was cancelled.',
          return: `“${request.book.title}” is back on your shelf and available again.`,
        }[action],
      });

      await load();

      if (action === 'accept' && result.conversationId) {
        router.push(`/campus/chat/${result.conversationId}`);
      }
    } catch (err) {
      setFeedback({ tone: 'error', message: getErrorMessage(err, 'Something went wrong. Please try again.') });
      load();
    } finally {
      setBusy(null);
    }
  };

  const renderActions = (request: BorrowRequest) => {
    const isOwner = request.direction === 'incoming';
    const buttons: ReactNode[] = [];
    const isBusy = (action: string) => busy === `${action}-${request.id}`;

    const button = (
      key: string,
      label: string,
      Icon: typeof Check,
      onPress: () => void,
      variant: 'primary' | 'secondary' | 'danger' = 'secondary'
    ) => (
      <Pressable
        key={key}
        onPress={onPress}
        disabled={Boolean(busy)}
        style={({ pressed }) => [
          styles.action,
          variant === 'primary' && styles.actionPrimary,
          variant === 'danger' && styles.actionDanger,
          busy && styles.disabled,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(busy), busy: isBusy(key) }}
      >
        {isBusy(key) ? (
          <ActivityIndicator size="small" color={variant === 'primary' ? PALETTE.white : PALETTE.text} />
        ) : (
          <Icon
            size={15}
            color={variant === 'primary' ? PALETTE.white : variant === 'danger' ? PALETTE.danger : PALETTE.text}
          />
        )}
        <Text
          style={[
            styles.actionText,
            variant === 'primary' && styles.actionTextPrimary,
            variant === 'danger' && styles.actionTextDanger,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );

    if (request.status === 'pending' && isOwner) {
      const lentOut = request.book.status !== 'available';

      if (!lentOut) buttons.push(button('accept', 'Accept', Check, () => act(request, 'accept'), 'primary'));
      buttons.push(button('reject', 'Decline', X, () => act(request, 'reject'), 'danger'));
    }

    if (request.status === 'pending' && !isOwner) {
      buttons.push(button('cancel', 'Cancel request', X, () => act(request, 'cancel'), 'danger'));
    }

    if (request.status === 'accepted' && request.conversationId) {
      buttons.push(
        button('chat', 'Open chat', MessagesSquare, () => router.push(`/campus/chat/${String(request.conversationId)}`), 'primary')
      );
    }

    if (request.status === 'accepted' && isOwner) {
      buttons.push(button('return', 'Mark as returned', PackageCheck, () => act(request, 'return')));
    }

    if (request.status === 'returned' && request.conversationId) {
      buttons.push(button('chat', 'View chat', MessagesSquare, () => router.push(`/campus/chat/${String(request.conversationId)}`)));
    }

    return buttons.length > 0 ? <View style={styles.actions}>{buttons}</View> : null;
  };

  const renderRequest = (request: BorrowRequest) => {
    const isOwner = request.direction === 'incoming';
    const colors = STATUS_COLORS[request.status];

    return (
      <View key={request.id} style={styles.card}>
        <View style={styles.cardTop}>
          <Pressable
            onPress={() => (request.book.removed ? null : router.push(`/campus/book/${request.book.id}`))}
            style={styles.bookRow}
            accessibilityRole={request.book.removed ? undefined : 'button'}
          >
            <View style={styles.thumb}>
              {request.book.coverUrl ? (
                <Image source={{ uri: request.book.coverUrl }} style={styles.thumbImage} />
              ) : (
                <Inbox size={20} color={PALETTE.purple} />
              )}
            </View>

            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle} numberOfLines={2}>
                {request.book.title}
              </Text>
              <Text style={styles.bookAuthor} numberOfLines={1}>
                {request.book.author}
                {request.book.removed ? ' · listing removed' : ''}
              </Text>
              <Text style={styles.who}>
                {isOwner ? 'Requested by ' : 'Owned by '}
                <Text style={styles.username}>@{request.otherUsername}</Text>
                {' · '}
                {formatRelativeTime(request.createdAt)}
              </Text>
            </View>
          </Pressable>

          <View style={[styles.status, { backgroundColor: colors.background }]}>
            <Text style={[styles.statusText, { color: colors.color }]}>
              {request.status === 'accepted'
                ? isOwner
                  ? 'LENT OUT'
                  : 'BORROWING'
                : REQUEST_STATUS_LABEL[request.status].toUpperCase()}
            </Text>
          </View>
        </View>

        {request.message ? (
          <View style={styles.message}>
            <Text style={styles.messageText}>“{request.message}”</Text>
          </View>
        ) : null}

        {request.status === 'pending' && isOwner && request.book.status !== 'available' ? (
          <Text style={styles.hint}>This book is lent out right now. You can accept once it’s returned.</Text>
        ) : null}

        {renderActions(request)}
      </View>
    );
  };

  const list = lists[section];

  return (
    <CampusShell
      title="Borrow requests"
      subtitle="Accept or decline requests for your books, and follow the ones you’ve sent."
      refreshing={loading && loaded}
      onRefresh={load}
    >
      <View style={styles.segments} accessibilityRole="tablist">
        {SECTIONS.map((item) => {
          const selected = section === item.id;
          const count = lists[item.id].length;

          return (
            <Pressable
              key={item.id}
              onPress={() => setSection(item.id)}
              style={[styles.segment, selected && styles.segmentActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
                {item.label}
                {count > 0 && item.id !== 'history' ? ` · ${count}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {feedback ? (
        <Notice tone={feedback.tone} message={feedback.message} onDismiss={() => setFeedback(null)} style={styles.notice} />
      ) : null}

      {!loaded ? (
        <StateCard loading={loading} loadingText="Checking your requests..." error={error} onRetry={load} />
      ) : (
        <>
          {error ? <Notice tone="error" message={error} actionLabel="Try again" onAction={load} style={styles.notice} /> : null}

          {list.length === 0 ? (
            <View style={styles.empty}>
              {section === 'outgoing' ? (
                <Send size={26} color={PALETTE.purple} />
              ) : (
                <Inbox size={26} color={PALETTE.purple} />
              )}
              <Text style={styles.emptyTitle}>{EMPTY_TEXT[section].title}</Text>
              <Text style={styles.emptyText}>{EMPTY_TEXT[section].text}</Text>
            </View>
          ) : (
            <View style={styles.list}>{list.map(renderRequest)}</View>
          )}
        </>
      )}
    </CampusShell>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: PALETTE.white,
    borderRadius: 18,
    padding: 5,
    borderWidth: 1,
    borderColor: PALETTE.border,
    marginBottom: 16,
  },
  segment: {
    flexGrow: 1,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: PALETTE.lavender },
  segmentText: { color: PALETTE.muted, fontSize: 12, fontFamily: FONT.bodyExtraBold },
  segmentTextActive: { color: PALETTE.text },
  notice: { marginBottom: 14 },
  list: { gap: 12 },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bookRow: { flex: 1, flexDirection: 'row', gap: 12, minWidth: 0 },
  thumb: {
    width: 52,
    height: 74,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  bookInfo: { flex: 1, minWidth: 0 },
  bookTitle: { color: PALETTE.text, fontSize: 16, lineHeight: 21, fontFamily: FONT.heading },
  bookAuthor: { color: PALETTE.muted, fontSize: 12, fontFamily: FONT.bodyMedium, marginTop: 2 },
  who: { color: PALETTE.muted, fontSize: 11, fontFamily: FONT.body, marginTop: 8 },
  username: { color: PALETTE.text, fontFamily: FONT.bodyExtraBold },
  status: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 9, letterSpacing: 0.8, fontFamily: FONT.bodyExtraBold },
  message: {
    backgroundColor: '#FBF8FC',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  messageText: { color: PALETTE.text, fontSize: 12, lineHeight: 18, fontFamily: FONT.body, fontStyle: 'italic' },
  hint: { color: PALETTE.muted, fontSize: 11, lineHeight: 16, fontFamily: FONT.bodyBold, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: PALETTE.lavender,
  },
  actionPrimary: { backgroundColor: PALETTE.text },
  actionDanger: { backgroundColor: PALETTE.dangerSoft },
  actionText: { color: PALETTE.text, fontSize: 12, fontFamily: FONT.bodyExtraBold },
  actionTextPrimary: { color: PALETTE.white },
  actionTextDanger: { color: PALETTE.danger },
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
  emptyText: { color: PALETTE.muted, fontSize: 12, lineHeight: 18, fontFamily: FONT.body, textAlign: 'center', maxWidth: 360 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
});
