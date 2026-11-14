import { router } from "expo-router";
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
    View,
} from "react-native";

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

type Quest = {
  id: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  category: string;
  icon: typeof BookOpen;
  color: string;
  iconColor: string;
};

const dailyQuests: Quest[] = [
  {
    id: "read",
    title: "A little reading",
    description: "Read for 20 minutes today.",
    reward: 15,
    progress: 0,
    target: 20,
    category: "READING",
    icon: BookOpen,
    color: COLORS.lightPink,
    iconColor: COLORS.darkPink,
  },
  {
    id: "book",
    title: "New beginnings",
    description: "Add a new book to your collection.",
    reward: 10,
    progress: 0,
    target: 1,
    category: "COLLECTION",
    icon: LibraryBig,
    color: COLORS.lavender,
    iconColor: COLORS.purple,
  },
  {
    id: "review",
    title: "Share your thoughts",
    description: "Write a review for a book.",
    reward: 20,
    progress: 0,
    target: 1,
    category: "COMMUNITY",
    icon: PenLine,
    color: COLORS.peach,
    iconColor: "#A77C6C",
  },
];

const weeklyQuests: Quest[] = [
  {
    id: "consistency",
    title: "Consistency is key",
    description: "Read on 5 different days this week.",
    reward: 60,
    progress: 0,
    target: 5,
    category: "CONSISTENCY",
    icon: CalendarCheck,
    color: COLORS.sage,
    iconColor: "#71866F",
  },
  {
    id: "finish",
    title: "The final chapter",
    description: "Finish reading a book this week.",
    reward: 100,
    progress: 0,
    target: 1,
    category: "ACHIEVEMENT",
    icon: Trophy,
    color: COLORS.peach,
    iconColor: "#A77C6C",
  },
  {
    id: "study",
    title: "Curious minds",
    description: "Complete 3 study sessions this week.",
    reward: 45,
    progress: 0,
    target: 3,
    category: "LEARNING",
    icon: GraduationCap,
    color: COLORS.lavender,
    iconColor: COLORS.purple,
  },
];

function QuestCard({ quest }: { quest: Quest }) {
  const Icon = quest.icon;
  const progress = Math.min(quest.progress / quest.target, 1);
  const completed = quest.progress >= quest.target;

  return (
    <View style={styles.questCard}>
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

      <View style={styles.progressSection}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>YOUR PROGRESS</Text>
          <Text style={styles.progressValue}>
            {quest.progress}/{quest.target}
          </Text>
        </View>

        <View style={styles.progressTrack}>
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

      <View style={styles.questFooter}>
        <View style={styles.questStatus}>
          {completed ? (
            <Check size={14} color="#71866F" />
          ) : (
            <Clock3 size={14} color={COLORS.muted} />
          )}
          <Text style={[styles.statusText, completed && { color: "#71866F" }]}>
            {completed ? "Completed" : "In progress"}
          </Text>
        </View>

        <Text style={styles.rewardCaption}>
          {completed ? "Reward ready" : "Keep going!"}
        </Text>
      </View>
    </View>
  );
}

export default function QuestsScreen() {
  const { balance, loading: walletLoading } = usePawWallet();
  const displayedBalance = walletLoading ? "..." : (balance ?? "—");

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
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
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
        <View style={styles.heroCard}>
          <View style={styles.heroText}>
            <Text style={styles.heroEyebrow}>A LITTLE CHALLENGE</Text>
            <Text style={styles.heroTitle}>
              Every chapter{"\n"}is an adventure.
            </Text>
            <Text style={styles.heroDescription}>
              Complete quests, build good habits and earn Paw Tokens along the
              way.
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
            <Text style={styles.summaryLabel}>PAW available</Text>
          </View>
        </View>

        <View style={styles.questList}>
          {dailyQuests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} />
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
            <Text style={styles.summaryLabel}>PAW available</Text>
          </View>
        </View>

        <View style={styles.questList}>
          {weeklyQuests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} />
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
              Paw Tokens will be earned and verified through Solana. Complete
              your activities and watch your collection grow.
            </Text>
          </View>
        </View>

        {/* SHOP LINK */}
        <Pressable
          style={({ pressed }) => [styles.shopLink, pressed && styles.pressed]}
          onPress={() => router.push("/shop")}
        >
          <Text style={styles.shopLinkText}>Explore Laica's Shop</Text>
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
