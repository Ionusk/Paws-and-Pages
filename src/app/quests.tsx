import { router, type Href } from "expo-router";
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    CalendarCheck,
    Check,
    Clock3,
    Coins,
    GraduationCap,
    LibraryBig,
    Lock,
    PenLine,
    Sparkles,
    Trophy,
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

import { Notice } from "@/components/ui/feedback";
import { COMPACT_BREAKPOINT } from "@/constants/palette";
import { useProgressStats } from "@/hooks/useProgressStats";
import { goBack } from "@/lib/navigation";
import type { ReadingBook, ReadingSessionRecord } from "@/lib/readingApi";
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
  purple: "#9B829F",
  border: "#E7D9EE",
};

type QuestData = {
  books: ReadingBook[];
  sessions: ReadingSessionRecord[];
};

type Quest = {
  id: string;
  title: string;
  description: string;
  reward: number;
  target: number;
  unit: string;
  category: string;
  icon: typeof BookOpen;
  color: string;
  iconColor: string;
  /** Returns current progress, or null when it can't be tracked yet. */
  measure: ((data: QuestData) => number) | null;
  unavailableReason?: string;
  action?: { label: string; route: Href };
};

function isToday(iso: string | undefined) {
  if (!iso) return false;
  const date = new Date(iso);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

/** Monday 00:00 of the current week, in local time. */
function startOfWeek() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - day);
  return start;
}

const dailyQuests: Quest[] = [
  {
    id: "read",
    title: "A little reading",
    description: "Read for 20 minutes today.",
    reward: 15,
    target: 20,
    unit: "min",
    category: "READING",
    icon: BookOpen,
    color: COLORS.lightPink,
    iconColor: COLORS.darkPink,
    measure: ({ sessions }) =>
      Math.floor(
        sessions
          .filter((session) => isToday(session.date))
          .reduce((total, session) => total + session.durationSeconds, 0) / 60,
      ),
    action: { label: "Start a reading session", route: "/reading/session" },
  },
  {
    id: "book",
    title: "New beginnings",
    description: "Add a new book to your collection today.",
    reward: 10,
    target: 1,
    unit: "book",
    category: "COLLECTION",
    icon: LibraryBig,
    color: COLORS.lavender,
    iconColor: COLORS.purple,
    measure: ({ books }) => books.filter((book) => isToday(book.createdAt)).length,
    action: { label: "Add a book", route: "/reading/add-book" },
  },
  {
    id: "review",
    title: "Share your thoughts",
    description: "Write a review for a book.",
    reward: 20,
    target: 1,
    unit: "review",
    category: "COMMUNITY",
    icon: PenLine,
    color: COLORS.peach,
    iconColor: "#A77C6C",
    measure: null,
    unavailableReason: "Book reviews can't be saved yet.",
  },
];

const weeklyQuests: Quest[] = [
  {
    id: "consistency",
    title: "Consistency is key",
    description: "Read on 5 different days this week.",
    reward: 60,
    target: 5,
    unit: "days",
    category: "CONSISTENCY",
    icon: CalendarCheck,
    color: COLORS.sage,
    iconColor: "#71866F",
    measure: ({ sessions }) => {
      const weekStart = startOfWeek().getTime();
      const days = new Set(
        sessions
          .filter((session) => new Date(session.date).getTime() >= weekStart)
          .map((session) => new Date(session.date).toDateString()),
      );
      return days.size;
    },
    action: { label: "Start a reading session", route: "/reading/session" },
  },
  {
    id: "finish",
    title: "The final chapter",
    description: "Finish reading a book this week.",
    reward: 100,
    target: 1,
    unit: "book",
    category: "ACHIEVEMENT",
    icon: Trophy,
    color: COLORS.peach,
    iconColor: "#A77C6C",
    measure: null,
    unavailableReason:
      "Updating your current page isn't possible yet, so finished books can't be tracked.",
  },
  {
    id: "study",
    title: "Curious minds",
    description: "Complete 3 study sessions this week.",
    reward: 45,
    target: 3,
    unit: "sessions",
    category: "LEARNING",
    icon: GraduationCap,
    color: COLORS.lavender,
    iconColor: COLORS.purple,
    measure: null,
    unavailableReason: "Study sessions aren't tracked by date yet.",
  },
];

function QuestCard({
  quest,
  data,
  loading,
}: {
  quest: Quest;
  data: QuestData | null;
  loading: boolean;
}) {
  const Icon = quest.icon;
  const unavailable = quest.measure === null;
  const value =
    !unavailable && data && quest.measure ? quest.measure(data) : null;
  const progress = value !== null ? Math.min(value / quest.target, 1) : 0;
  const completed = value !== null && value >= quest.target;

  const status = unavailable
    ? "Not available yet"
    : value === null
      ? loading
        ? "Checking..."
        : "Progress unavailable"
      : completed
        ? "Completed"
        : value > 0
          ? "In progress"
          : "Not started";

  return (
    <View style={[styles.questCard, unavailable && styles.questCardUnavailable]}>
      <View style={styles.questTop}>
        <View style={[styles.questIcon, { backgroundColor: quest.color }]}>
          <Icon size={23} color={quest.iconColor} strokeWidth={1.7} />
        </View>

        <View style={styles.questReward}>
          <Sparkles size={13} color={COLORS.darkPink} />
          <Text style={styles.rewardText}>+{quest.reward} PAW</Text>
        </View>
      </View>

      <View style={styles.questInfo}>
        <Text style={styles.questCategory}>{quest.category}</Text>
        <Text style={styles.questTitle}>{quest.title}</Text>
        <Text style={styles.questDescription}>{quest.description}</Text>
      </View>

      {unavailable ? (
        <View style={styles.unavailableBox}>
          <Lock size={14} color={COLORS.muted} />
          <Text style={styles.unavailableText}>{quest.unavailableReason}</Text>
        </View>
      ) : (
        <View style={styles.progressSection}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>YOUR PROGRESS</Text>
            <Text style={styles.progressValue}>
              {value === null ? "—" : Math.min(value, quest.target)}/
              {quest.target} {quest.unit}
            </Text>
          </View>

          <View
            style={styles.progressTrack}
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: quest.target,
              now: value === null ? 0 : Math.min(value, quest.target),
            }}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: completed ? "#8BA486" : COLORS.darkPink,
                },
              ]}
            />
          </View>
        </View>
      )}

      <View style={styles.questFooter}>
        <View style={styles.questStatus}>
          {completed ? (
            <Check size={14} color="#71866F" />
          ) : unavailable ? (
            <Lock size={14} color={COLORS.muted} />
          ) : (
            <Clock3 size={14} color={COLORS.muted} />
          )}
          <Text style={[styles.statusText, completed && { color: "#71866F" }]}>
            {status}
          </Text>
        </View>

        {completed ? (
          <Text style={styles.rewardCaption}>Reward payouts coming soon</Text>
        ) : !unavailable && quest.action ? (
          <Pressable
            onPress={() => router.push(quest.action!.route)}
            style={({ pressed }) => [styles.questAction, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.questActionText}>{quest.action.label}</Text>
            <ArrowRight size={14} color={COLORS.text} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function QuestsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const { balance, loading: walletLoading } = usePawWallet();
  const displayedBalance = walletLoading ? "..." : (balance ?? "—");

  const { stats, loading: statsLoading, error: statsError, refresh } =
    useProgressStats();
  const questData: QuestData | null = stats
    ? { books: stats.books, sessions: stats.sessions }
    : null;

  const totalDailyRewards = dailyQuests.reduce(
    (total, quest) => total + quest.reward,
    0,
  );

  const totalWeeklyRewards = weeklyQuests.reduce(
    (total, quest) => total + quest.reward,
    0,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          isCompact && styles.contentCompact,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => goBack("/home")}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={21} color={COLORS.text} strokeWidth={1.8} />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Your Quests</Text>
            <Text style={styles.headerSubtitle}>
              LITTLE STEPS, LOVELY REWARDS
            </Text>
          </View>

          <View style={styles.tokenBalance}>
            <Coins size={16} color={COLORS.darkPink} strokeWidth={1.8} />
            <Text style={styles.tokenText}>{displayedBalance} PAW</Text>
          </View>
        </View>

        {/* HERO */}
        <View style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
          <View style={styles.heroText}>
            <Text style={styles.heroEyebrow}>A LITTLE CHALLENGE</Text>
            <Text style={styles.heroTitle}>
              Every chapter{"\n"}is an adventure.
            </Text>
            <Text style={styles.heroDescription}>
              Complete quests and build good reading habits. Progress updates
              from your real reading sessions and books.
            </Text>
          </View>

          <View style={styles.heroDecoration}>
            <Trophy size={48} color={COLORS.darkPink} strokeWidth={1.35} />
            <View style={styles.heroSparkle}>
              <Sparkles size={19} color={COLORS.purple} />
            </View>
          </View>
        </View>

        {/* DAILY SECTION */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Clock3 size={19} color={COLORS.darkPink} />
          </View>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Daily quests</Text>
            <Text style={styles.sectionSubtitle}>
              Small goals for a lovely day.
            </Text>
          </View>
          <View style={styles.rewardSummary}>
            <Text style={styles.summaryNumber}>{totalDailyRewards}</Text>
            <Text style={styles.summaryLabel}>PAW in rewards</Text>
          </View>
        </View>

        {statsError ? (
          <Notice
            tone="error"
            message={`We couldn't load your quest progress. ${statsError}`}
            actionLabel="Try again"
            onAction={refresh}
            style={styles.statsNotice}
          />
        ) : null}

        <View style={styles.questList}>
          {dailyQuests.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              data={questData}
              loading={statsLoading}
            />
          ))}
        </View>

        {/* WEEKLY SECTION */}
        <View style={styles.sectionHeader}>
          <View
            style={[styles.sectionIcon, { backgroundColor: COLORS.lavender }]}
          >
            <CalendarCheck size={19} color={COLORS.purple} />
          </View>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Weekly challenges</Text>
            <Text style={styles.sectionSubtitle}>
              Bigger goals, bigger rewards.
            </Text>
          </View>
          <View style={styles.rewardSummary}>
            <Text style={styles.summaryNumber}>{totalWeeklyRewards}</Text>
            <Text style={styles.summaryLabel}>PAW in rewards</Text>
          </View>
        </View>

        <View style={styles.questList}>
          {weeklyQuests.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              data={questData}
              loading={statsLoading}
            />
          ))}
        </View>

        {/* BOTTOM NOTE */}
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Sparkles size={20} color={COLORS.darkPink} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Your effort deserves a reward.</Text>
            <Text style={styles.infoDescription}>
              Quest rewards aren’t paid out yet: completing a quest doesn’t add
              PAW to your wallet for now. When payouts arrive, they’ll be sent
              and verified on Solana.
            </Text>
          </View>
        </View>

        {/* SHOP LINK */}
        <Pressable
          style={({ pressed }) => [styles.shopLink, pressed && styles.pressed]}
          onPress={() => router.push("/shop")}
        >
          <Text style={styles.shopLinkText}>Explore Laica’s Shop</Text>
          <ArrowRight size={18} color={COLORS.text} />
        </Pressable>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>MADE WITH LOVE AND PAW PRINTS</Text>
          <Sparkles size={13} color={COLORS.darkPink} />
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
    paddingBottom: 40,
    maxWidth: 1250,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
    gap: 15,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 25,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 8,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: 1.7,
    color: COLORS.muted,
    marginTop: 4,
  },
  tokenBalance: {
    height: 43,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tokenText: {
    fontSize: 12,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
  },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: 27,
    padding: 30,
    minHeight: 205,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 35,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 13,
    elevation: 3,
  },
  heroText: {
    flex: 1,
    paddingRight: 15,
  },
  heroEyebrow: {
    fontSize: 9,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: 2,
    color: COLORS.darkPink,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 29,
    lineHeight: 36,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
  },
  heroDescription: {
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Nunito_400Regular",
    color: COLORS.muted,
    marginTop: 10,
    maxWidth: 390,
  },
  heroDecoration: {
    width: 112,
    height: 112,
    borderRadius: 38,
    backgroundColor: COLORS.lightPink,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "-7deg" }],
  },
  heroSparkle: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
    gap: 12,
  },
  sectionIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: COLORS.lightPink,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeading: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 21,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontFamily: "Nunito_400Regular",
    color: COLORS.muted,
    marginTop: 3,
  },
  rewardSummary: {
    alignItems: "flex-end",
  },
  summaryNumber: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.darkPink,
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: "Nunito_700Bold",
    color: COLORS.muted,
  },
  questList: {
    gap: 13,
    marginBottom: 35,
  },
  contentCompact: {
    paddingHorizontal: 18,
  },
  heroCardCompact: {
    padding: 22,
    minHeight: 0,
  },
  statsNotice: {
    marginBottom: 13,
  },
  questCardUnavailable: {
    backgroundColor: "#FBF8FC",
  },
  unavailableBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3EEF5",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unavailableText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Nunito_600SemiBold",
    color: COLORS.muted,
  },
  questAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.lightPink,
  },
  questActionText: {
    fontSize: 11,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
  },
  questCard: {
    backgroundColor: COLORS.white,
    borderRadius: 21,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 9,
    elevation: 2,
  },
  questTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  questIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  questReward: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.lightPink,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
  },
  rewardText: {
    fontSize: 11,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
  },
  questInfo: {
    marginBottom: 17,
  },
  questCategory: {
    fontSize: 8,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: 1.5,
    color: COLORS.darkPink,
    marginBottom: 5,
  },
  questTitle: {
    fontSize: 19,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  questDescription: {
    fontSize: 11,
    lineHeight: 17,
    fontFamily: "Nunito_400Regular",
    color: COLORS.muted,
  },
  progressSection: {
    gap: 8,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 8,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: 1.2,
    color: COLORS.muted,
  },
  progressValue: {
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
  },
  progressTrack: {
    height: 7,
    backgroundColor: "#F0EAF2",
    borderRadius: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 10,
  },
  questFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 13,
  },
  questStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Nunito_700Bold",
    color: COLORS.muted,
  },
  rewardCaption: {
    fontSize: 10,
    fontFamily: "Nunito_700Bold",
    color: COLORS.darkPink,
  },
  infoCard: {
    backgroundColor: COLORS.lavender,
    borderRadius: 21,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    alignItems: "center",
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontFamily: "PlayfairDisplay_700Bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 10,
    lineHeight: 16,
    fontFamily: "Nunito_400Regular",
    color: COLORS.muted,
  },
  shopLink: {
    minHeight: 52,
    backgroundColor: COLORS.pink,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E8B7C5",
    paddingHorizontal: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  shopLinkText: {
    fontSize: 12,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.text,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
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
