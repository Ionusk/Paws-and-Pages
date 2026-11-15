import { useConversation } from '@elevenlabs/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Mic,
  MicOff,
  PhoneOff,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Notice, StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage, useApi } from '@/lib/api';
import { goBack } from '@/lib/navigation';
import { lessonTitle, useStudyLessons, type StudyLesson } from '@/lib/studyLessons';
import { saveVoiceConversation, type VoiceMessage } from '@/lib/voiceConversations';

type Line = { id: string; role: 'user' | 'agent'; text: string };

type Session = {
  startedAt: string;
  conversationId: string | null;
  lessonTitle: string;
  messages: VoiceMessage[];
  saved: boolean;
};

async function requestMicrophonePermission() {
  if (Platform.OS !== 'android') return true;

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone access',
      message: 'The study tutor needs the microphone to hear your questions.',
      buttonPositive: 'OK',
      buttonNegative: 'Cancel',
    }
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function isRomanian(text: string) {
  return /[ăâîșşțţ]/i.test(text);
}

export default function TutorScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const params = useLocalSearchParams<{ materialId?: string }>();
  const { request, getAccessToken } = useApi();
  const { lessons, loading, error: loadError, refresh } = useStudyLessons();

  const [selectedId, setSelectedId] = useState<number | null>(
    params.materialId ? Number(params.materialId) : null
  );
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetchingToken, setFetchingToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const sessionRef = useRef<Session | null>(null);

  const lesson = lessons.find((item) => item.id === selectedId) ?? null;

  // Saves the conversation once, into the same "Saved conversations" list.
  const saveSession = async () => {
    const session = sessionRef.current;
    if (!session || session.saved || session.messages.length === 0) return;

    session.saved = true;

    try {
      await saveVoiceConversation(await getAccessToken(), {
        elevenlabsConversationId: session.conversationId,
        title: `Lesson: ${session.lessonTitle}`,
        bookTitle: session.lessonTitle,
        messages: session.messages,
        durationSeconds: (Date.now() - new Date(session.startedAt).getTime()) / 1000,
        startedAt: session.startedAt,
      });
      setSaved(true);
    } catch (err) {
      console.error('Could not save tutor conversation:', err);
      session.saved = false;
    }
  };

  const saveRef = useRef(saveSession);
  useEffect(() => {
    saveRef.current = saveSession;
  });

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      if (sessionRef.current) sessionRef.current.conversationId = conversationId;
    },
    onDisconnect: () => {
      saveRef.current();
    },
    onMessage: ({ message, role, event_id }) => {
      sessionRef.current?.messages.push({ role, text: message, at: new Date().toISOString() });
      setLines((items) => [
        ...items,
        { id: `${role}-${event_id}-${items.length}`, role, text: message },
      ]);
    },
    onError: (message, context) => {
      console.error('Tutor error:', message, context);
      setError(context?.debugMessage ? `${message} (${context.debugMessage})` : message);
    },
  });

  const { status, isSpeaking, isMuted, setMuted, endSession } = conversation;
  const connected = status === 'connected';
  const connecting = status === 'connecting' || fetchingToken;

  useEffect(() => {
    const save = saveRef;
    return () => {
      save.current();
      endSession();
    };
  }, [endSession]);

  const start = async (item: StudyLesson) => {
    if (connecting || connected) return;
    setError(null);

    try {
      if (!(await requestMicrophonePermission())) {
        setError('Microphone permission is needed to talk with the tutor.');
        return;
      }

      setFetchingToken(true);
      const data = await request<{ token?: string }>('/api/elevenlabs/tutor-token');
      if (!data.token) throw new Error('The voice tutor did not return a session token.');

      const title = lessonTitle(item);
      const summary = (item.summary ?? '').slice(0, 6000);
      const ro = isRomanian(`${title} ${summary}`);

      setLines([]);
      setSaved(false);
      sessionRef.current = {
        startedAt: new Date().toISOString(),
        conversationId: null,
        lessonTitle: title,
        messages: [],
        saved: false,
      };

      conversation.startSession({
        conversationToken: data.token,
        dynamicVariables: {
          first_message: ro
            ? `Bună! Sunt Laica. Ce vrei să afli despre „${title}”?`
            : `Hi! I'm Laica. What would you like to know about "${title}"?`,
          lesson_title: title,
          lesson_summary: summary,
          lesson_key_points:
            (item.keyPoints ?? []).map((point) => `- ${point}`).join('\n') || '-',
        },
      });
    } catch (err) {
      console.error('Tutor start error:', err);
      setError(getErrorMessage(err, 'Could not start the conversation.'));
    } finally {
      setFetchingToken(false);
    }
  };

  const statusLabel = connecting
    ? 'Connecting…'
    : connected
      ? isSpeaking
        ? 'Laica is explaining…'
        : isMuted
          ? 'Microphone muted'
          : 'Listening to your question…'
      : 'Tap the button and ask your question out loud';

  const renderPicker = () => {
    if (loading && lessons.length === 0) {
      return <StateCard loading loadingText="Loading your lessons..." />;
    }
    if (loadError && lessons.length === 0) {
      return <StateCard error={loadError} onRetry={refresh} />;
    }
    if (lessons.length === 0) {
      return (
        <View style={[styles.card, styles.center]}>
          <BookOpen size={30} color={PALETTE.purple} />
          <Text style={styles.body}>
            You have no summaries yet. Upload a course first, then come back to ask about it.
          </Text>
          <Pressable
            onPress={() => router.push('/study/upload')}
            style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.startText}>Upload a course</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.list}>
        <Text style={styles.sectionLabel}>WHICH LESSON DO YOU WANT TO TALK ABOUT?</Text>
        {lessons.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setSelectedId(item.id)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <GraduationCap size={20} color={PALETTE.purple} />
            </View>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {lessonTitle(item)}
            </Text>
            <ChevronRight size={20} color={PALETTE.muted} />
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, isCompact && styles.containerCompact]}>
        <Pressable
          onPress={() => {
            if (lesson && !connected) setSelectedId(null);
            else if (!lesson) goBack('/study');
          }}
          disabled={connected}
          style={({ pressed }) => [styles.backButton, (pressed || connected) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={lesson ? 'Choose another lesson' : 'Back to study'}
        >
          <ArrowLeft size={18} color={PALETTE.text} />
          <Text style={styles.backText}>{lesson ? 'OTHER LESSONS' : 'STUDY'}</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>STUDY TUTOR</Text>
          <Text style={styles.title} numberOfLines={3}>
            {lesson ? lessonTitle(lesson) : 'Ask about a lesson'}
          </Text>
          <Text style={styles.subtitle}>
            {lesson ? statusLabel : 'Talk out loud about one of your summaries.'}
          </Text>
        </View>

        {!lesson ? (
          <ScrollView contentContainerStyle={styles.pickerScroll}>{renderPicker()}</ScrollView>
        ) : (
          <>
            {error ? (
              <Notice tone="error" message={error} onDismiss={() => setError(null)} />
            ) : null}
            {saved ? (
              <Notice
                tone="success"
                message="Saved to your conversations."
                actionLabel="View"
                onAction={() => router.push('/study/conversations')}
              />
            ) : null}

            <ScrollView
              ref={scrollRef}
              style={styles.transcript}
              contentContainerStyle={styles.transcriptContent}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {lines.length === 0 ? (
                <Text style={styles.placeholder}>
                  Try: “Explain this lesson in simple words”, “What is the most
                  important idea?” or “Quiz me with 3 questions”.
                </Text>
              ) : (
                lines.map((line) => (
                  <View
                    key={line.id}
                    style={[styles.bubble, line.role === 'user' ? styles.userBubble : styles.agentBubble]}
                  >
                    <Text style={styles.bubbleText}>{line.text}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.controls}>
              {connected ? (
                <>
                  <Pressable
                    onPress={() => setMuted(!isMuted)}
                    style={({ pressed }) => [styles.round, styles.roundLight, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? <MicOff size={26} color={PALETTE.text} /> : <Mic size={26} color={PALETTE.text} />}
                  </Pressable>
                  <Pressable
                    onPress={() => endSession()}
                    style={({ pressed }) => [styles.round, styles.roundEnd, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="End conversation"
                  >
                    <PhoneOff size={26} color={PALETTE.white} />
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => start(lesson)}
                  disabled={connecting}
                  style={({ pressed }) => [styles.startButton, (pressed || connecting) && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityState={{ busy: connecting }}
                >
                  {connecting ? <ActivityIndicator color={PALETTE.white} /> : <Mic size={22} color={PALETTE.white} />}
                  <Text style={styles.startText}>{connecting ? 'Connecting' : 'Start asking'}</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 12,
  },
  containerCompact: { paddingHorizontal: 16, paddingTop: 16 },
  center: { alignItems: 'center', gap: 12 },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PALETTE.white,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  backText: { color: PALETTE.text, fontSize: 10, letterSpacing: 1, fontFamily: FONT.bodyExtraBold },
  header: { alignItems: 'center' },
  eyebrow: { color: PALETTE.darkPink, fontSize: 10, letterSpacing: 2, fontFamily: FONT.bodyExtraBold },
  title: { color: PALETTE.text, fontSize: 26, textAlign: 'center', fontFamily: FONT.heading, marginTop: 6 },
  subtitle: { color: PALETTE.muted, fontSize: 13, textAlign: 'center', fontFamily: FONT.bodyMedium, marginTop: 6 },
  pickerScroll: { paddingBottom: 20 },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  body: { color: PALETTE.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', fontFamily: FONT.body },
  sectionLabel: { color: PALETTE.purple, fontSize: 10, letterSpacing: 1.4, fontFamily: FONT.bodyExtraBold, marginBottom: 2 },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { flex: 1, color: PALETTE.text, fontSize: 15, fontFamily: FONT.bodyExtraBold },
  transcript: {
    flex: 1,
    backgroundColor: PALETTE.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  transcriptContent: { padding: 18, gap: 10 },
  placeholder: { color: PALETTE.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', fontFamily: FONT.body, marginTop: 10 },
  bubble: { maxWidth: '85%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: PALETTE.lavender },
  agentBubble: { alignSelf: 'flex-start', backgroundColor: PALETTE.lightPink },
  bubbleText: { color: PALETTE.text, fontSize: 14, lineHeight: 20, fontFamily: FONT.body },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, marginTop: 6 },
  round: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  roundLight: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border },
  roundEnd: { backgroundColor: PALETTE.danger },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PALETTE.darkPink,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 32,
  },
  startText: { color: PALETTE.white, fontSize: 16, fontFamily: FONT.bodyExtraBold },
  pressed: { opacity: 0.8 },
});
