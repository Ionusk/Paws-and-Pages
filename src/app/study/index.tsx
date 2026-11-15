
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { goBack } from '@/lib/navigation';
import { useAuth0 } from 'react-native-auth0';
import {
  ArrowLeft,
  FileText,
  Brain,
  Headphones,
  GraduationCap,
  Sparkles,
  Clock3,
  BookOpen,
  ArrowUpRight,
  PawPrint,
  Target,
  LibraryBig,
  Mic,
  MessagesSquare,
} from 'lucide-react-native';

const API_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3001'
    : 'http://localhost:3001';

const API_AUDIENCE = 'https://paws-and-pages-api';
const AUTH_SCOPE = 'openid profile email';

const COLORS = {
  background: '#E9DDF2',
  pink: '#F6C8D4',
  darkPink: '#B77D88',
  text: '#493653',
  muted: '#806B87',
  white: '#FFFFFF',
  lavender: '#F5ECFA',
  lightPink: '#FFF0F2',
  sage: '#DCE6D8',
  peach: '#F7E1D5',
  purple: '#9B829F',
  border: '#EDE3F0',
};

const tools = [
  {
    title: 'Study materials',
    subtitle: 'Upload PDFs, Word documents, presentations and notes.',
    description: 'UPLOAD & ORGANIZE',
    route: '/study/upload',
    color: COLORS.lavender,
    icon: FileText,
  },
  {
    title: 'AI summaries',
    subtitle: 'Turn long courses into clear, easy-to-understand summaries.',
    description: 'UNDERSTAND BETTER',
    route: '/study/aisummary',
    color: COLORS.lightPink,
    icon: BookOpen,
  },
  {
    title: 'Practice quizzes',
    subtitle: 'Challenge yourself with questions based on your materials.',
    description: 'TEST YOUR KNOWLEDGE',
    route: '/study/practice',
    color: COLORS.sage,
    icon: Brain,
  },
  {
    title: 'Audio lessons',
    subtitle: 'Listen to your study materials whenever you want.',
    description: 'LEARN ON THE GO',
    route: '/study/summary',
    color: COLORS.peach,
    icon: Headphones,
  },
  {
    title: 'Talk with Laica',
    subtitle: 'Ask questions out loud and get spoken explanations.',
    description: 'VOICE STUDY BUDDY',
    route: '/study/voice',
    color: COLORS.lavender,
    icon: Mic,
  },
  {
    title: 'Saved conversations',
    subtitle: 'Read your past voice chats with Laica again.',
    description: 'YOUR CHAT HISTORY',
    route: '/study/conversations',
    color: COLORS.lightPink,
    icon: MessagesSquare,
  },
];

export default function StudyScreen() {
  const { getCredentials } = useAuth0();

  const [stats, setStats] = useState({
    materials: 0,
    quizzes: 0,
  });

  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const credentials = await getCredentials(
        AUTH_SCOPE,
        0,
        { audience: API_AUDIENCE }
      );

      const response = await fetch(
        `${API_URL}/api/study/stats`,
        {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || 'Eroare la încărcarea statisticilor.'
        );
      }

      setStats(data.stats);
    } catch (error) {
      console.error('Learning Journey error:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [getCredentials]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [fetchStats])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
          {/* Decorative background */}
          <View style={styles.blobTop} pointerEvents="none" />
          <View style={styles.blobBottom} pointerEvents="none" />

          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => goBack('/home')}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft size={20} color={COLORS.text} />
            </Pressable>

            <View style={styles.headerBrand}>
              <Text style={styles.brand}>PAWS & PAGES</Text>
              <Text style={styles.brandSubtitle}>YOUR LEARNING SPACE</Text>
            </View>

            <View style={styles.headerIcon}>
              <GraduationCap size={22} color={COLORS.purple} />
            </View>
          </View>

          {/* Welcome */}
          <View style={styles.intro}>
            <View style={styles.eyebrowRow}>
              <Sparkles size={14} color={COLORS.darkPink} />
              <Text style={styles.eyebrow}>YOUR LEARNING CORNER</Text>
            </View>

            <Text style={styles.title}>Make room to grow.</Text>

            <Text style={styles.subtitle}>
              A little progress every day adds up to something wonderful.
            </Text>
          </View>

          {/* Laica message */}
          <View style={styles.mascotCard}>
            <View style={styles.mascotCircle}>
              <PawPrint size={36} color={COLORS.darkPink} />
              <View style={styles.mascotSparkle}>
                <Sparkles size={13} color={COLORS.purple} />
              </View>
            </View>

            <View style={styles.mascotContent}>
              <Text style={styles.mascotEyebrow}>A LITTLE REMINDER</Text>
              <Text style={styles.mascotTitle}>Laica believes in you!</Text>
              <Text style={styles.mascotText}>
                You don't have to know everything today. Just take the
                next little step.
              </Text>
            </View>
          </View>

          {/* Progress overview */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressEyebrow}>YOUR PROGRESS</Text>
                <Text style={styles.progressTitle}>Learning journey</Text>
              </View>

              <View style={styles.targetIcon}>
                <Target size={21} color={COLORS.darkPink} />
              </View>
            </View>

            <View style={styles.progressStats}>
              <View style={styles.progressStat}>
                <LibraryBig size={19} color={COLORS.purple} />
                <Text style={styles.progressNumber}>
                  {statsLoading ? '...' : stats.materials}
                </Text>
                <Text style={styles.progressLabel}>Materials</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.progressStat}>
                <Clock3 size={19} color={COLORS.darkPink} />
                <Text style={styles.progressNumber}>—</Text>
                <Text style={styles.progressLabel}>Study time</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.progressStat}>
                <Brain size={19} color="#758B72" />
                <Text style={styles.progressNumber}>
                  {statsLoading ? '...' : stats.quizzes}
                </Text>
                <Text style={styles.progressLabel}>Quizzes</Text>
              </View>
            </View>

            <Text style={styles.progressNote}>
              Your learning statistics will grow as you use the app.
            </Text>
          </View>

          {/* Tools */}
          <View style={styles.toolsSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>READY WHEN YOU ARE</Text>
                <Text style={styles.sectionTitle}>Explore your tools</Text>
              </View>

              <Sparkles size={20} color={COLORS.darkPink} />
            </View>

            <View style={styles.toolsGrid}>
              {tools.map((tool) => {
                const Icon = tool.icon;

                return (
                  <Pressable
                    key={tool.title}
                    style={({ pressed }) => [
                      styles.toolCard,
                      { backgroundColor: tool.color },
                      pressed && styles.cardPressed,
                    ]}
                    onPress={() => router.push(tool.route as any)}
                  >
                    <View style={styles.toolTop}>
                      <View style={styles.toolIcon}>
                        <Icon
                          size={25}
                          color={COLORS.text}
                          strokeWidth={1.7}
                        />
                      </View>

                      <ArrowUpRight
                        size={20}
                        color={COLORS.muted}
                      />
                    </View>

                    <View>
                      <Text style={styles.toolTitle}>{tool.title}</Text>
                      <Text style={styles.toolDescription}>
                        {tool.subtitle}
                      </Text>
                    </View>

                    <View style={styles.toolFooter}>
                      <Text style={styles.toolTag}>{tool.description}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Bottom note */}
          <View style={styles.bottomCard}>
            <View style={styles.bottomIcon}>
              <BookOpen size={21} color={COLORS.darkPink} />
            </View>

            <View style={styles.bottomContent}>
              <Text style={styles.bottomTitle}>Small steps, big dreams.</Text>
              <Text style={styles.bottomText}>
                Your notes, summaries and learning progress,
                all in one cozy place.
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <PawPrint size={16} color={COLORS.darkPink} />
            <Text style={styles.footerText}>MADE WITH LOVE, PAWS & PAGES</Text>
            <Sparkles size={14} color={COLORS.purple} />
          </View>
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
    maxWidth: 1150,
    alignSelf: 'center',
    paddingHorizontal: 35,
    paddingTop: 24,
    paddingBottom: 35,
    overflow: 'hidden',
  },

  blobTop: {
    position: 'absolute',
    top: -120,
    right: -100,
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: COLORS.pink,
    opacity: 0.45,
  },

  blobBottom: {
    position: 'absolute',
    bottom: 180,
    left: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#C8B5E5',
    opacity: 0.35,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 38,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
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

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.lavender,
    justifyContent: 'center',
    alignItems: 'center',
  },

  intro: {
    alignItems: 'center',
    marginBottom: 28,
  },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 9,
  },

  eyebrow: {
    color: COLORS.darkPink,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2,
  },

  title: {
    color: COLORS.text,
    fontSize: 37,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: 9,
    maxWidth: 470,
    lineHeight: 20,
  },

  mascotCard: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    padding: 23,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 22,
    shadowColor: '#705B83',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },

  mascotCircle: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: COLORS.lightPink,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  mascotSparkle: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: COLORS.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mascotContent: {
    flex: 1,
  },

  mascotEyebrow: {
    color: COLORS.darkPink,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1.7,
    marginBottom: 5,
  },

  mascotTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  mascotText: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 18,
    marginTop: 5,
  },

  progressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    padding: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 38,
  },

  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 23,
  },

  progressEyebrow: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1.8,
  },

  progressTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginTop: 4,
  },

  targetIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: COLORS.lightPink,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  progressStat: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },

  progressNumber: {
    color: COLORS.text,
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  progressLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
  },

  statDivider: {
    width: 1,
    height: 52,
    backgroundColor: COLORS.border,
  },

  progressNote: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: 20,
  },

  toolsSection: {
    marginBottom: 30,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  sectionEyebrow: {
    color: COLORS.darkPink,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1.8,
    marginBottom: 5,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  toolCard: {
    width: '48%',
    flexGrow: 1,
    minHeight: 215,
    borderRadius: 24,
    padding: 21,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#705B83',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 9,
    elevation: 3,
  },

  toolTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  toolIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  toolTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  toolDescription: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 17,
    marginTop: 7,
  },

  toolFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,107,135,0.15)',
    paddingTop: 12,
    marginTop: 17,
  },

  toolTag: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },

  bottomCard: {
    backgroundColor: COLORS.lavender,
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    borderWidth: 1,
    borderColor: COLORS.white,
  },

  bottomIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomContent: {
    flex: 1,
  },

  bottomTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  bottomText: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 17,
    marginTop: 4,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    marginTop: 30,
  },

  footerText: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1.3,
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
