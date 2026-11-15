import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  AudioLines,
  BookOpen,
  ChevronRight,
  Headphones,
  MessageCircleQuestionMark,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
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
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage, useApi } from '@/lib/api';
import { goBack } from '@/lib/navigation';
import {
  audioUrl,
  lessonCharacters,
  lessonTitle,
  useStudyLessons,
  type LessonAudio,
  type StudyLesson,
} from '@/lib/studyLessons';

const SPEEDS = [1, 1.25, 1.5, 0.75];

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function LessonPlayer({ url, title }: { url: string; title: string }) {
  const player = useAudioPlayer(audioUrl(url), { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [speed, setSpeed] = useState(1);

  // Pause when leaving this page: going back, opening another screen on
  // top (account, tutor...) or switching tabs. Runs on unmount too.
  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          player.pause();
        } catch {}
      };
    }, [player])
  );

  const duration = status.duration || 0;
  const progress = duration > 0 ? Math.min(status.currentTime / duration, 1) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (duration > 0 && status.currentTime >= duration - 0.3)) {
      player.seekTo(0);
    }
    player.play();
  };

  const skip = (delta: number) => {
    const target = Math.min(Math.max(status.currentTime + delta, 0), duration || 0);
    player.seekTo(target);
  };

  const nextSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    player.setPlaybackRate(next);
  };

  return (
    <View style={styles.player}>
      <View style={styles.playerTrack}>
        <View style={[styles.playerFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.playerTimes}>
        <Text style={styles.playerTime}>{formatClock(status.currentTime)}</Text>
        <Text style={styles.playerTime}>
          {status.isLoaded ? formatClock(duration) : 'Loading…'}
        </Text>
      </View>

      <View style={styles.playerControls}>
        <Pressable
          onPress={() => skip(-15)}
          style={({ pressed }) => [styles.smallControl, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back 15 seconds"
        >
          <RotateCcw size={20} color={PALETTE.text} />
          <Text style={styles.skipText}>15</Text>
        </Pressable>

        <Pressable
          onPress={toggle}
          disabled={!status.isLoaded}
          style={({ pressed }) => [
            styles.playButton,
            (pressed || !status.isLoaded) && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? `Pause ${title}` : `Play ${title}`}
        >
          {!status.isLoaded ? (
            <ActivityIndicator color={PALETTE.white} />
          ) : status.playing ? (
            <Pause size={28} color={PALETTE.white} fill={PALETTE.white} />
          ) : (
            <Play size={28} color={PALETTE.white} fill={PALETTE.white} />
          )}
        </Pressable>

        <Pressable
          onPress={() => skip(15)}
          style={({ pressed }) => [styles.smallControl, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Forward 15 seconds"
        >
          <RotateCw size={20} color={PALETTE.text} />
          <Text style={styles.skipText}>15</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={nextSpeed}
        style={({ pressed }) => [styles.speedButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Playback speed ${speed}x. Tap to change.`}
      >
        <Text style={styles.speedText}>Speed {speed}x</Text>
      </Pressable>
    </View>
  );
}

export default function AudioLessonsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const params = useLocalSearchParams<{ materialId?: string }>();
  const { request } = useApi();
  const { lessons, audio, remaining, loading, error, refresh, setAudio } =
    useStudyLessons();

  const [selectedId, setSelectedId] = useState<number | null>(
    params.materialId ? Number(params.materialId) : null
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const selected = lessons.find((lesson) => lesson.id === selectedId) ?? null;
  const selectedAudio = audio.find((item) => item.materialId === selectedId) ?? null;

  const createAudio = async (lesson: StudyLesson) => {
    try {
      setCreating(true);
      setCreateError('');

      const data = await request<{ url: string; characters: number }>(
        `/api/study/materials/${lesson.id}/audio`,
        { method: 'POST' }
      );

      setAudio((items: LessonAudio[]) => [
        ...items.filter((item) => item.materialId !== lesson.id),
        {
          materialId: lesson.id,
          characters: data.characters,
          createdAt: new Date().toISOString(),
          url: data.url,
        },
      ]);
    } catch (err) {
      console.error('Audio creation error:', err);
      setCreateError(getErrorMessage(err, "We couldn't create the audio."));
    } finally {
      setCreating(false);
    }
  };

  const openTutor = (lesson: StudyLesson) =>
    router.push({ pathname: '/study/tutor', params: { materialId: String(lesson.id) } });

  const renderDetail = (lesson: StudyLesson) => {
    const cost = lessonCharacters(lesson);
    const notEnough = remaining !== null && remaining < cost;

    return (
      <>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>AUDIO LESSON</Text>
          <Text style={styles.lessonTitle}>{lessonTitle(lesson)}</Text>

          {selectedAudio ? (
            <LessonPlayer
              key={selectedAudio.url}
              url={selectedAudio.url}
              title={lessonTitle(lesson)}
            />
          ) : (
            <View style={styles.createBox}>
              <Text style={styles.bodyText}>
                Laica reads your summary and key points out loud. The audio is
                saved, so you can listen again any time for free.
              </Text>
              <Text style={styles.costText}>
                Uses about {cost} ElevenLabs characters
                {remaining !== null ? ` · ${remaining} left this month` : ''}
              </Text>

              <Pressable
                onPress={() => createAudio(lesson)}
                disabled={creating || notEnough}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || creating || notEnough) && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ busy: creating, disabled: notEnough }}
              >
                {creating ? (
                  <ActivityIndicator color={PALETTE.white} />
                ) : (
                  <AudioLines size={18} color={PALETTE.white} />
                )}
                <Text style={styles.primaryText}>
                  {creating ? 'Creating audio… (up to a minute)' : 'Create audio'}
                </Text>
              </Pressable>

              {notEnough ? (
                <Notice
                  tone="info"
                  message="Not enough ElevenLabs characters left this month for this lesson."
                  style={styles.notice}
                />
              ) : null}
            </View>
          )}

          {createError ? (
            <Notice
              tone="error"
              message={createError}
              onDismiss={() => setCreateError('')}
              style={styles.notice}
            />
          ) : null}
        </View>

        <Pressable
          onPress={() => openTutor(lesson)}
          style={({ pressed }) => [styles.tutorCard, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.tutorIcon}>
            <MessageCircleQuestionMark size={22} color={PALETTE.darkPink} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.tutorTitle}>Ask about this lesson</Text>
            <Text style={styles.bodyText}>
              Talk with the study tutor and ask questions out loud.
            </Text>
          </View>
          <ChevronRight size={20} color={PALETTE.text} />
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>WHAT YOU WILL HEAR</Text>
          <Text style={styles.bodyText}>{lesson.summary}</Text>
          {(lesson.keyPoints ?? []).map((point, index) => (
            <Text key={index} style={styles.keyPoint}>
              {index + 1}. {point}
            </Text>
          ))}
        </View>
      </>
    );
  };

  const renderList = () => {
    if (loading && lessons.length === 0) {
      return <StateCard loading loadingText="Loading your lessons..." />;
    }

    if (error && lessons.length === 0) {
      return <StateCard error={error} onRetry={refresh} />;
    }

    if (lessons.length === 0) {
      return (
        <View style={[styles.card, styles.center]}>
          <BookOpen size={30} color={PALETTE.purple} />
          <Text style={styles.lessonTitle}>No summaries yet</Text>
          <Text style={[styles.bodyText, styles.centerText]}>
            Upload a course and Gemini makes a summary. Then you can listen to it here.
          </Text>
          <Pressable
            onPress={() => router.push('/study/upload')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Sparkles size={18} color={PALETTE.white} />
            <Text style={styles.primaryText}>Upload a course</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.list}>
        {lessons.map((lesson) => {
          const ready = audio.some((item) => item.materialId === lesson.id);

          return (
            <Pressable
              key={lesson.id}
              onPress={() => setSelectedId(lesson.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${lessonTitle(lesson)}${ready ? ', audio ready' : ''}`}
            >
              <View style={[styles.rowIcon, ready && styles.rowIconReady]}>
                <Headphones size={20} color={ready ? PALETTE.white : PALETTE.purple} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {lessonTitle(lesson)}
                </Text>
                <Text style={styles.rowMeta}>
                  {ready ? 'Audio ready · tap to listen' : 'No audio yet'}
                </Text>
              </View>
              <ChevronRight size={20} color={PALETTE.muted} />
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container, isCompact && styles.containerCompact]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => (selected ? setSelectedId(null) : goBack('/study'))}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={selected ? 'Back to all lessons' : 'Back to study'}
        >
          <ArrowLeft size={18} color={PALETTE.text} />
          <Text style={styles.backText}>{selected ? 'ALL LESSONS' : 'STUDY'}</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>LEARN ON THE GO</Text>
          <Text style={styles.title}>Audio lessons</Text>
          <Text style={styles.subtitle}>
            Listen to your Gemini summaries, read by Laica.
          </Text>
        </View>

        {selected ? renderDetail(selected) : renderList()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  container: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 14,
  },
  containerCompact: { paddingHorizontal: 16 },
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: 10 },
  centerText: { textAlign: 'center' },
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
  header: { alignItems: 'center', marginVertical: 8 },
  eyebrow: { color: PALETTE.darkPink, fontSize: 10, letterSpacing: 2, fontFamily: FONT.bodyExtraBold },
  title: { color: PALETTE.text, fontSize: 32, fontFamily: FONT.heading, marginTop: 6 },
  subtitle: { color: PALETTE.muted, fontSize: 13, fontFamily: FONT.body, marginTop: 6, textAlign: 'center' },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 8,
  },
  lessonTitle: { color: PALETTE.text, fontSize: 21, lineHeight: 28, fontFamily: FONT.heading },
  bodyText: { color: PALETTE.muted, fontSize: 13, lineHeight: 20, fontFamily: FONT.body },
  keyPoint: { color: PALETTE.text, fontSize: 13, lineHeight: 20, fontFamily: FONT.bodyMedium },
  costText: { color: PALETTE.purple, fontSize: 11, fontFamily: FONT.bodyBold },
  createBox: { gap: 10, marginTop: 6 },
  notice: { marginTop: 8 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PALETTE.text,
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  primaryText: { color: PALETTE.white, fontSize: 13, fontFamily: FONT.bodyExtraBold },
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
  rowIconReady: { backgroundColor: PALETTE.darkPink },
  rowTitle: { color: PALETTE.text, fontSize: 15, fontFamily: FONT.bodyExtraBold },
  rowMeta: { color: PALETTE.muted, fontSize: 11, fontFamily: FONT.bodyMedium, marginTop: 3 },
  player: { marginTop: 12, gap: 6 },
  playerTrack: { height: 8, borderRadius: 8, backgroundColor: PALETTE.lavender, overflow: 'hidden' },
  playerFill: { height: '100%', backgroundColor: PALETTE.darkPink },
  playerTimes: { flexDirection: 'row', justifyContent: 'space-between' },
  playerTime: { color: PALETTE.muted, fontSize: 11, fontFamily: FONT.bodyBold },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 26,
    marginTop: 6,
  },
  smallControl: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { position: 'absolute', bottom: 7, color: PALETTE.text, fontSize: 8, fontFamily: FONT.bodyExtraBold },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PALETTE.darkPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: PALETTE.lavender,
  },
  speedText: { color: PALETTE.text, fontSize: 12, fontFamily: FONT.bodyExtraBold },
  tutorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: PALETTE.lightPink,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: PALETTE.pink,
  },
  tutorIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorTitle: { color: PALETTE.text, fontSize: 16, fontFamily: FONT.bodyExtraBold },
  pressed: { opacity: 0.8 },
});
