import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BookOpen, Lock, Send, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';

import { Notice, StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { ApiError, getErrorMessage } from '@/lib/api';
import {
    formatMessageTime,
    useCampusApi,
    type ChatMessage,
    type Conversation,
} from '@/lib/campusApi';
import { goBack } from '@/lib/navigation';

// No realtime infrastructure exists in the backend, so the open chat polls
// for new messages. Messages are stored server-side, so the history is there
// whenever the app is reopened.
const POLL_MS = 4000;
const MAX_LENGTH = 2000;

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  if (incoming.length === 0) return current;

  const seen = new Set(current.map((message) => message.id));
  const added = incoming.filter((message) => !seen.has(message.id));

  return added.length === 0 ? current : [...current, ...added].sort((a, b) => a.id - b.id);
}

export default function CampusChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const campus = useCampusApi();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pollError, setPollError] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lastIdRef = useRef<number | null>(null);
  const loadedRef = useRef(false);
  const nearBottomRef = useRef(true);

  // Newest message id, used to poll only for messages after it.
  useEffect(() => {
    if (messages.length > 0) lastIdRef.current = messages[messages.length - 1].id;
  }, [messages]);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const data = await campus.getMessages(id);

      setConversation(data.conversation);
      setMessages(data.messages);
      setHasOlder(data.hasOlder);
      loadedRef.current = true;
      setNotFound(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setLoadError(getErrorMessage(err, "We couldn't open this conversation."));
      }
    } finally {
      setLoading(false);
    }
  }, [campus, id]);

  const poll = useCallback(async () => {
    try {
      const data = await campus.getMessages(id, lastIdRef.current);

      setConversation(data.conversation);
      setPollError(false);

      if (data.messages.length > 0) {
        setMessages((current) => mergeMessages(current, data.messages));
      }
    } catch {
      setPollError(true);
    }
  }, [campus, id]);

  // Load when the screen opens; poll while it stays focused.
  useFocusEffect(
    useCallback(() => {
      if (loadedRef.current) {
        poll();
      } else {
        loadInitial();
      }

      const timer = setInterval(() => {
        if (loadedRef.current) poll();
      }, POLL_MS);

      return () => clearInterval(timer);
    }, [loadInitial, poll])
  );

  const loadOlder = async () => {
    if (loadingOlder || messages.length === 0) return;

    try {
      setLoadingOlder(true);
      const data = await campus.getOlderMessages(id, messages[0].id);
      setMessages((current) => {
        const seen = new Set(current.map((message) => message.id));
        return [...data.messages.filter((message) => !seen.has(message.id)), ...current];
      });
      setHasOlder(data.hasOlder);
    } catch (err) {
      setSendError(getErrorMessage(err, "We couldn't load older messages."));
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !conversation?.isOpen) return;

    try {
      setSending(true);
      setSendError('');

      const message = await campus.sendMessage(id, body);

      setDraft('');
      nearBottomRef.current = true;
      setMessages((current) => mergeMessages(current, [message]));
    } catch (err) {
      setSendError(getErrorMessage(err, "Your message wasn't sent. Please try again."));

      if (err instanceof ApiError && err.data?.code === 'CONVERSATION_CLOSED') {
        poll();
      }
    } finally {
      setSending(false);
    }
  };

  if (loading && !conversation) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <StateCard loading loadingText="Opening your chat..." />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !conversation) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <StateCard
            error={notFound ? "This conversation doesn't exist or isn't yours." : loadError}
            onRetry={notFound ? () => router.replace('/campus/messages') : loadInitial}
          />
        </View>
      </SafeAreaView>
    );
  }

  const canSend = conversation.isOpen && draft.trim().length > 0 && !sending;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={[styles.frame, isCompact && styles.frameCompact]}>
          {/* HEADER */}
          <View style={styles.header}>
            <Pressable
              onPress={() => goBack('/campus/messages')}
              style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Back to messages"
            >
              <ArrowLeft size={19} color={PALETTE.text} />
            </Pressable>

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{conversation.otherUsername.slice(0, 1).toUpperCase()}</Text>
            </View>

            <View style={styles.headerText}>
              <Text style={styles.headerName} numberOfLines={1}>
                @{conversation.otherUsername}
              </Text>
              <Pressable
                onPress={() => router.push(`/campus/book/${conversation.book.id}`)}
                style={styles.bookLink}
                accessibilityRole="button"
                accessibilityLabel={`Open ${conversation.book.title}`}
              >
                <BookOpen size={12} color={PALETTE.purple} />
                <Text style={styles.headerBook} numberOfLines={1}>
                  {conversation.iAmOwner ? 'Borrowing your' : 'Lending you'} “{conversation.book.title}”
                </Text>
              </Pressable>
            </View>
          </View>

          {pollError ? (
            <Notice tone="info" message="Can't reach the server. New messages will appear when the connection is back." style={styles.banner} />
          ) : null}

          {/* MESSAGES */}
          <FlatList
            ref={listRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={messages}
            keyExtractor={(message) => String(message.id)}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              nearBottomRef.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: true });
            }}
            ListHeaderComponent={
              <View>
                {hasOlder ? (
                  <Pressable
                    onPress={loadOlder}
                    disabled={loadingOlder}
                    style={({ pressed }) => [styles.older, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    {loadingOlder ? <ActivityIndicator size="small" color={PALETTE.purple} /> : null}
                    <Text style={styles.olderText}>Load earlier messages</Text>
                  </Pressable>
                ) : null}

                <View style={styles.intro}>
                  <ShieldCheck size={16} color={PALETTE.sageDark} />
                  <Text style={styles.introText}>
                    This chat is private between you and @{conversation.otherUsername}.
                    Agree on a safe, public place on campus to meet, like the library.
                  </Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No messages yet. Say hi and suggest when and where to meet!
              </Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.bubbleRow, item.fromMe ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View style={[styles.bubble, item.fromMe ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, item.fromMe && styles.bubbleTextMine]} selectable>
                    {item.body}
                  </Text>
                  <Text style={[styles.bubbleTime, item.fromMe && styles.bubbleTimeMine]}>
                    {formatMessageTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            )}
          />

          {/* COMPOSER */}
          {sendError ? (
            <Notice tone="error" message={sendError} onDismiss={() => setSendError('')} style={styles.banner} />
          ) : null}

          {conversation.isOpen ? (
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message..."
                placeholderTextColor="#A99AAF"
                multiline
                maxLength={MAX_LENGTH}
                editable={!sending}
                accessibilityLabel="Message"
                onKeyPress={(event: any) => {
                  // Enter sends on web; Shift+Enter adds a new line.
                  if (Platform.OS === 'web' && event.nativeEvent.key === 'Enter' && !event.nativeEvent.shiftKey) {
                    event.preventDefault?.();
                    send();
                  }
                }}
              />
              <Pressable
                onPress={send}
                disabled={!canSend}
                style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && canSend && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !canSend, busy: sending }}
              >
                {sending ? <ActivityIndicator size="small" color={PALETTE.white} /> : <Send size={18} color={PALETTE.white} />}
              </Pressable>
            </View>
          ) : (
            <View style={styles.closed}>
              <Lock size={15} color={PALETTE.muted} />
              <Text style={styles.closedText}>
                {conversation.requestStatus === 'returned'
                  ? 'The book was returned, so this chat is now read-only.'
                  : 'This borrowing has ended, so the chat is read-only.'}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  frameCompact: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: PALETTE.lightPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: PALETTE.darkPink, fontSize: 17, fontFamily: FONT.heading },
  headerText: { flex: 1, minWidth: 0 },
  headerName: { color: PALETTE.text, fontSize: 16, fontFamily: FONT.bodyExtraBold },
  bookLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, alignSelf: 'flex-start' },
  headerBook: { color: PALETTE.purple, fontSize: 11, fontFamily: FONT.bodyBold, flexShrink: 1 },
  banner: { marginTop: 10 },
  list: { flex: 1, marginTop: 10 },
  listContent: { paddingVertical: 8, gap: 6, flexGrow: 1 },
  older: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: PALETTE.white,
    marginBottom: 10,
  },
  olderText: { color: PALETTE.purple, fontSize: 12, fontFamily: FONT.bodyExtraBold },
  intro: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    alignSelf: 'center',
    maxWidth: 520,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  introText: { flex: 1, color: PALETTE.muted, fontSize: 11, lineHeight: 16, fontFamily: FONT.body },
  emptyText: {
    color: PALETTE.muted,
    fontSize: 13,
    fontFamily: FONT.bodyMedium,
    textAlign: 'center',
    marginTop: 30,
  },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: PALETTE.text, borderBottomRightRadius: 6 },
  bubbleTheirs: {
    backgroundColor: PALETTE.white,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  bubbleText: { color: PALETTE.text, fontSize: 14, lineHeight: 20, fontFamily: FONT.body },
  bubbleTextMine: { color: PALETTE.white },
  bubbleTime: { color: '#A99AAF', fontSize: 10, fontFamily: FONT.bodyBold, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: '#D8CBE2' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 8,
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    marginTop: 10,
  },
  input: {
    flex: 1,
    maxHeight: 130,
    minHeight: 40,
    color: PALETTE.text,
    fontSize: 14,
    fontFamily: FONT.body,
    paddingTop: 10,
    paddingBottom: 10,
    outlineStyle: 'none',
  } as any,
  send: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: PALETTE.darkPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3EEF5',
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
  },
  closedText: { flex: 1, color: PALETTE.muted, fontSize: 12, fontFamily: FONT.bodyBold },
  pressed: { opacity: 0.82 },
});
