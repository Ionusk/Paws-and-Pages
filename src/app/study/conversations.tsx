import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth0 } from 'react-native-auth0';
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  MessageCircle,
  Mic,
  PawPrint,
} from 'lucide-react-native';

import {
  API_AUDIENCE,
  AUTH_SCOPE,
  formatDate,
  formatDuration,
  listVoiceConversations,
  type VoiceConversationSummary,
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

export default function ConversationsScreen() {
  const { getCredentials } = useAuth0();
  const [conversations, setConversations] = useState<
    VoiceConversationSummary[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);

      const credentials = await getCredentials(AUTH_SCOPE, 0, {
        audience: API_AUDIENCE,
      });

      if (!credentials?.accessToken) {
        throw new Error('Could not obtain Auth0 access token.');
      }

      setConversations(await listVoiceConversations(credentials.accessToken));
    } catch (err) {
      console.error('Could not load conversations:', err);
      setError(
        err instanceof Error ? err.message : 'Could not load conversations.'
      );
    } finally {
      setLoading(false);
    }
  }, [getCredentials]);

  // Reload whenever the screen is shown, so new and deleted chats appear.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.push('/study')
              }
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft size={20} color={COLORS.text} />
            </Pressable>

            <View style={styles.headerBrand}>
              <Text style={styles.brand}>PAWS & PAGES</Text>
              <Text style={styles.brandSubtitle}>SAVED CONVERSATIONS</Text>
            </View>

            <Pressable
              onPress={() => router.push('/study/voice')}
              accessibilityLabel="New conversation"
              style={({ pressed }) => [
                styles.iconButton,
                styles.headerIcon,
                pressed && styles.pressed,
              ]}
            >
              <Mic size={20} color={COLORS.purple} />
            </Pressable>
          </View>

          <View style={styles.intro}>
            <Text style={styles.title}>Your talks with Laica</Text>
            <Text style={styles.subtitle}>
              Every voice conversation is saved here so you can read it again
              later.
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.darkPink} style={styles.loader} />
          ) : error ? (
            <Pressable onPress={load} style={styles.messageCard}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.retryText}>Tap to try again</Text>
            </Pressable>
          ) : conversations.length === 0 ? (
            <View style={styles.messageCard}>
              <PawPrint size={32} color={COLORS.darkPink} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Start talking with Laica and your conversation will appear here
                when it ends.
              </Text>
              <Pressable
                onPress={() => router.push('/study/voice')}
                style={({ pressed }) => [
                  styles.startButton,
                  pressed && styles.pressed,
                ]}
              >
                <Mic size={18} color={COLORS.white} />
                <Text style={styles.startText}>Start talking</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.list}>
              {conversations.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push({
                      pathname: '/study/conversation/[id]',
                      params: { id: String(item.id) },
                    })
                  }
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <ArrowUpRight size={18} color={COLORS.muted} />
                  </View>

                  {item.preview && (
                    <Text style={styles.cardPreview} numberOfLines={2}>
                      “{item.preview}”
                    </Text>
                  )}

                  <View style={styles.cardMeta}>
                    <Text style={styles.metaText}>
                      {formatDate(item.startedAt)}
                    </Text>
                    <View style={styles.metaItem}>
                      <Clock3 size={13} color={COLORS.muted} />
                      <Text style={styles.metaText}>
                        {formatDuration(item.durationSeconds)}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <MessageCircle size={13} color={COLORS.muted} />
                      <Text style={styles.metaText}>{item.messageCount}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
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
    marginBottom: 28,
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

  intro: {
    alignItems: 'center',
    marginBottom: 24,
  },

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 420,
    lineHeight: 20,
  },

  loader: {
    marginTop: 40,
  },

  messageCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },

  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },

  retryText: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginTop: 6,
  },

  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 360,
  },

  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.darkPink,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 10,
  },

  startText: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: 'Nunito_800ExtraBold',
  },

  list: {
    gap: 14,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#705B83',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  cardTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  cardPreview: {
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 19,
    marginTop: 8,
  },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  metaText: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
  },

  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },

  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});
