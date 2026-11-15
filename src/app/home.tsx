import { router } from "expo-router";
import {
    ArrowRight,
    ArrowUpRight,
    BookOpen,
    ClipboardList,
    Coins,
    Dog,
    GraduationCap,
    Heart,
    LibraryBig,
    NotebookPen,
    PawPrint,
    ShoppingBag,
    Sparkles,
    UserRound,
    UsersRound,
} from "lucide-react-native";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useAuth0 } from "react-native-auth0";

import { SoonBadge } from "@/components/ui/feedback";
import { COMPACT_BREAKPOINT } from "@/constants/palette";
import { useProgressStats } from "@/hooks/useProgressStats";
import { AnimatedMascot } from "../components/AnimatedMascot";
import { usePawWallet } from "../hooks/usePawWallet";

const COLORS = {
  background: "#E9DDF2",
  pink: "#F6C8D4",
  darkPink: "#B77D88",
  text: "#493653",
  muted: "#806B87",
  white: "#FFFFFF",
  sage: "#DCE6D8",
  lavender: "#F5ECFA",
  peach: "#F7E1D5",
  lightPink: "#FFF0F2",
  quote: "#F3E9F2",
  purple: "#9B829F",
};

function formatStat(value: number | undefined, loading: boolean) {
  if (loading && value === undefined) return "...";
  if (value === undefined) return "—";
  return value.toLocaleString();
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const isMedium = width < 900;

  const { user } = useAuth0();
  const {
    balance,
    loading: walletLoading,
    error: walletError,
  } = usePawWallet();
  const { stats, loading: statsLoading } = useProgressStats();

  // Auth0 often uses the email as "name"; prefer a real name when there is one.
  const rawName =
    user?.name && !user.name.includes("@") ? user.name : user?.nickname;
  const firstName = (rawName || "").split(" ")[0];

  const balanceText = walletLoading
    ? "..."
    : balance !== null
      ? balance
      : "—";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          isMedium && styles.contentMedium,
          isCompact && styles.contentCompact,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={[styles.header, isCompact && styles.headerCompact]}>
          <View>
            <View style={styles.logoRow}>
              <Text style={styles.logo}>paws & pages</Text>
              <PawPrint size={21} color={COLORS.darkPink} strokeWidth={1.8} />
            </View>
            <Text style={styles.headerSubtitle}>YOUR LITTLE HAPPY PLACE</Text>
          </View>

          <View
            style={[
              styles.headerActions,
              isCompact && styles.headerActionsCompact,
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.questsButton,
                isCompact && styles.iconOnlyButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/quests")}
              accessibilityRole="button"
              accessibilityLabel="Quests"
            >
              <ClipboardList
                size={19}
                color={COLORS.purple}
                strokeWidth={1.8}
              />
              {!isCompact && (
                <Text style={styles.questsButtonText}>Quests</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.shopButton,
                isCompact && styles.iconOnlyButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/shop")}
              accessibilityRole="button"
              accessibilityLabel="Laica's Shop"
            >
              <ShoppingBag
                size={19}
                color={COLORS.darkPink}
                strokeWidth={1.8}
              />
              {!isCompact && <Text style={styles.shopButtonText}>Shop</Text>}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.pawBalanceButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/shop")}
              accessibilityRole="button"
              accessibilityLabel={
                walletError
                  ? "PAW balance unavailable. Open the shop for details."
                  : `PAW balance: ${balanceText}. Open the shop.`
              }
            >
              <Coins size={19} color={COLORS.darkPink} strokeWidth={1.8} />

              <Text style={styles.pawBalanceText}>{balanceText}</Text>

              <Text style={styles.pawBalanceLabel}>PAW</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.avatarButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/account")}
              accessibilityRole="button"
              accessibilityLabel="My account"
            >
              <UserRound size={25} color={COLORS.darkPink} strokeWidth={1.7} />
            </Pressable>
          </View>
        </View>

        {/* WELCOME + LAICA */}
        <View
          style={[
            styles.welcomeWrapper,
            isCompact && styles.welcomeWrapperCompact,
          ]}
        >
          <View
            style={[
              styles.welcomeMascot,
              isCompact && styles.welcomeMascotCompact,
            ]}
          >
            <AnimatedMascot animation="sleepy" size={isCompact ? 230 : 300} />
          </View>

          <View
            style={[
              styles.welcomeSection,
              isCompact && styles.welcomeSectionCompact,
            ]}
          >
            <View style={styles.welcomeTextContainer}>
              <Text style={styles.eyebrow}>A NEW DAY, A NEW CHAPTER</Text>
              <Text
                style={[
                  styles.welcomeTitle,
                  isCompact && styles.welcomeTitleCompact,
                ]}
              >
                {firstName ? `Welcome back,\n${firstName}!` : "Welcome to your\nlittle world!"}
              </Text>
              <Text style={styles.welcomeDescription}>
                Pick up a book, open your study space or check today’s quests.
              </Text>
            </View>

            <View
              style={[
                styles.welcomeDecoration,
                isCompact && styles.welcomeDecorationCompact,
              ]}
            >
              <Dog
                size={isCompact ? 48 : 76}
                color={COLORS.darkPink}
                strokeWidth={1.3}
              />
              <View style={styles.sparkleOne}>
                <Sparkles size={20} color={COLORS.darkPink} strokeWidth={1.5} />
              </View>
              <View style={styles.sparkleTwo}>
                <Heart size={19} color={COLORS.darkPink} strokeWidth={1.5} />
              </View>
            </View>
          </View>
        </View>

        {/* MAIN SECTION */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your little world</Text>
            <Text style={styles.sectionSubtitle}>
              Where would you like to go today?
            </Text>
          </View>
          <Sparkles size={25} color={COLORS.darkPink} strokeWidth={1.5} />
        </View>

        {/* STUDY + READING */}
        <View style={[styles.mainGrid, isCompact && styles.gridCompact]}>
          <Pressable
            style={({ pressed }) => [
              styles.mainCard,
              isCompact && styles.cardCompact,
              styles.studyCard,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/study")}
            accessibilityRole="button"
            accessibilityLabel="Study. Learn smarter with your AI study buddy."
          >
            <View style={styles.cardTop}>
              <View style={styles.iconCircle}>
                <GraduationCap
                  size={25}
                  color={COLORS.purple}
                  strokeWidth={1.7}
                />
              </View>
              <ArrowUpRight size={22} color={COLORS.muted} strokeWidth={1.6} />
            </View>

            <View>
              <Text style={styles.cardTitle}>Study</Text>
              <Text style={styles.cardDescription}>
                Learn smarter with your AI study buddy.
              </Text>
            </View>

            <View style={styles.cardBottom}>
              <Text style={styles.cardLink}>START LEARNING</Text>
              <ArrowRight size={17} color={COLORS.text} strokeWidth={1.7} />
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.mainCard,
              isCompact && styles.cardCompact,
              styles.readingCard,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/reading")}
            accessibilityRole="button"
            accessibilityLabel="Reading. Keep track of books and your reading journey."
          >
            <View style={styles.cardTop}>
              <View style={styles.iconCircle}>
                <BookOpen size={24} color={COLORS.darkPink} strokeWidth={1.7} />
              </View>
              <ArrowUpRight size={22} color={COLORS.muted} strokeWidth={1.6} />
            </View>

            <View>
              <Text style={styles.cardTitle}>Reading</Text>
              <Text style={styles.cardDescription}>
                Keep track of books and your reading journey.
              </Text>
            </View>

            <View style={styles.cardBottom}>
              <Text style={styles.cardLink}>EXPLORE BOOKS</Text>
              <ArrowRight size={17} color={COLORS.text} strokeWidth={1.7} />
            </View>
          </Pressable>
        </View>

        {/* COMMUNITY */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your community</Text>
            <Text style={styles.sectionSubtitle}>
              Little things are better together.
            </Text>
          </View>
          <Heart size={25} color={COLORS.darkPink} strokeWidth={1.5} />
        </View>

        <View style={[styles.secondaryGrid, isCompact && styles.gridCompact]}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryCard,
              isCompact && styles.cardCompact,
              styles.friendsCard,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/friends")}
            accessibilityRole="button"
            accessibilityLabel="Friends. Coming soon."
          >
            <View style={styles.secondaryCardTop}>
              <View style={styles.secondaryIcon}>
                <UsersRound size={25} color="#71866F" strokeWidth={1.7} />
              </View>
              <SoonBadge />
            </View>

            <View>
              <Text style={styles.secondaryTitle}>Friends</Text>
              <Text style={styles.secondaryDescription}>
                Share your journey.
              </Text>
            </View>

            <View style={styles.secondaryCardBottom}>
              <Text style={styles.secondaryLink}>SEE WHAT’S PLANNED</Text>
              <ArrowRight size={17} color={COLORS.text} strokeWidth={1.7} />
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryCard,
              isCompact && styles.cardCompact,
              styles.campusCard,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/campus")}
            accessibilityRole="button"
            accessibilityLabel="Campus Books. Coming soon for verified UPT students."
          >
            <View style={styles.secondaryCardTop}>
              <View style={styles.secondaryIcon}>
                <LibraryBig size={25} color="#A77C6C" strokeWidth={1.7} />
              </View>
              <SoonBadge />
            </View>

            <View>
              <Text style={styles.secondaryTitle}>Campus Books</Text>
              <Text style={styles.secondaryDescription}>
                Discover and exchange.
              </Text>
            </View>

            <View style={styles.secondaryCardBottom}>
              <Text style={styles.secondaryLink}>SEE WHAT’S PLANNED</Text>
              <ArrowRight size={17} color={COLORS.text} strokeWidth={1.7} />
            </View>
          </Pressable>
        </View>

        {/* PROGRESS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your progress</Text>
            <Text style={styles.sectionSubtitle}>
              Every little step matters.
            </Text>
          </View>
          <Sparkles size={25} color={COLORS.darkPink} strokeWidth={1.5} />
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View
              style={[styles.statIcon, { backgroundColor: COLORS.lightPink }]}
            >
              <BookOpen size={19} color={COLORS.darkPink} strokeWidth={1.7} />
            </View>
            <Text style={styles.statNumber}>
              {formatStat(stats?.booksFinished, statsLoading)}
            </Text>
            <Text style={styles.statLabel}>Books finished</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <View
              style={[styles.statIcon, { backgroundColor: COLORS.lavender }]}
            >
              <NotebookPen size={19} color={COLORS.purple} strokeWidth={1.7} />
            </View>
            <Text style={styles.statNumber}>
              {formatStat(stats?.studyMaterials, statsLoading)}
            </Text>
            <Text style={styles.statLabel}>Study materials</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: COLORS.sage }]}>
              <Heart size={19} color="#71866F" strokeWidth={1.7} />
            </View>
            <Text style={styles.statNumber}>
              {formatStat(stats?.quizzes, statsLoading)}
            </Text>
            <Text style={styles.statLabel}>Quizzes</Text>
          </View>
        </View>

        {/* QUOTE */}
        <View style={styles.quoteCard}>
          <Text style={styles.quoteDecoration}>“</Text>
          <View style={styles.quoteContent}>
            <Text style={styles.quoteText}>
              Little by little, one travels far.
            </Text>
            <Text style={styles.quoteAuthor}>— J. R. R. Tolkien</Text>
          </View>
          <PawPrint size={24} color={COLORS.darkPink} strokeWidth={1.5} />
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>MADE WITH LOVE AND PAW PRINTS</Text>
          <Heart size={13} color={COLORS.darkPink} strokeWidth={1.6} />
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

  container: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 55,
    paddingTop: 22,
    paddingBottom: 35,
    maxWidth: 1250,
    width: "100%",
    alignSelf: "center",
  },

  contentMedium: {
    paddingHorizontal: 30,
  },

  contentCompact: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 35,
    gap: 12,
  },

  headerCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    marginBottom: 20,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  headerActionsCompact: {
    alignSelf: "stretch",
    justifyContent: "space-between",
    gap: 8,
  },

  iconOnlyButton: {
    width: 49,
    paddingHorizontal: 0,
  },

  // On phones Laica sits in the normal layout flow above the welcome card
  // (same overlap as desktop) instead of being absolutely positioned.
  welcomeWrapperCompact: {
    marginTop: 0,
  },

  welcomeMascotCompact: {
    position: "relative",
    top: 0,
    marginBottom: -20,
  },

  welcomeSectionCompact: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },

  welcomeTitleCompact: {
    fontSize: 25,
    lineHeight: 32,
  },

  welcomeDecorationCompact: {
    width: 84,
    height: 80,
    borderRadius: 30,
  },

  gridCompact: {
    flexDirection: "column",
  },

  cardCompact: {
    flex: 0,
    minHeight: 170,
  },

  questsButton: {
    height: 49,
    paddingHorizontal: 17,
    borderRadius: 18,
    backgroundColor: COLORS.lavender,
    borderWidth: 1,
    borderColor: "#E7D9EE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  questsButtonText: {
    fontSize: 13,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
  },

  shopButton: {
    height: 49,
    paddingHorizontal: 17,
    borderRadius: 18,
    backgroundColor: COLORS.pink,
    borderWidth: 1,
    borderColor: "#E8B7C5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  shopButtonText: {
    fontSize: 13,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
  },

  pawBalanceButton: {
    height: 49,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#E7D9EE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  pawBalanceText: {
    fontSize: 15,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
  },

  pawBalanceLabel: {
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.darkPink,
    letterSpacing: 0.5,
  },

  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  logo: {
    fontSize: 25,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
    letterSpacing: 1,
  },

  headerSubtitle: {
    fontSize: 9,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: 2.5,
    color: COLORS.muted,
    marginTop: 5,
  },

  avatarButton: {
    width: 49,
    height: 49,
    borderRadius: 18,
    backgroundColor: "#F5ECFA",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E7D9EE",
  },

  welcomeWrapper: {
    position: "relative",
    marginTop: 105,
    marginBottom: 36,
  },

  welcomeMascot: {
    position: "absolute",
    top: -275,
    alignSelf: "center",
    zIndex: 10,
    elevation: 10,
  },

  welcomeSection: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E7D9EE",
    overflow: "hidden",
    shadowColor: "#493653",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    top: -70,
    elevation: 3,
  },

  welcomeTextContainer: {
    flex: 1,
    paddingRight: 15,
  },

  eyebrow: {
    fontSize: 9,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: 2,
    color: COLORS.darkPink,
    marginBottom: 13,
  },

  welcomeTitle: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
  },

  welcomeDescription: {
    fontSize: 13,
    lineHeight: 21,
    fontFamily: "Nunito_400Regular",
    color: COLORS.muted,
    marginTop: 12,
    maxWidth: 410,
  },

  welcomeDecoration: {
    width: 150,
    height: 130,
    backgroundColor: COLORS.peach,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "-5deg" }],
  },

  sparkleOne: {
    position: "absolute",
    top: 12,
    right: 18,
  },

  sparkleTwo: {
    position: "absolute",
    bottom: 15,
    left: 17,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 17,
    top: -75,
  },

  sectionTitle: {
    fontSize: 23,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
  },

  sectionSubtitle: {
    fontSize: 12,
    fontFamily: "Nunito_400Regular",
    color: COLORS.muted,
    marginTop: 5,
  },

  mainGrid: {
    flexDirection: "row",
    gap: 18,
    top: -75,
    marginBottom: 35,
  },

  mainCard: {
    flex: 1,
    minHeight: 215,
    borderRadius: 24,
    padding: 22,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#493653",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },

  studyCard: {
    backgroundColor: "#F5ECFA",
  },

  readingCard: {
    backgroundColor: "#FFF0F2",
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },

  iconCircle: {
    width: 47,
    height: 47,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },

  cardTitle: {
    fontSize: 25,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
    marginBottom: 7,
  },

  cardDescription: {
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Nunito_400Regular",
    color: COLORS.muted,
    maxWidth: 230,
  },

  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },

  cardLink: {
    fontSize: 9,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: 1.5,
    color: COLORS.text,
  },

  secondaryGrid: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 35,
    top: -75,
  },

  secondaryCard: {
    flex: 1,
    minHeight: 215,
    borderRadius: 24,
    padding: 22,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#493653",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },

  friendsCard: {
    backgroundColor: COLORS.sage,
  },

  campusCard: {
    backgroundColor: COLORS.peach,
  },

  secondaryCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },

  secondaryIcon: {
    width: 47,
    height: 47,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },

  secondaryTitle: {
    fontSize: 25,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
    marginBottom: 7,
  },

  secondaryDescription: {
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Nunito_400Regular",
    color: COLORS.muted,
  },

  secondaryCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },

  secondaryLink: {
    fontSize: 9,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: 1.5,
    color: COLORS.text,
  },

  statsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 23,
    paddingVertical: 22,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E7D9EE",
    marginBottom: 25,
  },

  statItem: {
    flex: 1,
    alignItems: "center",
  },

  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 9,
  },

  statNumber: {
    fontSize: 25,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
  },

  statLabel: {
    fontSize: 10,
    fontFamily: "Nunito_400Regular",
    color: COLORS.muted,
    marginTop: 4,
    textAlign: "center",
  },

  statDivider: {
    width: 1,
    height: 65,
    backgroundColor: "#E7D9EE",
  },

  quoteCard: {
    backgroundColor: COLORS.quote,
    borderRadius: 23,
    paddingVertical: 22,
    paddingHorizontal: 25,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 27,
    borderWidth: 1,
    borderColor: "#E7D9EE",
  },

  quoteDecoration: {
    fontSize: 57,
    lineHeight: 60,
    color: COLORS.darkPink,
    fontFamily: "PlayfairDisplay_700Bold",
    marginRight: 13,
  },

  quoteContent: {
    flex: 1,
  },

  quoteText: {
    fontSize: 15,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
  },

  quoteAuthor: {
    fontSize: 10,
    fontFamily: "Nunito_400Regular",
    color: COLORS.muted,
    marginTop: 7,
  },

  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
  },

  footerText: {
    fontSize: 8,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: 2,
    color: COLORS.muted,
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
