import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Clock3, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

import { Notice, StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT } from '@/constants/palette';
import { getErrorMessage, useApi } from '@/lib/api';
import { confirmAction } from '@/lib/feedback';
import { goBack } from '@/lib/navigation';
import {
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

export default function ConversationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getAccessToken } = useApi();
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const [conversation, setConversation] = useState<VoiceConversation | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!id) {
      setLoadError("We couldn't find this conversation.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);

      const data = await getVoiceConversation(await getAccessToken(), id);
      if (mountedRef.current) setConversation(data);
    } catch (err) {
      console.error('Could not load conversation:', err);
      if (mountedRef.current) {
        setLoadError(getErrorMessage(err, 'Could not load conversation.'));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [getAccessToken, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const leave = () => goBack('/study/conversations');

  const handleDelete = async () => {
    if (deletingRef.current || !conversation) return;

    const confirmed = await confirmAction({
      title: 'Delete conversation',
      message: 'This conversation will be removed permanently.',
      confirmText: 'Delete',
      destructive: true,
    });

    if (!confirmed) return;

    deletingRef.current = true;

    try {
      setDeleting(true);
      setDeleteError(null);
      await deleteVoiceConversation(await getAccessToken(), conversation.id);
      // The list reloads on focus, so the deleted chat disappears there.
      leave();
    } catch (err) {
      console.error('Could not delete conversation:', err);
      if (mountedRef.current) {
        setDeleteError(getErrorMessage(err, 'Could not delete conversation.'));
        setDeleting(false);
      }
    } finally {
      deletingRef.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.container, isCompact && styles.containerCompact]}>
          <View style={styles.header}>
            <Pressable
              onPress={leave}
              accessibilityRole="button"
              accessibilityLabel="Go back"
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
              accessibilityRole="button"
              accessibilityLabel="Delete conversation"
              accessibilityState={{
                disabled: !conversation || deleting,
                busy: deleting,
              }}
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

          {loading || (loadError && !conversation) ? (
            <StateCard
              loading={loading}
              loadingText="Loading conversation..."
              error={loadError}
              onRetry={load}
            />
          ) : conversation ? (
            <>
              <View style={styles.intro}>
                <Text style={[styles.title, isCompact && styles.titleCompact]}>
                  {conversation.title}
                </Text>
                <View style={styles.meta}>
                  <Text style={styles.metaText}>
                    {formatDate(conversation.startedAt)}
                  </Text>
                  <Clock3 size={13} color={COLORS.muted} />
                  <Text style={styles.metaText}>
                    {formatDuration(conversation.durationSeconds)}
                  </Text>
                </View>
              </View>

              {deleteError && (
                <Notice
                  tone="error"
                  message={deleteError}
                  onDismiss={() => setDeleteError(null)}
                  style={styles.notice}
                />
              )}

              <View
                style={[
                  styles.transcript,
                  isCompact && styles.transcriptCompact,
                ]}
              >
                {conversation.messages.length === 0 ? (
                  <Text style={styles.emptyText}>
                    This conversation doesn&apos;t have any messages.
                  </Text>
                ) : (
                  conversation.messages.map((message, index) => (
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
                  ))
                )}
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

  containerCompact: {
    paddingHorizontal: 16,
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

  notice: {
    marginBottom: 16,
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

  titleCompact: {
    fontSize: 22,
  },

  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
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

  transcriptCompact: {
    padding: 14,
  },

  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
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
