
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth0 } from 'react-native-auth0';
import {
  CUSTOM_SCHEME,
  clearLoginTime,
  consumeLoginReturn,
} from '@/lib/authSession';
import {
  BookOpen,
  GraduationCap,
  Pencil,
  Flower2,
  PawPrint,
  Sparkles,
} from 'lucide-react-native';
import { AnimatedMascot } from '../components/AnimatedMascot';

export default function WelcomeScreen() {
  const router = useRouter();

  const [studyHovered, setStudyHovered] = useState(false);
  const [readingHovered, setReadingHovered] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);

  const { user, isLoading, clearSession } = useAuth0();
  const hasUser = Boolean(user);
  const [leaving, setLeaving] = useState(false);
  // Read the "just logged in" flag once per visit. The effect below can run
  // several times (Auth0 refreshes `user` when a token is requested), and a
  // re-run must not mistake the login return for a normal visit.
  const loginReturnRef = useRef<boolean | null>(null);
  if (loginReturnRef.current === null) {
    loginReturnRef.current = consumeLoginReturn();
  }

  // Every time this screen is shown: if someone is logged in, log them out.
  // Exception: on web, Auth0 lands here right after login, so in that case
  // continue to /login, which syncs the account and opens /home.
  useFocusEffect(
    useCallback(() => {
      if (isLoading) {
        return;
      }

      if (!hasUser) {
        return;
      }

      if (loginReturnRef.current) {
        router.replace('/login');
        return;
      }

      setLeaving(true);
      clearLoginTime();

      clearSession(
        {},
        Platform.OS === 'web' ? undefined : { customScheme: CUSTOM_SCHEME }
      )
        .catch((error) => console.error('Logout error:', error))
        .finally(() => setLeaving(false));
    }, [isLoading, hasUser, clearSession, router])
  );

  if (isLoading || leaving || (user && Platform.OS === 'web')) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.loading]}>
        <ActivityIndicator size="large" color="#927BA0" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Decorative background */}
          <View style={styles.blobTop} pointerEvents="none" />
          <View style={styles.blobBottom} pointerEvents="none" />

          <View style={styles.decorStar1} pointerEvents="none">
            <Sparkles size={27} color="#A184B7" />
          </View>

          <View style={styles.decorStar2} pointerEvents="none">
            <Sparkles size={22} color="#A184B7" />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>PAWS & PAGES</Text>
            <Text style={styles.tagline}>READ • LEARN • DREAM</Text>
          </View>

          {/* Welcome text */}
          <View style={styles.intro}>
            <Text style={styles.eyebrow}>WELCOME TO</Text>
            <Text style={styles.heading}>Laica's little world</Text>
            <Text style={styles.subtitle}>
              A cozy space to study, read and grow.
            </Text>
          </View>

          {/* Mascot */}
          <View style={styles.mascotContainer}>
            <AnimatedMascot animation="original" />
          </View>

          {/* Main features */}
          <View style={styles.cardsContainer} pointerEvents="box-none">
            {/* Study card */}
            <Pressable
              style={({ pressed }) => [
                styles.featureCard,
                styles.studyCard,
                styles.studyPosition,
                studyHovered && styles.studyHovered,
                pressed && styles.cardPressed,
                { cursor: 'pointer' as any },
              ]}
              onHoverIn={() => setStudyHovered(true)}
              onHoverOut={() => setStudyHovered(false)}
              onPress={() => setStudyHovered(!studyHovered)}
              accessibilityRole="button"
            >
              <View style={styles.illustrationCircle}>
                <GraduationCap size={43} color="#927BA0" strokeWidth={1.7} />
                <View style={styles.smallIllustration}>
                  <Pencil size={20} color="#B77D88" strokeWidth={1.8} />
                </View>
              </View>

              <Text style={styles.cardTitle}>Study</Text>

              <Text style={styles.cardDescription}>
                Upload notes, learn & practice
              </Text>

              <View style={styles.cardTag}>
                <Text style={styles.cardTagText}>LEARN ✦</Text>
              </View>

              {studyHovered && (
                <View
                  pointerEvents="none"
                  style={[styles.infoTooltip, styles.studyTooltip]}
                >
                  <Text style={styles.tooltipTitle}>
                    Make studying easier!
                  </Text>

                  <Text style={styles.tooltipText}>
                    Upload your courses, transform your notes into AI-powered
                    summaries and test your knowledge with personalized quizzes.
                  </Text>

                  <Text style={styles.tooltipFooter}>
                    Create an account and start learning with Laica!
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Reading card */}
            <Pressable
              style={({ pressed }) => [
                styles.featureCard,
                styles.readingCard,
                styles.readingPosition,
                readingHovered && styles.readingHovered,
                pressed && styles.cardPressed,
                { cursor: 'pointer' as any },
              ]}
              onHoverIn={() => setReadingHovered(true)}
              onHoverOut={() => setReadingHovered(false)}
              onPress={() => setReadingHovered(!readingHovered)}
              accessibilityRole="button"
            >
              <View style={styles.illustrationCircle}>
                <BookOpen size={43} color="#B77D88" strokeWidth={1.7} />
                <View style={styles.smallIllustration}>
                  <Flower2 size={20} color="#9B829F" strokeWidth={1.8} />
                </View>
              </View>

              <Text style={styles.cardTitle}>Reading</Text>

              <Text style={styles.cardDescription}>
                Track books, share & reflect
              </Text>

              <View style={styles.cardTag}>
                <Text style={styles.cardTagText}>DREAM ♡</Text>
              </View>

              {readingHovered && (
                <View
                  pointerEvents="none"
                  style={[styles.infoTooltip, styles.readingTooltip]}
                >
                  <Text style={styles.tooltipTitle}>
                    Your reading journey awaits!
                  </Text>

                  <Text style={styles.tooltipText}>
                    Track your books, record your progress, write reviews,
                    save favorite quotes and share your reading moments
                    with friends.
                  </Text>

                  <Text style={styles.tooltipFooter}>
                    Create an account and join our reading community!
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Bottom section */}
          <View style={styles.bottomSection}>
            <Text style={styles.bottomTitle}>
              Your next chapter starts here.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                buttonHovered && styles.buttonHovered,
                pressed && styles.buttonPressed,
                { cursor: 'pointer' as any },
              ]}
              onHoverIn={() => setButtonHovered(true)}
              onHoverOut={() => setButtonHovered(false)}
              onPress={() => router.push('/login')}
              accessibilityRole="button"
            >
              <View style={styles.buttonContent} pointerEvents="none">
                <View>
                  <Text style={styles.buttonSmall}>
                    YOUR NEXT CHAPTER
                  </Text>
                  <Text style={styles.buttonText}>
                    Join Laica's World →
                  </Text>
                </View>

                <PawPrint size={27} color="#F6C8D4" strokeWidth={1.8} />
              </View>
            </Pressable>

            <Text style={styles.footer}>
              made with love, paws & pages ♡
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E9DDF2',
  },

  loading: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    overflow: 'hidden',
  },

  blobTop: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#F6C8D4',
    opacity: 0.75,
  },

  blobBottom: {
    position: 'absolute',
    bottom: 100,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#C8B5E5',
    opacity: 0.65,
  },

  decorStar1: {
    position: 'absolute',
    top: 150,
    left: 25,
  },

  decorStar2: {
    position: 'absolute',
    top: 280,
    right: 25,
  },

  header: {
    alignItems: 'center',
    marginBottom: 16,
  },

  logo: {
    color: '#493653',
    fontSize: 21,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 3,
  },

  tagline: {
    color: '#806B87',
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 3,
    marginTop: 5,
  },

  intro: {
    alignItems: 'center',
    marginTop: 10,
    zIndex: 2,
  },

  eyebrow: {
    color: '#927BA0',
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 3,
    marginBottom: 5,
  },

  heading: {
    color: '#493653',
    fontSize: 29,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
  },

  subtitle: {
    color: '#806B87',
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    marginTop: 7,
    textAlign: 'center',
  },

  mascotContainer: {
    width: '100%',
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 5,
    zIndex: 2,
    transform: [{ translateY: 47 }],
  },

  cardsContainer: {
    width: '60%',
    flexDirection: 'row',
    gap: 370,
    marginTop: 0,
    zIndex: 2,
  },

  featureCard: {
    flex: 1,
    minHeight: 230,
    borderRadius: 25,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#705B83',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
  },

  studyCard: {
    backgroundColor: '#F5ECFA',
  },

  readingCard: {
    backgroundColor: '#FFF0F2',
  },

  studyPosition: {
    transform: [
      { translateX: -167 },
      { translateY: -100 },
    ],
  },

  readingPosition: {
    transform: [
      { translateX: 167 },
      { translateY: -100 },
    ],
  },

  studyHovered: {
    backgroundColor: '#E8D9F2',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 9,
    zIndex: 10,
  },

  readingHovered: {
    backgroundColor: '#F8DDE3',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 9,
    zIndex: 10,
  },

  cardPressed: {
    opacity: 0.85,
  },

  infoTooltip: {
    position: 'absolute',
    bottom: '110%',
    width: 270,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7D9EE',
    shadowColor: '#493653',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 20,
  },

  studyTooltip: {
    left: '50%',
    transform: [{ translateX: -135 }],
  },

  readingTooltip: {
    left: '50%',
    transform: [{ translateX: -135 }],
  },

  tooltipTitle: {
    color: '#493653',
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
    marginBottom: 9,
  },

  tooltipText: {
    color: '#806B87',
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 18,
    textAlign: 'center',
  },

  tooltipFooter: {
    color: '#9B719F',
    fontSize: 11,
    fontFamily: 'Nunito_800ExtraBold',
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
  },

  illustrationCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  smallIllustration: {
    position: 'absolute',
    right: -3,
    bottom: 0,
  },

  cardTitle: {
    color: '#493653',
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 7,
  },

  cardDescription: {
    color: '#806B87',
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 19,
    textAlign: 'center',
    minHeight: 38,
  },

  cardTag: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 11,
  },

  cardTagText: {
    color: '#806B87',
    fontSize: 11,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },

  bottomSection: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    transform: [{ translateY: -115 }],
    position: 'relative',
    zIndex: 100,
    elevation: 100,
  },

  bottomTitle: {
    color: '#493653',
    fontSize: 14,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 13,
  },

  button: {
    width: '30%',
    minHeight: 90,
    backgroundColor: '#493653',
    borderRadius: 20,
    paddingVertical: 25,
    paddingHorizontal: 21,
    alignItems: 'stretch',
    justifyContent: 'center',
    shadowColor: '#493653',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 101,
    position: 'relative',
    zIndex: 101,
  },

  buttonContent: {
    width: '100%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  buttonHovered: {
    backgroundColor: '#765B85',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 109,
  },

  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  buttonSmall: {
    color: '#DCCBE8',
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2,
    marginBottom: 4,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Nunito_800ExtraBold',
  },

  footer: {
    color: '#927BA0',
    fontSize: 10,
    fontFamily: 'Nunito_400Regular',
    marginTop: 15,
    letterSpacing: 0.5,
  },
});