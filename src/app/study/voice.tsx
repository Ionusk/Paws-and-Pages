import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth0 } from 'react-native-auth0';
import { useConversation } from '@elevenlabs/react-native';
import {
  ArrowLeft,
  History,
  Mic,
  MicOff,
  PhoneOff,
  PawPrint,
} from 'lucide-react-native';

import {
  API_AUDIENCE,
  API_URL,
  AUTH_SCOPE,
  saveVoiceConversation,
  type VoiceMessage,
} from '@/lib/voiceConversations';

type ActiveSession = {
  startedAt: string;
  elevenlabsConversationId: string | null;
  bookTitle: string | null;
  messages: VoiceMessage[];
  saved: boolean;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

const COLORS = {
  background: '#E9DDF2',
  pink: '#F6C8D4',
  darkPink: '#B77D88',
  text: '#493653',
  muted: '#806B87',
  white: '#FFFFFF',
  lavender: '#F5ECFA',
  lightPink: '#FFF0F2',
  purple: '#9B829F',
  border: '#EDE3F0',
  danger: '#C96A7A',
};

type TranscriptLine = {
  id: string;
  role: 'user' | 'agent';
  text: string;
};

async function requestMicrophonePermission() {
  if (Platform.OS !== 'android') {
    // iOS and web show the system/browser prompt when the mic is first used.
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone access',
      message: 'Laica needs the microphone to hear you.',
      buttonPositive: 'OK',
      buttonNegative: 'Cancel',
    }
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

type VoiceParams = {
  firstMessage?: string;
  bookTitle?: string;
  bookSubtitle?: string;
  bookAuthor?: string;
  bookDescription?: string;
  aiSummary?: string;
  currentChapter?: string;
  currentParagraph?: string;
};

export default function VoiceScreen() {
  const { getCredentials } = useAuth0();
  // Optional: open this screen with book details, e.g.
  // router.push({ pathname: '/study/voice', params: { bookTitle, bookAuthor } })
  const params = useLocalSearchParams<VoiceParams>();
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetchingToken, setFetchingToken] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Kept in a ref so it is still readable when the screen unmounts.
  const sessionRef = useRef<ActiveSession | null>(null);

  // Saves the current session once. Called when the call ends and when
  // the user leaves the screen, whichever comes first.
  const saveSession = async () => {
    const session = sessionRef.current;

    if (!session || session.saved || session.messages.length === 0) {
      return;
    }

    session.saved = true;
    setSaveState('saving');

    try {
      const credentials = await getCredentials(AUTH_SCOPE, 0, {
        audience: API_AUDIENCE,
      });

      if (!credentials?.accessToken) {
        throw new Error('Could not obtain Auth0 access token.');
      }

      await saveVoiceConversation(credentials.accessToken, {
        elevenlabsConversationId: session.elevenlabsConversationId,
        bookTitle: session.bookTitle,
        messages: session.messages,
        durationSeconds:
          (Date.now() - new Date(session.startedAt).getTime()) / 1000,
        startedAt: session.startedAt,
      });

      setSaveState('saved');
    } catch (err) {
      console.error('Could not save voice conversation:', err);
      session.saved = false;
      setSaveState('failed');
    }
  };

  const saveSessionRef = useRef(saveSession);
  useEffect(() => {
    saveSessionRef.current = saveSession;
  });

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      if (sessionRef.current) {
        sessionRef.current.elevenlabsConversationId = conversationId;
      }
    },
    onDisconnect: () => {
      saveSessionRef.current();
    },
    onMessage: ({ message, role, event_id }) => {
      sessionRef.current?.messages.push({
        role,
        text: message,
        at: new Date().toISOString(),
      });

      setTranscript((lines) => [
        ...lines,
        { id: `${role}-${event_id}-${lines.length}`, role, text: message },
      ]);
    },
    onError: (message, context) => {
      console.error('ElevenLabs error:', message, context);
      const details = context?.debugMessage || context?.errorType;
      setError(
        details
          ? `${message} (${details})`
          : message || 'Something went wrong with the voice session.'
      );
    },
  });

  const { status, isSpeaking, isMuted, setMuted, endSession } = conversation;
  const connected = status === 'connected';
  const connecting = status === 'connecting' || fetchingToken;

  // Save and close the session when leaving the screen.
  useEffect(() => {
    const save = saveSessionRef;
    return () => {
      save.current();
      endSession();
    };
  }, [endSession]);

  const startConversation = async () => {
    setError(null);

    try {
      const hasMic = await requestMicrophonePermission();
      if (!hasMic) {
        setError('Microphone permission is required to talk with Laica.');
        return;
      }

      setFetchingToken(true);

      const credentials = await getCredentials(AUTH_SCOPE, 0, {
        audience: API_AUDIENCE,
      });

      if (!credentials?.accessToken) {
        throw new Error('Could not obtain Auth0 access token.');
      }

      const response = await fetch(
        `${API_URL}/api/elevenlabs/conversation-token`,
        { headers: { Authorization: `Bearer ${credentials.accessToken}` } }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.token) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      setTranscript([]);
      setSaveState('idle');
      sessionRef.current = {
        startedAt: new Date().toISOString(),
        elevenlabsConversationId: null,
        bookTitle: params.bookTitle || null,
        messages: [],
        saved: false,
      };

      conversation.startSession({
        conversationToken: data.token,
        // The agent's prompt uses these {{variables}}. ElevenLabs refuses to
        // start the conversation if any of them is missing.
        dynamicVariables: {
          first_message:
            params.firstMessage ||
            (params.bookTitle
              ? `Hi! I'm Laica. Ask me anything about ${params.bookTitle}.`
              : "Hi! I'm Laica. What would you like to talk about?"),
          book_title: params.bookTitle || 'No book selected',
          book_subtitle: params.bookSubtitle || '',
          book_author: params.bookAuthor || '',
          book_description: params.bookDescription || '',
          ai_summary: params.aiSummary || '',
          current_chapter: params.currentChapter || '',
          current_paragraph: params.currentParagraph || '',
        },
      });
    } catch (err) {
      console.error('Voice session error:', err);
      setError(
        err instanceof Error ? err.message : 'Could not start the conversation.'
      );
    } finally {
      setFetchingToken(false);
    }
  };

  const statusLabel = connecting
    ? 'Connecting…'
    : connected
      ? isSpeaking
        ? 'Laica is speaking…'
        : isMuted
          ? 'Microphone muted'
          : 'Laica is listening…'
      : 'Tap the button to start talking';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push('/study')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <ArrowLeft size={20} color={COLORS.text} />
          </Pressable>

          <View style={styles.headerBrand}>
            <Text style={styles.brand}>PAWS & PAGES</Text>
            <Text style={styles.brandSubtitle}>TALK WITH LAICA</Text>
          </View>

          <Pressable
            onPress={() => router.push('/study/conversations')}
            accessibilityLabel="Saved conversations"
            style={({ pressed }) => [
              styles.iconButton,
              styles.headerIcon,
              pressed && styles.pressed,
            ]}
          >
            <History size={20} color={COLORS.purple} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View
            style={[
              styles.avatar,
              connected && styles.avatarActive,
              isSpeaking && styles.avatarSpeaking,
            ]}
          >
            <PawPrint size={54} color={COLORS.darkPink} />
          </View>

          <Text style={styles.title}>Your study buddy</Text>
          <Text style={styles.status}>{statusLabel}</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          {saveState === 'saving' && (
            <Text style={styles.saveNote}>Saving conversation…</Text>
          )}
          {saveState === 'saved' && (
            <Pressable onPress={() => router.push('/study/conversations')}>
              <Text style={styles.saveNote}>
                Saved to your conversations · View
              </Text>
            </Pressable>
          )}
          {saveState === 'failed' && (
            <Pressable onPress={() => saveSession()}>
              <Text style={styles.error}>
                Could not save this conversation. Tap to try again.
              </Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.transcript}
          contentContainerStyle={styles.transcriptContent}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {transcript.length === 0 ? (
            <Text style={styles.placeholder}>
              Ask Laica to explain a topic, quiz you, or help you plan your study
              session.
            </Text>
          ) : (
            transcript.map((line) => (
              <View
                key={line.id}
                style={[
                  styles.bubble,
                  line.role === 'user' ? styles.userBubble : styles.agentBubble,
                ]}
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
                style={({ pressed }) => [
                  styles.roundButton,
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                {isMuted ? (
                  <MicOff size={26} color={COLORS.text} />
                ) : (
                  <Mic size={26} color={COLORS.text} />
                )}
              </Pressable>

              <Pressable
                onPress={() => endSession()}
                style={({ pressed }) => [
                  styles.roundButton,
                  styles.endButton,
                  pressed && styles.pressed,
                ]}
              >
                <PhoneOff size={26} color={COLORS.white} />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={startConversation}
              disabled={connecting}
              style={({ pressed }) => [
                styles.startButton,
                (pressed || connecting) && styles.pressed,
              ]}
            >
              {connecting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Mic size={22} color={COLORS.white} />
              )}
              <Text style={styles.startText}>
                {connecting ? 'Connecting' : 'Start talking'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  headerIcon: {
    backgroundColor: COLORS.lavender,
    borderWidth: 0,
  },

  headerBrand: {
    alignItems: 'center',
  },

  brand: {
    color: COLORS.text,
    fontSize: 17,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 2.5,
  },

  brandSubtitle: {
    color: COLORS.muted,
    fontSize: 8,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2,
    marginTop: 4,
  },

  hero: {
    alignItems: 'center',
    marginBottom: 20,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.lightPink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
    marginBottom: 16,
  },

  avatarActive: {
    borderColor: COLORS.pink,
  },

  avatarSpeaking: {
    borderColor: COLORS.darkPink,
    transform: [{ scale: 1.05 }],
  },

  title: {
    color: COLORS.text,
    fontSize: 28,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  status: {
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 6,
  },

  error: {
    color: COLORS.danger,
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    marginTop: 10,
    textAlign: 'center',
  },

  saveNote: {
    color: COLORS.purple,
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    marginTop: 10,
    textAlign: 'center',
  },

  transcript: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  transcriptContent: {
    padding: 18,
    gap: 10,
  },

  placeholder: {
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
  },

  bubble: {
    maxWidth: '85%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.lavender,
  },

  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.lightPink,
  },

  bubbleText: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 20,
  },

  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginTop: 20,
  },

  roundButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  endButton: {
    backgroundColor: COLORS.danger,
  },

  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.darkPink,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 32,
  },

  startText: {
    color: COLORS.white,
    fontSize: 16,
    fontFamily: 'Nunito_800ExtraBold',
  },

  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
