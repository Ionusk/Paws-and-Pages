import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth0 } from 'react-native-auth0';
import { ArrowLeft, Clock3, Trash2 } from 'lucide-react-native';

import {
  API_AUDIENCE,
  AUTH_SCOPE,
  deleteVoiceConversation,
  formatDate,
  formatDuration,
  getVoiceConversation,
  type VoiceConversation,
} from '@/lib/voiceConversations';

const COLORS = {
  background: '#E9DDF2',
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

function confirmDelete(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm('Delete this conversation?'));
  }

  return new Promise((resolve) => {
    Alert.alert(
      'Delete conversation',
      'This conversation will be removed permanently.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCredentials } = useAuth0();
  const [conversation, setConversation] = useState<VoiceConversation | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = async () => {
    const credentials = await getCredentials(AUTH_SCOPE, 0, {
      audience: API_AUDIENCE,
    });

    if (!credentials?.accessToken) {
      throw new Error('Could not obtain Auth0 access token.');
    }

    return credentials.accessToken;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const credentials = await getCredentials(AUTH_SCOPE, 0, {
          audience: API_AUDIENCE,
        });

        if (!credentials?.accessToken) {
          throw new Error('Could not obtain Auth0 access token.');
        }

        const data = await getVoiceConversation(credentials.accessToken, id);
        if (!cancelled) setConversation(data);
      } catch (err) {
        console.error('Could not load conversation:', err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load conversation.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getCredentials, id]);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.push('/study/conversations');

  const handleDelete = async () => {
    if (!(await confirmDelete())) return;

    try {
      setDeleting(true);
      await deleteVoiceConversation(await getToken(), id);
      goBack();
    } catch (err) {
      console.error('Could not delete conversation:', err);
      setError(
        err instanceof Error ? err.message : 'Could not delete conversation.'
      );
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              onPress={goBack}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft size={20} color={COLORS.text} />
            </Pressable>

            <View style={styles.headerBrand}>
              <Text style={styles.brand}>PAWS & PAGES</Text>
              <Text style={styles.brandSubtitle}>CONVERSATION</Text>
            </View>

            <Pressable
              onPress={handleDelete}
              disabled={!conversation || deleting}
              accessibilityLabel="Delete conversation"
              style={({ pressed }) => [
                styles.iconButton,
                styles.deleteButton,
                (pressed || deleting || !conversation) && styles.pressed,
              ]}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <Trash2 size={19} color={COLORS.danger} />
              )}
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.darkPink} style={styles.loader} />
          ) : error && !conversation ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : conversation ? (
            <>
              <View style={styles.intro}>
                <Text style={styles.title}>{conversation.title}</Text>
                <View style={styles.meta}>
                  <Text style={styles.metaText}>
                    {formatDate(conversation.startedAt)}
                  </Text>
                  <Clock3 size={13} color={COLORS.muted} />
                  <Text style={styles.metaText}>
                    {formatDuration(conversation.durationSeconds)}
                  </Text>
                </View>
                {error && <Text style={styles.errorText}>{error}</Text>}
              </View>

              <View style={styles.transcript}>
                {conversation.messages.map((message, index) => (
                  <View
                    key={index}
                    style={[
                      styles.bubbleWrap,
                      message.role === 'user'
                        ? styles.userWrap
                        : styles.agentWrap,
                    ]}
                  >
                    <Text style={styles.speaker}>
                      {message.role === 'user' ? 'You' : 'Laica'}
                    </Text>
                    <View
                      style={[
                        styles.bubble,
                        message.role === 'user'
                          ? styles.userBubble
                          : styles.agentBubble,
                      ]}
                    >
                      <Text style={styles.bubbleText}>{message.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 35,
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

  deleteButton: {
    backgroundColor: COLORS.lightPink,
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

  loader: {
    marginTop: 40,
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
    marginTop: 10,
  },

  intro: {
    alignItems: 'center',
    marginBottom: 20,
  },

  title: {
    color: COLORS.text,
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
  },

  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },

  metaText: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
  },

  transcript: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    gap: 12,
  },

  bubbleWrap: {
    maxWidth: '85%',
    gap: 4,
  },

  userWrap: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },

  agentWrap: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },

  speaker: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
    paddingHorizontal: 4,
  },

  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  userBubble: {
    backgroundColor: COLORS.lavender,
  },

  agentBubble: {
    backgroundColor: COLORS.lightPink,
  },

  bubbleText: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 20,
  },

  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
