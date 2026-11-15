
import { router } from 'expo-router';
import {
    ArrowLeft,
    BookMarked,
    BookOpen,
    ChevronRight,
    Clock3,
    GraduationCap,
    LibraryBig,
    LogOut,
    Mail,
    PawPrint,
    ShieldCheck,
    Sparkles,
    Star,
    UserRound,
    UsersRound,
} from 'lucide-react-native';
import { useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View
} from 'react-native';
import { useAuth0 } from 'react-native-auth0';

import { Notice, SoonBadge } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT } from '@/constants/palette';
import { useProgressStats } from '@/hooks/useProgressStats';
import { clearLoginTime, CUSTOM_SCHEME } from '@/lib/authSession';
import { confirmAction } from '@/lib/feedback';
import { goBack } from '@/lib/navigation';

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

function formatStat(value: number | undefined, loading: boolean) {
  if (loading && value === undefined) return '...';
  if (value === undefined) return '—';
  return value.toLocaleString();
}

export default function AccountScreen() {
  const { user, clearSession } = useAuth0();
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const { stats, loading: statsLoading, error: statsError, refresh } =
    useProgressStats();

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const displayName =
    user?.name || user?.nickname || 'Little reader';

  const handleLogout = async () => {
    if (loggingOut) return;

    const confirmed = await confirmAction({
      title: 'Log out?',
      message: "You'll return to the welcome page.",
      confirmText: 'Log out',
      destructive: true,
    });

    if (!confirmed) return;

    try {
      setLoggingOut(true);
      setLogoutError('');
      clearLoginTime();

      await clearSession(
        {},
        Platform.OS === 'web' ? undefined : { customScheme: CUSTOM_SCHEME }
      );

      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);

      if (Platform.OS === 'web') {
        router.replace('/');
      } else {
        setLogoutError("We couldn't log you out. Please try again.");
      }
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.container, isCompact && styles.containerCompact]}>
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
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={21} color={COLORS.text} />
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>My little corner</Text>
              <Text style={styles.headerSubtitle}>YOUR PERSONAL SPACE</Text>
            </View>

            <View style={styles.headerIcon}>
              <PawPrint size={21} color={COLORS.darkPink} />
            </View>
          </View>

          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={styles.profileTop}>
              <View style={styles.avatarCircle}>
                <UserRound
                  size={42}
                  color={COLORS.purple}
                  strokeWidth={1.5}
                />
                <View style={styles.avatarSparkle}>
                  <Sparkles size={15} color={COLORS.darkPink} />
                </View>
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.profileEyebrow}>HELLO AGAIN ♡</Text>
                <Text style={styles.profileName} numberOfLines={2}>
                  {displayName}
                </Text>
                <Text style={styles.profileEmail} numberOfLines={2}>
                  {user?.email || 'Your email will appear here'}
                </Text>
              </View>
            </View>

            <View style={styles.profileDivider} />

            <View style={styles.memberRow}>
              <View style={styles.memberIcon}>
                <PawPrint size={16} color={COLORS.darkPink} />
              </View>
              <Text style={styles.memberText}>
                A little part of the Paws & Pages community
              </Text>
              <Sparkles size={16} color={COLORS.purple} />
            </View>
          </View>

          {/* Reading journey */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeadingLeft}>
                <BookOpen size={20} color={COLORS.darkPink} />
                <Text style={styles.sectionTitle}>My reading journey</Text>
              </View>
              <Text style={styles.sectionLabel}>READ</Text>
            </View>

            {statsError ? (
              <Notice
                tone="error"
                message={statsError}
                actionLabel="Try again"
                onAction={refresh}
                style={styles.statsNotice}
              />
            ) : null}

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: COLORS.lightPink }]}>
                <BookMarked size={22} color={COLORS.darkPink} />
                <Text style={styles.statNumber}>
                  {formatStat(stats?.booksFinished, statsLoading)}
                </Text>
                <Text style={styles.statLabel}>Books finished</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.lavender }]}>
                <LibraryBig size={22} color={COLORS.purple} />
                <Text style={styles.statNumber}>
                  {formatStat(stats?.pagesRead, statsLoading)}
                </Text>
                <Text style={styles.statLabel}>Pages read</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.peach }]}>
                <Clock3 size={22} color="#B58A68" />
                <Text style={styles.statNumber}>
                  {formatStat(stats?.sessions.length, statsLoading)}
                </Text>
                <Text style={styles.statLabel}>Reading sessions</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.emptyCard, pressed && styles.pressed]}
              onPress={() => router.push('/reading')}
              accessibilityRole="button"
            >
              <View style={styles.emptyIcon}>
                <BookOpen size={22} color={COLORS.purple} />
              </View>
              <View style={styles.emptyTextContainer}>
                <Text style={styles.emptyTitle}>
                  {stats && stats.books.length > 0
                    ? `${stats.books.length} ${stats.books.length === 1 ? 'book' : 'books'} on your shelf`
                    : 'Your story is waiting'}
                </Text>
                <Text style={styles.emptyDescription}>
                  {stats && stats.books.length > 0
                    ? 'Open your reading corner to continue your journey.'
                    : 'Add your first book in the reading corner.'}
                </Text>
              </View>
              <ChevronRight size={17} color={COLORS.muted} />
            </Pressable>
          </View>

          {/* Study journey */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeadingLeft}>
                <GraduationCap size={21} color={COLORS.purple} />
                <Text style={styles.sectionTitle}>My study journey</Text>
              </View>
              <Text style={styles.sectionLabel}>LEARN</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: COLORS.lavender }]}>
                <LibraryBig size={22} color={COLORS.purple} />
                <Text style={styles.statNumber}>
                  {formatStat(stats?.studyMaterials, statsLoading)}
                </Text>
                <Text style={styles.statLabel}>Study materials</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: COLORS.peach }]}>
                <Star size={22} color="#B58A68" />
                <Text style={styles.statNumber}>
                  {formatStat(stats?.quizzes, statsLoading)}
                </Text>
                <Text style={styles.statLabel}>Quizzes created</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.emptyCard, pressed && styles.pressed]}
              onPress={() => router.push('/study')}
              accessibilityRole="button"
            >
              <View style={[styles.emptyIcon, { backgroundColor: COLORS.sage }]}>
                <GraduationCap size={23} color="#758B72" />
              </View>
              <View style={styles.emptyTextContainer}>
                <Text style={styles.emptyTitle}>Every lesson counts</Text>
                <Text style={styles.emptyDescription}>
                  {stats && stats.studyMaterials > 0
                    ? 'Open your learning space to review summaries and quizzes.'
                    : 'Upload your first course material to get a summary and a quiz.'}
                </Text>
              </View>
              <ChevronRight size={17} color={COLORS.muted} />
            </Pressable>
          </View>

          {/* Community */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeadingLeft}>
                <UsersRound size={21} color={COLORS.darkPink} />
                <Text style={styles.sectionTitle}>My community</Text>
              </View>
              <Text style={styles.sectionLabel}>CONNECT</Text>
            </View>

            <View style={styles.communityCard}>
              <View style={styles.communityIcon}>
                <UsersRound size={25} color={COLORS.darkPink} />
              </View>

              <View style={styles.communityInfo}>
                <Text style={styles.communityTitle}>Friends & connections</Text>
                <Text style={styles.communityDescription}>
                  Friends, shared books and community activity are not
                  available yet.
                </Text>
              </View>

              <SoonBadge />
            </View>
          </View>

          {/* Account information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeadingLeft}>
                <UserRound size={20} color={COLORS.purple} />
                <Text style={styles.sectionTitle}>Account information</Text>
              </View>
            </View>

            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <UserRound size={18} color={COLORS.purple} />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Full name</Text>
                  <Text style={styles.detailValue}>
                    {user?.name || 'Not available'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Mail size={18} color={COLORS.darkPink} />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Email address</Text>
                  <Text style={styles.detailValue}>
                    {user?.email || 'Not available'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <ShieldCheck size={18} color="#758B72" />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Authentication</Text>
                  <Text style={styles.detailValue}>
                    Protected by Auth0
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Logout */}
          <View style={styles.logoutSection}>
            {logoutError ? (
              <Notice
                tone="error"
                message={logoutError}
                onDismiss={() => setLogoutError('')}
                style={styles.logoutNotice}
              />
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.logoutButton,
                (pressed || loggingOut) && styles.pressed,
              ]}
              onPress={handleLogout}
              disabled={loggingOut}
              accessibilityRole="button"
              accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
            >
              {loggingOut ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <LogOut size={19} color={COLORS.white} />
              )}
              <Text style={styles.logoutText}>
                {loggingOut ? 'Logging out...' : 'Log out'}
              </Text>
            </Pressable>

            <Text style={styles.logoutDescription}>
              You’ll return to the welcome page.
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <PawPrint size={19} color={COLORS.darkPink} />
            <Text style={styles.footerText}>Paws & Pages</Text>
            <Text style={styles.footerHeart}>♡</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    width: '100%',
    maxWidth: 1050,
    alignSelf: 'center',
    paddingHorizontal: 35,
    paddingTop: 25,
    paddingBottom: 35,
    position: 'relative',
    overflow: 'hidden',
  },

  containerCompact: {
    paddingHorizontal: 18,
  },

  statsNotice: {
    marginBottom: 13,
  },

  logoutNotice: {
    width: '100%',
    maxWidth: 380,
    marginBottom: 12,
  },

  blobTop: {
    position: 'absolute',
    top: -130,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.pink,
    opacity: 0.4,
  },

  blobBottom: {
    position: 'absolute',
    bottom: 180,
    left: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#C8B5E5',
    opacity: 0.3,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
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

  headerCenter: {
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 25,
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  headerSubtitle: {
    fontSize: 9,
    color: COLORS.muted,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2,
    marginTop: 4,
  },

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.lightPink,
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 27,
    padding: 25,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#705B83',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },

  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 28,
    backgroundColor: COLORS.lavender,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  avatarSparkle: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.lightPink,
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileInfo: {
    flex: 1,
  },

  profileEyebrow: {
    color: COLORS.darkPink,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2,
    marginBottom: 5,
  },

  profileName: {
    color: COLORS.text,
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  profileEmail: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    marginTop: 5,
  },

  profileDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  memberIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.lightPink,
    justifyContent: 'center',
    alignItems: 'center',
  },

  memberText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_800ExtraBold',
  },

  section: {
    marginTop: 32,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  sectionHeadingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  sectionLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1.5,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 13,
  },

  statCard: {
    flex: 1,
    minWidth: 96,
    minHeight: 120,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },

  statNumber: {
    color: COLORS.text,
    fontSize: 23,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  statLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
  },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginTop: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.lavender,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyTextContainer: {
    flex: 1,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 4,
  },

  emptyDescription: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 17,
  },

  communityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  communityIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.lightPink,
    justifyContent: 'center',
    alignItems: 'center',
  },

  communityInfo: {
    flex: 1,
  },

  communityTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: 'Nunito_800ExtraBold',
  },

  communityDescription: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 17,
    marginTop: 4,
  },

  communityCount: {
    width: 35,
    height: 35,
    borderRadius: 12,
    backgroundColor: COLORS.lavender,
    justifyContent: 'center',
    alignItems: 'center',
  },

  communityCountText: {
    color: COLORS.purple,
    fontSize: 16,
    fontFamily: 'Nunito_800ExtraBold',
  },

  detailsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    paddingHorizontal: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 13,
  },

  detailIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: COLORS.lavender,
    justifyContent: 'center',
    alignItems: 'center',
  },

  detailInfo: {
    flex: 1,
  },

  detailLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: 'Nunito_400Regular',
    marginBottom: 3,
  },

  detailValue: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: 'Nunito_800ExtraBold',
  },

  detailDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  logoutSection: {
    marginTop: 35,
    alignItems: 'center',
  },

  logoutButton: {
    width: '100%',
    maxWidth: 380,
    minHeight: 56,
    backgroundColor: COLORS.text,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },

  logoutText: {
    color: COLORS.white,
    fontSize: 14,
    fontFamily: 'Nunito_800ExtraBold',
  },

  logoutDescription: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: 'Nunito_400Regular',
    marginTop: 10,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 35,
  },

  footerText: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },

  footerHeart: {
    color: COLORS.darkPink,
    fontSize: 17,
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
