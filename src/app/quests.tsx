import { router, useFocusEffect, type Href } from "expo-router";
import {
    ArrowLeft,
    ArrowRight,
    Award,
    BookOpen,
    BookPlus,
    CalendarCheck,
    Check,
    Clock3,
    Coins,
    FileText,
    GraduationCap,
    Handshake,
    Headphones,
    Layers,
    MessageCircleQuestionMark,
    Mic,
    PenLine,
    Shuffle,
    Sparkles,
    Star,
    Target,
    Timer,
    Trophy,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

import { Notice, StateCard } from "@/components/ui/feedback";
import { COMPACT_BREAKPOINT } from "@/constants/palette";
import { getErrorMessage, useApi } from "@/lib/api";
import { confirmAction } from "@/lib/feedback";
import { goBack } from "@/lib/navigation";
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

type ClaimStatus = "pending" | "submitted" | "confirmed" | null;

/** A quest the server picked for this user (GET /api/quests). */
type ServerQuest = {
  id: string;
  period: "daily" | "weekly";
  reward: number;
  target: number;
  progress: number;
  claimStatus: ClaimStatus;
};

/** How each quest of the server's pool looks. Keys match server/quests.js. */
type QuestLook = {
  title: string;
  description: string;
  unit: string;
  category: string;
  icon: typeof BookOpen;
  color: string;
  iconColor: string;
  action?: { label: string; route: Href };
};

const READ_ACTION = { label: "Start reading", route: "/reading/session" as Href };
const QUIZ_ACTION = { label: "Practice", route: "/study/practice" as Href };
const UPLOAD_ACTION = { label: "Upload", route: "/study/upload" as Href };

const LOOKS: Record<string, QuestLook> = {
  read10: { title: "A quick chapter", description: "Read for 10 minutes today.", unit: "min", category: "READING", icon: Timer, color: COLORS.lightPink, iconColor: COLORS.darkPink, action: READ_ACTION },
  read: { title: "A little reading", description: "Read for 20 minutes today.", unit: "min", category: "READING", icon: BookOpen, color: COLORS.lightPink, iconColor: COLORS.darkPink, action: READ_ACTION },
  read30: { title: "Lost in a story", description: "Read for 30 minutes today.", unit: "min", category: "READING", icon: BookOpen, color: COLORS.peach, iconColor: "#A77C6C", action: READ_ACTION },
  pages20: { title: "Page turner", description: "Read 20 pages today in your reading sessions.", unit: "pages", category: "READING", icon: Layers, color: COLORS.lavender, iconColor: COLORS.purple, action: READ_ACTION },
  book: { title: "New beginnings", description: "Add a new book to your collection today.", unit: "book", category: "COLLECTION", icon: BookPlus, color: COLORS.lavender, iconColor: COLORS.purple, action: { label: "Add a book", route: "/reading/add-book" } },
  review: { title: "Share your thoughts", description: "Write your impressions after a reading session today.", unit: "session", category: "REFLECTION", icon: PenLine, color: COLORS.peach, iconColor: "#A77C6C", action: READ_ACTION },
  quiz1: { title: "Quick check", description: "Complete a practice quiz today.", unit: "quiz", category: "LEARNING", icon: GraduationCap, color: COLORS.sage, iconColor: "#71866F", action: QUIZ_ACTION },
  perfect: { title: "Perfect score", description: "Answer every question right in a quiz today.", unit: "quiz", category: "LEARNING", icon: Star, color: COLORS.peach, iconColor: "#A77C6C", action: QUIZ_ACTION },
  listen: { title: "Learn by ear", description: "Listen to one of your audio lessons today.", unit: "lesson", category: "LISTENING", icon: Headphones, color: COLORS.lavender, iconColor: COLORS.purple, action: { label: "Listen", route: "/study/audio" } },
  tutor: { title: "Ask away", description: "Ask the study tutor about one of your lessons.", unit: "chat", category: "LEARNING", icon: MessageCircleQuestionMark, color: COLORS.lightPink, iconColor: COLORS.darkPink, action: { label: "Ask", route: "/study/tutor" } },
  upload1: { title: "Fresh material", description: "Upload a study material today.", unit: "file", category: "STUDY", icon: FileText, color: COLORS.sage, iconColor: "#71866F", action: UPLOAD_ACTION },
  consistency: { title: "Consistency is key", description: "Read on 5 different days this week.", unit: "days", category: "CONSISTENCY", icon: CalendarCheck, color: COLORS.sage, iconColor: "#71866F", action: READ_ACTION },
  pages150: { title: "Bookworm week", description: "Read 150 pages this week.", unit: "pages", category: "READING", icon: Layers, color: COLORS.lightPink, iconColor: COLORS.darkPink, action: READ_ACTION },
  finish: { title: "The final chapter", description: "Finish reading a book this week.", unit: "book", category: "ACHIEVEMENT", icon: Trophy, color: COLORS.peach, iconColor: "#A77C6C", action: { label: "My books", route: "/reading" } },
  study: { title: "Curious minds", description: "Complete 3 practice quizzes this week.", unit: "quizzes", category: "LEARNING", icon: GraduationCap, color: COLORS.lavender, iconColor: COLORS.purple, action: QUIZ_ACTION },
  quiz80: { title: "Top of the class", description: "Score 80% or more on a quiz this week.", unit: "quiz", category: "LEARNING", icon: Target, color: COLORS.sage, iconColor: "#71866F", action: QUIZ_ACTION },
  upload2: { title: "Well prepared", description: "Upload 2 study materials this week.", unit: "files", category: "STUDY", icon: FileText, color: COLORS.lavender, iconColor: COLORS.purple, action: UPLOAD_ACTION },
  voice3: { title: "Let's talk", description: "Have 3 voice chats with Laica or the tutor this week.", unit: "chats", category: "VOICE", icon: Mic, color: COLORS.lightPink, iconColor: COLORS.darkPink, action: { label: "Talk", route: "/study/voice" } },
  campusPublish: { title: "Share a book", description: "Publish a book on Campus this week.", unit: "book", category: "CAMPUS", icon: Award, color: COLORS.peach, iconColor: "#A77C6C", action: { label: "Campus", route: "/campus" } },
  campusBorrow: { title: "Book swap", description: "Borrow a book from another student on Campus.", unit: "book", category: "CAMPUS", icon: Handshake, color: COLORS.sage, iconColor: "#71866F", action: { label: "Campus", route: "/campus" } },
};

const FALLBACK_LOOK: QuestLook = {
  title: "Special quest",
  description: "A new challenge from Laica.",
  unit: "",
  category: "QUEST",
  icon: Sparkles,
  color: COLORS.lavender,
  iconColor: COLORS.purple,
};

function QuestCard({
  quest,
  claiming,
  busy,
  canReroll,
  onClaim,
  onReroll,
}: {
  quest: ServerQuest;
  claiming: boolean;
  busy: boolean;
  canReroll: boolean;
  onClaim: () => void;
  onReroll: () => void;
}) {
  const look = LOOKS[quest.id] ?? FALLBACK_LOOK;
  const Icon = look.icon;
  const value = Math.min(quest.progress, quest.target);
  const completed = quest.progress >= quest.target;
  const claimed = quest.claimStatus === "confirmed";
  const confirming =
    quest.claimStatus === "pending" || quest.claimStatus === "submitted";

  return (
    <View style={styles.questCard}>
      <View style={styles.questTop}>
        <View style={[styles.questIcon, { backgroundColor: look.color }]}>
          <Icon size={23} color={look.iconColor} strokeWidth={1.7} />
        </View>

        <View style={styles.questReward}>
          <Sparkles size={13} color={COLORS.darkPink} />
          <Text style={styles.rewardText}>+{quest.reward} PAW</Text>
        </View>
      </View>

      <View style={styles.questInfo}>
        <Text style={styles.questCategory}>{look.category}</Text>
        <Text style={styles.questTitle}>{look.title}</Text>
        <Text style={styles.questDescription}>{look.description}</Text>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>YOUR PROGRESS</Text>
          <Text style={styles.progressValue}>
            {value}/{quest.target} {look.unit}
          </Text>
        </View>
        <View
          style={styles.progressTrack}
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: quest.target, now: value }}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${(value / quest.target) * 100}%`,
                backgroundColor: completed ? "#8BA486" : COLORS.darkPink,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.questFooter}>
        {claimed ? (
          <View style={styles.claimedPill}>
            <Check size={13} color="#71866F" />
            <Text style={styles.claimedText}>+{quest.reward} PAW received</Text>
          </View>
        ) : completed ? (
          <Pressable
            onPress={onClaim}
            disabled={busy}
            style={({ pressed }) => [
              styles.claimButton,
              (pressed || claiming || busy) && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Claim ${quest.reward} PAW for ${look.title}`}
            accessibilityState={{ disabled: busy, busy: claiming }}
          >
            {claiming ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Coins size={14} color={COLORS.white} />
            )}
            <Text style={styles.claimButtonText}>
              {claiming ? "Sending..." : confirming ? "Check reward" : `Claim ${quest.reward} PAW`}
            </Text>
          </Pressable>
        ) : look.action ? (
          <Pressable
            onPress={() => router.push(look.action!.route)}
            style={({ pressed }) => [styles.questAction, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.questActionText}>{look.action.label}</Text>
            <ArrowRight size={14} color={COLORS.text} />
          </Pressable>
        ) : (
          <View style={styles.questStatus}>
            <Clock3 size={14} color={COLORS.muted} />
            <Text style={styles.statusText}>In progress</Text>
          </View>
        )}

        {canReroll && !claimed && !confirming ? (
          <Pressable
            onPress={onReroll}
            disabled={busy}
            hitSlop={8}
            style={({ pressed }) => [styles.rerollButton, (pressed || busy) && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Swap ${look.title} for another quest`}
          >
            <Shuffle size={14} color={COLORS.purple} />
            <Text style={styles.rerollText}>Swap</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function QuestsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const { balance, loading: walletLoading, refreshWallet } = usePawWallet();
  const displayedBalance = walletLoading ? "..." : (balance ?? "—");

  const { fetchRaw, request } = useApi();
  const [quests, setQuests] = useState<ServerQuest[]>([]);
  const [rerollAvailable, setRerollAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const loadQuests = useCallback(async () => {
    try {
      setLoadError("");
      const data = await request<{ quests: ServerQuest[]; rerollAvailable?: boolean }>(
        "/api/quests",
      );
      setQuests(data.quests ?? []);
      setRerollAvailable(Boolean(data.rerollAvailable));
    } catch (error) {
      console.error("Quests loading error:", error);
      setLoadError(getErrorMessage(error, "We couldn't load your quests."));
    } finally {
      setLoading(false);
    }
  }, [request]);

  // Reload whenever the screen is shown, so new activity counts right away.
  useFocusEffect(
    useCallback(() => {
      loadQuests();
    }, [loadQuests]),
  );

  const handleClaim = async (quest: ServerQuest) => {
    if (busyId) return;

    try {
      setBusyId(quest.id);
      setNotice({ tone: "info", message: `Sending ${quest.reward} PAW to your wallet on Solana...` });

      const { ok, status, data } = await fetchRaw<{
        success?: boolean;
        error?: string;
        pendingConfirmation?: boolean;
      }>(`/api/quests/${encodeURIComponent(quest.id)}/claim`, { method: "POST" });

      if (status === 202 || data.pendingConfirmation) {
        setNotice({ tone: "info", message: data.error || "Your reward is still being confirmed." });
      } else if (!ok || !data.success) {
        throw new Error(data.error || "We couldn't send your reward.");
      } else {
        setNotice({ tone: "success", message: `+${quest.reward} PAW are now in your wallet!` });
      }

      await Promise.all([loadQuests(), refreshWallet()]);
    } catch (error) {
      console.error("Quest claim error:", error);
      setNotice({ tone: "error", message: getErrorMessage(error, "We couldn't send your reward.") });
    } finally {
      setBusyId(null);
    }
  };

  const handleReroll = async (quest: ServerQuest) => {
    if (busyId) return;

    const title = (LOOKS[quest.id] ?? FALLBACK_LOOK).title;
    const ok = await confirmAction({
      title: `Swap "${title}"?`,
      message: "You get a different quest instead. You can swap one quest per day.",
      confirmText: "Swap quest",
    });
    if (!ok) return;

    try {
      setBusyId(quest.id);
      const data = await request<{ newId: string }>(
        `/api/quests/${encodeURIComponent(quest.id)}/reroll`,
        { method: "POST" },
      );
      const next = LOOKS[data.newId] ?? FALLBACK_LOOK;
      setNotice({ tone: "success", message: `New quest: ${next.title}.` });
      await loadQuests();
    } catch (error) {
      console.error("Quest reroll error:", error);
      setNotice({ tone: "error", message: getErrorMessage(error, "We couldn't swap this quest.") });
    } finally {
      setBusyId(null);
    }
  };

  const daily = quests.filter((quest) => quest.period === "daily");
  const weekly = quests.filter((quest) => quest.period === "weekly");
  const total = (list: ServerQuest[]) => list.reduce((sum, quest) => sum + quest.reward, 0);

  const renderList = (list: ServerQuest[]) => {
    if (loading && quests.length === 0) {
      return <StateCard loading loadingText="Picking your quests..." />;
    }

    return (
      <View style={styles.questList}>
        {list.map((quest) => (
          <QuestCard
            key={quest.id}
            quest={quest}
            claiming={busyId === quest.id}
            busy={busyId !== null}
            canReroll={rerollAvailable}
            onClaim={() => handleClaim(quest)}
            onReroll={() => handleReroll(quest)}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => goBack("/home")}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={21} color={COLORS.text} strokeWidth={1.8} />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Your Quests</Text>
            <Text style={styles.headerSubtitle}>LITTLE STEPS, LOVELY REWARDS</Text>
          </View>

          <View style={styles.tokenBalance}>
            <Coins size={16} color={COLORS.darkPink} strokeWidth={1.8} />
            <Text style={styles.tokenText}>{displayedBalance} PAW</Text>
          </View>
        </View>

        {/* HERO */}
        <View style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
          <View style={styles.heroText}>
            <Text style={styles.heroEyebrow}>NEW QUESTS EVERY DAY</Text>
            <Text style={styles.heroTitle}>
              Every chapter{"\n"}is an adventure.
            </Text>
            <Text style={styles.heroDescription}>
              Daily quests change every day and weekly challenges every
              Monday. {rerollAvailable
                ? "Don't like one? You can swap one quest today."
                : "You've used today's swap."}
            </Text>
          </View>

          <View style={styles.heroDecoration}>
            <Trophy size={48} color={COLORS.darkPink} strokeWidth={1.35} />
            <View style={styles.heroSparkle}>
              <Sparkles size={19} color={COLORS.purple} />
            </View>
          </View>
        </View>

        {notice ? (
          <Notice
            tone={notice.tone}
            message={notice.message}
            onDismiss={() => setNotice(null)}
            style={styles.statsNotice}
          />
        ) : null}

        {loadError ? (
          <Notice
            tone="error"
            message={loadError}
            actionLabel="Try again"
            onAction={loadQuests}
            style={styles.statsNotice}
          />
        ) : null}

        {/* DAILY SECTION */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Clock3 size={19} color={COLORS.darkPink} />
          </View>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Daily quests</Text>
            <Text style={styles.sectionSubtitle}>New ones tomorrow.</Text>
          </View>
          <View style={styles.rewardSummary}>
            <Text style={styles.summaryNumber}>{total(daily)}</Text>
            <Text style={styles.summaryLabel}>PAW in rewards</Text>
          </View>
        </View>

        {renderList(daily)}

        {/* WEEKLY SECTION */}
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: COLORS.lavender }]}>
            <CalendarCheck size={19} color={COLORS.purple} />
          </View>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Weekly challenges</Text>
            <Text style={styles.sectionSubtitle}>New ones every Monday.</Text>
          </View>
          <View style={styles.rewardSummary}>
            <Text style={styles.summaryNumber}>{total(weekly)}</Text>
            <Text style={styles.summaryLabel}>PAW in rewards</Text>
          </View>
        </View>

        {renderList(weekly)}

        {/* BOTTOM NOTE */}
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Sparkles size={20} color={COLORS.darkPink} />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Your effort deserves a reward.</Text>
            <Text style={styles.infoDescription}>
              Finish a quest and tap Claim: the PAW are minted to your wallet
              on Solana Devnet and you can spend them in Laica&apos;s Shop.
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
  claimButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.darkPink,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  claimButtonText: {
    fontSize: 11,
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.white,
  },
  claimedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.sage,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  claimedText: {
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
    color: "#71866F",
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
  rerollButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: "auto",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: COLORS.lavender,
  },
  rerollText: {
    color: COLORS.purple,
    fontSize: 11,
    fontFamily: "Nunito_800ExtraBold",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
