import { router } from "expo-router";
import {
  ArrowRight,
  ArrowUpRight,
  BookPlus,
  Flower2,
  Heart,
  LibraryBig,
  NotebookPen,
  PawPrint,
  Timer
} from "lucide-react-native";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  background: "#FFF8F1",
  purple: "#9B829F",
  pink: "#DDA6AD",
  darkPink: "#B77D88",
  text: "#59484C",
  muted: "#9B8588",
  white: "#FFFFFF",
  sage: "#DCE6D8",
  lavender: "#E9E1F1",
  peach: "#F7E1D5",
  lightPink: "#F4E8ED",
  track: "#F1E8E8",
};

export default function ReadingScreen() {
  // Temporar: urmează să conectăm aceste valori la cărțile din Supabase.
  const booksRead = 0;
  const readingGoal = 12;

  const progress = Math.min(booksRead / readingGoal, 1);
  const percentage = Math.round(progress * 100);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR READING CORNER</Text>
            <Text style={styles.title}>My reading journey</Text>
            <Text style={styles.subtitle}>
              Every book takes you somewhere new.
            </Text>
          </View>

          <View style={styles.headerDecoration}>
            <Flower2 size={32} color={COLORS.darkPink} strokeWidth={1.4} />
          </View>
        </View>

        {/* READING GOAL */}
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalEyebrow}>YOUR YEARLY GOAL</Text>
              <Text style={styles.goalTitle}>A year full of stories</Text>
            </View>

            <View style={styles.goalBadge}>
              <Heart size={13} color={COLORS.darkPink} strokeWidth={1.8} />
              <Text style={styles.goalBadgeText}>Reading goal</Text>
            </View>
          </View>

          {/* CIRCLE */}
          <View style={styles.progressContainer}>
            <View style={styles.progressCircle}>
              <View style={styles.progressInner}>
                <Text style={styles.progressSmall}>BOOKS READ</Text>

                <View style={styles.progressNumbers}>
                  <Text style={styles.progressNumber}>{booksRead}</Text>
                  <Text style={styles.progressSlash}>/</Text>
                  <Text style={styles.progressTarget}>{readingGoal}</Text>
                </View>

                <Text style={styles.progressLabel}>books completed</Text>

                <Heart
                  size={21}
                  color={COLORS.pink}
                  strokeWidth={1.6}
                  style={styles.progressHeart}
                />
              </View>
            </View>
          </View>

          <View style={styles.progressInfo}>
            <Text style={styles.progressPercentage}>
              {percentage}% completed
            </Text>

            <Text style={styles.progressRemaining}>
              {Math.max(readingGoal - booksRead, 0)} books to go
            </Text>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[styles.progressBarFill, { width: `${percentage}%` }]}
            />
          </View>

          <Text style={styles.goalFooter}>
            Little by little, one chapter at a time.
          </Text>
        </View>

        {/* LIBRARY ACTIONS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your bookshelf</Text>
            <Text style={styles.sectionSubtitle}>
              What would you like to do today?
            </Text>
          </View>

          <Flower2 size={25} color={COLORS.darkPink} strokeWidth={1.5} />
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionCard, styles.addCard]}
            onPress={() => router.push("/library")}
          >
            <View style={styles.actionTop}>
              <View style={styles.actionIcon}>
                <BookPlus size={24} color={COLORS.darkPink} strokeWidth={1.7} />
              </View>
              <ArrowUpRight size={21} color={COLORS.muted} strokeWidth={1.6} />
            </View>

            <View>
              <Text style={styles.actionTitle}>Add a book</Text>
              <Text style={styles.actionDescription}>
                Find your next favorite story.
              </Text>
            </View>

            <View style={styles.actionBottom}>
              <Text style={styles.actionLink}>ADD TO SHELF</Text>
              <ArrowRight size={17} color={COLORS.text} strokeWidth={1.7} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.actionCard, styles.libraryCard]}
            onPress={() => router.push("/library")}
          >
            <View style={styles.actionTop}>
              <View style={styles.actionIcon}>
                <LibraryBig size={24} color={COLORS.purple} strokeWidth={1.7} />
              </View>
              <ArrowUpRight size={21} color={COLORS.muted} strokeWidth={1.6} />
            </View>

            <View>
              <Text style={styles.actionTitle}>My library</Text>
              <Text style={styles.actionDescription}>
                Explore your personal bookshelf.
              </Text>
            </View>

            <View style={styles.actionBottom}>
              <Text style={styles.actionLink}>VIEW LIBRARY</Text>
              <ArrowRight size={17} color={COLORS.text} strokeWidth={1.7} />
            </View>
          </TouchableOpacity>
        </View>

        {/* READING ACTIVITIES */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Reading activities</Text>
            <Text style={styles.sectionSubtitle}>
              Make every reading moment count.
            </Text>
          </View>

          <Heart size={24} color={COLORS.darkPink} strokeWidth={1.5} />
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.activityCard}
          onPress={() => router.push("/reading/session")}
        >
          <View
            style={[styles.activityIcon, { backgroundColor: COLORS.lavender }]}
          >
            <Timer size={24} color="#88769C" strokeWidth={1.7} />
          </View>

          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>Reading session</Text>
            <Text style={styles.activityDescription}>
              Settle down and enjoy a few pages.
            </Text>
          </View>

          <ArrowRight size={21} color={COLORS.darkPink} strokeWidth={1.7} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.activityCard}
          onPress={() => router.push("/reading/review")}
        >
          <View
            style={[styles.activityIcon, { backgroundColor: COLORS.peach }]}
          >
            <NotebookPen size={24} color="#A77C6C" strokeWidth={1.7} />
          </View>

          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>Book reviews</Text>
            <Text style={styles.activityDescription}>
              Save your thoughts about the books you read.
            </Text>
          </View>

          <ArrowRight size={21} color={COLORS.darkPink} strokeWidth={1.7} />
        </TouchableOpacity>

        {/* LAICA REMINDER */}
        <View style={styles.note}>
          <View style={styles.noteTop}>
            <Text style={styles.noteTitle}>Laica's little reminder</Text>
            <PawPrint size={22} color="#71866F" strokeWidth={1.6} />
          </View>

          <Text style={styles.noteText}>
            You don't have to finish a book today. Just enjoy the pages, one
            little chapter at a time.
          </Text>
          <Heart
            size={15}
            color="#71866F"
            strokeWidth={1.5}
            style={styles.noteHeart}
          />
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
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    paddingHorizontal: 55,
    paddingTop: 28,
    paddingBottom: 45,
    maxWidth: 1250,
    width: "100%",
    alignSelf: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 30,
  },

  eyebrow: {
    color: COLORS.darkPink,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 9,
  },

  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },

  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 7,
  },

  headerDecoration: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: COLORS.lightPink,
    justifyContent: "center",
    alignItems: "center",
  },

  goalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 30,
    paddingVertical: 27,
    paddingHorizontal: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0E5E0",
    shadowColor: "#8C6F75",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 38,
  },

  goalHeader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  goalEyebrow: {
    color: COLORS.darkPink,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
  },

  goalTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 6,
  },

  goalBadge: {
    backgroundColor: COLORS.lightPink,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  goalBadgeText: {
    color: COLORS.darkPink,
    fontSize: 10,
    fontWeight: "800",
  },

  progressContainer: {
    marginTop: 28,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  progressCircle: {
    width: 225,
    height: 225,
    borderRadius: 115,
    borderWidth: 13,
    borderColor: COLORS.track,
    backgroundColor: "#FFFDFC",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },

  progressInner: {
    alignItems: "center",
    justifyContent: "center",
  },

  progressSmall: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
  },

  progressNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 5,
  },

  progressNumber: {
    color: COLORS.darkPink,
    fontSize: 51,
    fontWeight: "900",
    letterSpacing: -2,
  },

  progressSlash: {
    color: "#CBB9BC",
    fontSize: 27,
    marginHorizontal: 5,
  },

  progressTarget: {
    color: COLORS.text,
    fontSize: 29,
    fontWeight: "800",
  },

  progressLabel: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 1,
  },

  progressHeart: {
    marginTop: 9,
  },

  progressInfo: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  progressPercentage: {
    color: COLORS.darkPink,
    fontSize: 12,
    fontWeight: "900",
  },

  progressRemaining: {
    color: COLORS.muted,
    fontSize: 11,
  },

  progressBar: {
    width: "100%",
    height: 9,
    borderRadius: 10,
    backgroundColor: COLORS.track,
    marginTop: 12,
    overflow: "hidden",
  },

  progressBarFill: {
    height: "100%",
    backgroundColor: COLORS.pink,
    borderRadius: 10,
  },

  goalFooter: {
    color: COLORS.muted,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 15,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 17,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.5,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 5,
  },

  actionGrid: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 38,
  },

  actionCard: {
    flex: 1,
    minHeight: 205,
    borderRadius: 24,
    padding: 21,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#705B83",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  addCard: {
    backgroundColor: COLORS.lightPink,
  },

  libraryCard: {
    backgroundColor: COLORS.lavender,
  },

  actionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },

  actionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 17,
  },

  actionDescription: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  actionBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 17,
  },

  actionLink: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.3,
    color: COLORS.text,
  },

  activityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 21,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0E5E0",
    marginBottom: 12,
  },

  activityIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },

  activityText: {
    flex: 1,
  },

  activityTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.text,
  },

  activityDescription: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },

  note: {
    backgroundColor: COLORS.sage,
    padding: 22,
    borderRadius: 22,
    marginTop: 25,
  },

  noteTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  noteTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },

  noteText: {
    color: "#786D6E",
    fontSize: 12,
    lineHeight: 20,
    marginTop: 10,
  },

  noteHeart: {
    alignSelf: "flex-end",
    marginTop: 8,
  },

  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginTop: 30,
  },

  footerText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 2,
    color: COLORS.muted,
  },
});
