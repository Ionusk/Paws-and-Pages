import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
    BookUp,
    EyeOff,
    Inbox,
    MessagesSquare,
    Pencil,
    Send,
    Trash2,
    UserRound,
    X,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';

import { BookCover, BookStatusBadge } from '@/components/campus/CampusBookCard';
import { CampusShell } from '@/components/campus/CampusShell';
import { Notice, StateCard } from '@/components/ui/feedback';
import { FONT, PALETTE } from '@/constants/palette';
import { ApiError, getErrorMessage } from '@/lib/api';
import { useCampusApi, type CampusBook } from '@/lib/campusApi';
import { confirmAction } from '@/lib/feedback';

type Feedback = { tone: 'success' | 'error' | 'info'; message: string } | null;

export default function CampusBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const campus = useCampusApi();

  const [book, setBook] = useState<CampusBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setBook(await campus.getBook(id));
      setNotFound(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(getErrorMessage(err, "We couldn't load this book."));
      }
    } finally {
      setLoading(false);
    }
  }, [campus, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const run = async (key: string, action: () => Promise<void>) => {
    if (busy) return;

    try {
      setBusy(key);
      setFeedback(null);
      await action();
    } catch (err) {
      setFeedback({ tone: 'error', message: getErrorMessage(err, 'Something went wrong. Please try again.') });
      // The book may have changed meanwhile (e.g. lent to someone else).
      campus.getBook(id).then(setBook).catch(() => {});
    } finally {
      setBusy(null);
    }
  };

  const requestBook = () =>
    run('request', async () => {
      if (!book) return;
      await campus.createRequest(book.id, note);
      setNote('');
      setBook(await campus.getBook(book.id));
      setFeedback({
        tone: 'success',
        message: `Request sent! @${book.owner.username} will see it in their requests. If they accept, a private chat opens.`,
      });
    });

  const cancelRequest = async () => {
    if (!book?.myRequest) return;

    const confirmed = await confirmAction({
      title: 'Cancel your request?',
      message: `@${book.owner.username} won't be able to accept it any more.`,
      confirmText: 'Cancel request',
      cancelText: 'Keep it',
      destructive: true,
    });

    if (!confirmed) return;

    run('cancel', async () => {
      await campus.actOnRequest(book.myRequest!.id, 'cancel');
      setBook(await campus.getBook(book.id));
      setFeedback({ tone: 'info', message: 'Your request was cancelled.' });
    });
  };

  const toggleVisibility = () =>
    run('visibility', async () => {
      if (!book) return;
      const next = book.status === 'inactive' ? 'available' : 'inactive';
      const updated = await campus.updateBook(book.id, { status: next });
      setBook(updated);
      setFeedback({
        tone: 'success',
        message:
          next === 'available'
            ? 'Your book is visible again and can be requested.'
            : 'Your book is hidden. Other students can’t see or request it, and waiting requests were closed.',
      });
    });

  const deleteBook = async () => {
    if (!book) return;

    const confirmed = await confirmAction({
      title: 'Remove this listing?',
      message: `"${book.title}" will disappear from Campus and waiting requests will be closed. This can't be undone.`,
      confirmText: 'Remove',
      destructive: true,
    });

    if (!confirmed) return;

    run('delete', async () => {
      await campus.deleteBook(book.id);
      router.replace('/campus/mine');
    });
  };

  if (loading && !book) {
    return (
      <CampusShell title="Book details" showTabs={false} backFallback="/campus" backLabel="Back to Campus">
        <StateCard loading loadingText="Opening the book..." />
      </CampusShell>
    );
  }

  if (notFound || !book) {
    return (
      <CampusShell title="Book details" showTabs={false} backFallback="/campus" backLabel="Back to Campus">
        <StateCard
          error={notFound ? 'This book isn’t available any more. Its owner may have removed or hidden it.' : loadError}
          onRetry={notFound ? () => router.replace('/campus') : load}
        />
      </CampusShell>
    );
  }

  const isPending = book.myRequest?.status === 'pending';
  const isBorrower = book.myRequest?.status === 'accepted';

  const renderVisitorActions = () => {
    if (isBorrower && book.activeConversationId) {
      return (
        <>
          <Notice tone="success" message={`@${book.owner.username} accepted your request. Use the chat to arrange the handover.`} />
          <Pressable
            onPress={() => router.push(`/campus/chat/${String(book.activeConversationId)}`)}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <MessagesSquare size={18} color={PALETTE.white} />
            <Text style={styles.primaryText}>Open chat</Text>
          </Pressable>
        </>
      );
    }

    if (isPending) {
      return (
        <>
          <Notice tone="info" message={`Your request is waiting for @${book.owner.username} to reply.`} />
          <Pressable
            onPress={cancelRequest}
            disabled={Boolean(busy)}
            style={({ pressed }) => [styles.secondary, busy && styles.disabled, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            {busy === 'cancel' ? <ActivityIndicator color={PALETTE.text} /> : <X size={17} color={PALETTE.text} />}
            <Text style={styles.secondaryText}>Cancel request</Text>
          </Pressable>
        </>
      );
    }

    if (book.status !== 'available') {
      return (
        <View style={[styles.primary, styles.disabled]} accessibilityState={{ disabled: true }}>
          <Text style={styles.primaryText}>Currently lent out</Text>
        </View>
      );
    }

    return (
      <>
        <Text style={styles.label}>MESSAGE FOR @{book.owner.username.toUpperCase()} (OPTIONAL)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="e.g. I need it for the Algorithms exam next week."
          placeholderTextColor="#A99AAF"
          multiline
          maxLength={500}
          textAlignVertical="top"
          editable={!busy}
          accessibilityLabel="Message for the owner"
        />
        <Pressable
          onPress={requestBook}
          disabled={Boolean(busy)}
          style={({ pressed }) => [styles.primary, busy && styles.disabled, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(busy), busy: busy === 'request' }}
        >
          {busy === 'request' ? <ActivityIndicator color={PALETTE.white} /> : <Send size={17} color={PALETTE.white} />}
          <Text style={styles.primaryText}>{busy === 'request' ? 'Sending request...' : 'Request to borrow'}</Text>
        </Pressable>
      </>
    );
  };

  const renderOwnerActions = () => (
    <>
      {book.status === 'borrowed' ? (
        <Notice tone="info" message="This book is lent out. Mark it as returned in Requests when you get it back." />
      ) : null}

      {(book.pendingRequests ?? 0) > 0 || book.status === 'borrowed' ? (
        <Pressable
          onPress={() => router.push('/campus/requests')}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Inbox size={18} color={PALETTE.white} />
          <Text style={styles.primaryText}>
            {book.status === 'borrowed'
              ? 'Manage the borrowing'
              : `See ${book.pendingRequests} waiting ${book.pendingRequests === 1 ? 'request' : 'requests'}`}
          </Text>
        </Pressable>
      ) : null}

      {book.activeConversationId ? (
        <Pressable
          onPress={() => router.push(`/campus/chat/${String(book.activeConversationId)}`)}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <MessagesSquare size={17} color={PALETTE.text} />
          <Text style={styles.secondaryText}>Open chat with the borrower</Text>
        </Pressable>
      ) : null}

      <View style={styles.ownerRow}>
        <Pressable
          onPress={() => router.push({ pathname: '/campus/publish', params: { id: String(book.id) } })}
          disabled={Boolean(busy)}
          style={({ pressed }) => [styles.secondary, styles.flexButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Pencil size={16} color={PALETTE.text} />
          <Text style={styles.secondaryText}>Edit</Text>
        </Pressable>

        <Pressable
          onPress={toggleVisibility}
          disabled={Boolean(busy) || book.status === 'borrowed'}
          style={({ pressed }) => [
            styles.secondary,
            styles.flexButton,
            (busy || book.status === 'borrowed') && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(busy) || book.status === 'borrowed' }}
        >
          {busy === 'visibility' ? (
            <ActivityIndicator color={PALETTE.text} />
          ) : book.status === 'inactive' ? (
            <BookUp size={16} color={PALETTE.text} />
          ) : (
            <EyeOff size={16} color={PALETTE.text} />
          )}
          <Text style={styles.secondaryText}>{book.status === 'inactive' ? 'Make available' : 'Hide'}</Text>
        </Pressable>

        <Pressable
          onPress={deleteBook}
          disabled={Boolean(busy) || book.status === 'borrowed'}
          style={({ pressed }) => [
            styles.secondary,
            styles.flexButton,
            styles.danger,
            (busy || book.status === 'borrowed') && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(busy) || book.status === 'borrowed' }}
        >
          {busy === 'delete' ? <ActivityIndicator color={PALETTE.danger} /> : <Trash2 size={16} color={PALETTE.danger} />}
          <Text style={[styles.secondaryText, styles.dangerText]}>Remove</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <CampusShell
      title={book.title}
      eyebrow={book.isOwner ? 'YOUR LISTING' : 'CAMPUS BOOK'}
      showTabs={false}
      backFallback="/campus"
      backLabel="Back to Campus"
      refreshing={loading}
      onRefresh={load}
    >
      <View style={[styles.layout, isWide && styles.layoutWide]}>
        <View style={[styles.coverColumn, isWide && styles.coverColumnWide]}>
          <BookCover uri={book.coverUrl} height={isWide ? 380 : 300} />
        </View>

        <View style={styles.infoColumn}>
          <View style={styles.card}>
            <View style={styles.badges}>
              <BookStatusBadge status={book.status} />
              {book.category ? (
                <View style={styles.category}>
                  <Text style={styles.categoryText}>{book.category}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.author}>by {book.author}</Text>

            <View style={styles.owner}>
              <View style={styles.ownerIcon}>
                <UserRound size={16} color={PALETTE.purple} />
              </View>
              <Text style={styles.ownerText}>
                {book.isOwner ? 'You are lending this book' : `Shared by @${book.owner.username}`}
              </Text>
            </View>

            {book.description ? (
              <>
                <Text style={styles.label}>ABOUT THIS COPY</Text>
                <Text style={styles.body}>{book.description}</Text>
              </>
            ) : null}

            {book.notes ? (
              <>
                <Text style={styles.label}>NOTES FROM THE OWNER</Text>
                <Text style={styles.body}>{book.notes}</Text>
              </>
            ) : null}
          </View>

          <View style={styles.actions}>
            {feedback ? (
              <Notice tone={feedback.tone} message={feedback.message} onDismiss={() => setFeedback(null)} />
            ) : null}

            {book.isOwner ? renderOwnerActions() : renderVisitorActions()}
          </View>
        </View>
      </View>
    </CampusShell>
  );
}

const styles = StyleSheet.create({
  layout: { gap: 20 },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 },
  coverColumn: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  coverColumnWide: { width: 300, alignSelf: 'flex-start' },
  infoColumn: { flex: 1, gap: 16, minWidth: 0 },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: { backgroundColor: PALETTE.lavender, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  categoryText: { color: PALETTE.purple, fontSize: 10, fontFamily: FONT.bodyExtraBold },
  author: { color: PALETTE.text, fontSize: 16, fontFamily: FONT.bodyBold, marginTop: 14 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  ownerIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerText: { color: PALETTE.muted, fontSize: 13, fontFamily: FONT.bodyBold, flexShrink: 1 },
  label: {
    color: PALETTE.muted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: FONT.bodyExtraBold,
    marginTop: 18,
    marginBottom: 6,
  },
  body: { color: PALETTE.text, fontSize: 13, lineHeight: 20, fontFamily: FONT.body },
  actions: { gap: 12 },
  noteInput: {
    minHeight: 90,
    backgroundColor: PALETTE.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
    color: PALETTE.text,
    fontSize: 13,
    fontFamily: FONT.bodyMedium,
    outlineStyle: 'none',
  } as any,
  primary: {
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: PALETTE.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  primaryText: { color: PALETTE.white, fontSize: 14, fontFamily: FONT.bodyExtraBold },
  secondary: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  secondaryText: { color: PALETTE.text, fontSize: 13, fontFamily: FONT.bodyExtraBold },
  ownerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  flexButton: { flexGrow: 1, minWidth: 110 },
  danger: { borderColor: '#F2C3CB', backgroundColor: PALETTE.dangerSoft },
  dangerText: { color: PALETTE.danger },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.82 },
});
