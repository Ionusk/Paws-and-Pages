
  import React, { useEffect, useState } from 'react';
  import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    useWindowDimensions,
  } from 'react-native';
import { goBack } from '@/lib/navigation';
  import {
    ArrowLeft,
    Pause,
    Play,
    Check,
    Timer,
    BookOpen,
  } from 'lucide-react-native';

  import { AnimatedMascot } from '../../components/AnimatedMascot';

  const COLORS = {
    background: '#E9DDF2',
    primary: '#C8B5E5',
    card: '#F5ECFA',
    white: '#FFFFFF',
    pink: '#FFF0F2',
    dark: '#493653',
    text: '#806B87',
    accent: '#927BA0',
    muted: '#A99AAF',
    border: '#DED0E8',
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
  };

  export default function ReadingSessionScreen() {
    const { width } = useWindowDimensions();
    const isWideLayout = width >= 760;

    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(true);
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
      if (!isRunning || isFinished) return;

      const interval = setInterval(() => {
        setElapsedSeconds((previous) => previous + 1);
      }, 1000);

      return () => clearInterval(interval);
    }, [isRunning, isFinished]);

    const handlePauseResume = () => {
      setIsRunning((previous) => !previous);
    };

    const handleFinish = () => {
      setIsRunning(false);
      setIsFinished(true);
    };

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* BACK BUTTON */}
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={() => goBack('/reading')}
            >
              <ArrowLeft size={19} color={COLORS.dark} />
              <Text style={styles.backButtonText}>
                BACK TO READING
              </Text>
            </TouchableOpacity>

            {/* HEADER */}
            <View style={styles.header}>
              <Text style={styles.eyebrow}>PAWS & PAGES</Text>

              <Text style={styles.title}>
                {isFinished ? 'Beautifully done!' : 'Your reading time'}
              </Text>

              <Text style={styles.subtitle}>
                {isFinished
                  ? 'You made time for yourself today.'
                  : 'Slow down, get cozy and enjoy your book.'}
              </Text>
            </View>

            {/* MAIN CONTENT: LAICA LEFT, TIMER RIGHT */}
            <View
              style={[
                styles.contentRow,
                !isWideLayout && styles.contentColumn,
              ]}
            >
              {/* LAICA VIDEO - LEFT */}
              <View
                style={[
                  styles.mascotCard,
                  isWideLayout
                    ? styles.wideCard
                    : styles.mobileCard,
                ]}
              >
                <View style={styles.videoContainer}>
                  <AnimatedMascot animation="original" />
                </View>

                <Text style={styles.mascotTitle}>
                  {isFinished
                    ? 'Laica is proud of you!'
                    : 'Laica is keeping you company'}
                </Text>

                <Text style={styles.mascotSubtitle}>
                  {isFinished
                    ? 'Every little reading moment counts.'
                    : 'A cozy little reading date, just for you.'}
                </Text>
              </View>

              {/* TIMER - RIGHT */}
              <View
                style={[
                  styles.timerCard,
                  isWideLayout
                    ? styles.wideCard
                    : styles.mobileCard,
                ]}
              >
                <View style={styles.timerIcon}>
                  <Timer
                    size={25}
                    color={COLORS.accent}
                    strokeWidth={1.7}
                  />
                </View>

                <Text style={styles.timerEyebrow}>
                  YOUR FOCUS TIME
                </Text>

                <Text style={styles.timerDisplay}>
                  {formatTime(elapsedSeconds)}
                </Text>

                <View style={styles.statusContainer}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: isFinished
                          ? COLORS.accent
                          : isRunning
                          ? '#8BAF91'
                          : COLORS.muted,
                      },
                    ]}
                  />

                  <Text style={styles.timerCaption}>
                    {isFinished
                      ? 'SESSION COMPLETED'
                      : isRunning
                      ? 'YOUR SESSION IS IN PROGRESS'
                      : 'SESSION PAUSED'}
                  </Text>
                </View>

                {!isFinished ? (
                  <View style={styles.buttons}>
                    <TouchableOpacity
                      style={[
                        styles.mainButton,
                        !isRunning && styles.resumeButton,
                      ]}
                      activeOpacity={0.85}
                      onPress={handlePauseResume}
                    >
                      {isRunning ? (
                        <Pause
                          size={18}
                          color={COLORS.dark}
                        />
                      ) : (
                        <Play
                          size={18}
                          color={COLORS.white}
                          fill={COLORS.white}
                        />
                      )}

                      <Text
                        style={[
                          styles.mainButtonText,
                          !isRunning && styles.resumeButtonText,
                        ]}
                      >
                        {isRunning ? 'PAUSE' : 'RESUME READING'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.finishButton}
                      activeOpacity={0.85}
                      onPress={handleFinish}
                    >
                      <Check
                        size={18}
                        color={COLORS.white}
                      />

                      <Text style={styles.finishButtonText}>
                        FINISH SESSION
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.finishedContainer}>
                    <Text style={styles.finishedTitle}>
                      You read for
                    </Text>

                    <Text style={styles.finishedTime}>
                      {formatTime(elapsedSeconds)}
                    </Text>

                    <TouchableOpacity
                      style={styles.backHomeButton}
                      activeOpacity={0.85}
                      onPress={() => goBack('/reading')}
                    >
                      <BookOpen
                        size={18}
                        color={COLORS.white}
                      />

                      <Text style={styles.backHomeButtonText}>
                        BACK TO MY READING
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* FOOTER */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                A LITTLE TIME FOR YOURSELF
              </Text>

              <Text style={styles.footerSubtext}>
                made with love, paws & pages
              </Text>
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
      maxWidth: 1100,
      alignSelf: 'center',
      paddingHorizontal: 30,
      paddingTop: 20,
      paddingBottom: 25,
    },

    backButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: COLORS.white,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 14,
    },

    backButtonText: {
      color: COLORS.dark,
      fontSize: 10,
      fontFamily: 'Nunito_800ExtraBold',
      letterSpacing: 1,
    },

    header: {
      alignItems: 'center',
      marginTop: 18,
      marginBottom: 20,
    },

    eyebrow: {
      color: COLORS.accent,
      fontSize: 10,
      fontFamily: 'Nunito_800ExtraBold',
      letterSpacing: 3,
      marginBottom: 8,
    },

    title: {
      color: COLORS.dark,
      fontSize: 32,
      fontFamily: 'PlayfairDisplay_700Bold',
      textAlign: 'center',
    },

    subtitle: {
      color: COLORS.text,
      fontSize: 13,
      fontFamily: 'Nunito_400Regular',
      textAlign: 'center',
      marginTop: 8,
    },

    contentRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 20,
    },

    contentColumn: {
      flexDirection: 'column',
    },

    wideCard: {
      flex: 1,
    },

    mobileCard: {
      width: '100%',
    },

    mascotCard: {
      backgroundColor: COLORS.white,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      shadowColor: COLORS.dark,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },

    videoContainer: {
      width: '100%',
      minHeight: 300,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: 20,
      backgroundColor: COLORS.card,
    },

    mascotTitle: {
      color: COLORS.dark,
      fontSize: 20,
      fontFamily: 'PlayfairDisplay_700Bold',
      textAlign: 'center',
      marginTop: 14,
    },

    mascotSubtitle: {
      color: COLORS.text,
      fontSize: 12,
      fontFamily: 'Nunito_400Regular',
      textAlign: 'center',
      marginTop: 5,
    },

    timerCard: {
      backgroundColor: COLORS.card,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 22,
      shadowColor: COLORS.dark,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    },

    timerIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },

    timerEyebrow: {
      color: COLORS.accent,
      fontSize: 10,
      fontFamily: 'Nunito_800ExtraBold',
      letterSpacing: 2,
      textAlign: 'center',
    },

    timerDisplay: {
      color: COLORS.dark,
      fontSize: 48,
      fontFamily: 'Nunito_800ExtraBold',
      letterSpacing: 1,
      marginTop: 8,
      fontVariant: ['tabular-nums'],
    },

    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 4,
      flexWrap: 'wrap',
    },

    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    timerCaption: {
      color: COLORS.text,
      fontSize: 9,
      fontFamily: 'Nunito_800ExtraBold',
      letterSpacing: 0.7,
      textAlign: 'center',
    },

    buttons: {
      width: '100%',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'stretch',
      gap: 12,
      marginTop: 27,
    },

    mainButton: {
      backgroundColor: COLORS.white,
      borderRadius: 15,
      paddingVertical: 15,
      paddingHorizontal: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },

    mainButtonText: {
      color: COLORS.dark,
      fontSize: 10,
      fontFamily: 'Nunito_800ExtraBold',
      letterSpacing: 1,
    },

    resumeButton: {
      backgroundColor: COLORS.dark,
    },

    resumeButtonText: {
      color: COLORS.white,
    },

    finishButton: {
      backgroundColor: COLORS.accent,
      borderRadius: 15,
      paddingVertical: 15,
      paddingHorizontal: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },

    finishButtonText: {
      color: COLORS.white,
      fontSize: 10,
      fontFamily: 'Nunito_800ExtraBold',
      letterSpacing: 1,
    },

    finishedContainer: {
      alignItems: 'center',
      marginTop: 25,
    },

    finishedTitle: {
      color: COLORS.text,
      fontSize: 13,
      fontFamily: 'Nunito_600SemiBold',
    },

    finishedTime: {
      color: COLORS.dark,
      fontSize: 28,
      fontFamily: 'Nunito_800ExtraBold',
      marginTop: 5,
    },

    backHomeButton: {
      backgroundColor: COLORS.dark,
      borderRadius: 15,
      paddingVertical: 15,
      paddingHorizontal: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginTop: 20,
    },

    backHomeButtonText: {
      color: COLORS.white,
      fontSize: 10,
      fontFamily: 'Nunito_800ExtraBold',
      letterSpacing: 1,
    },

    footer: {
      alignItems: 'center',
      marginTop: 18,
    },

    footerText: {
      color: COLORS.accent,
      fontSize: 9,
      fontFamily: 'Nunito_800ExtraBold',
      letterSpacing: 2,
    },

    footerSubtext: {
      color: COLORS.muted,
      fontSize: 10,
      fontFamily: 'Nunito_400Regular',
      marginTop: 6,
    },
  });
