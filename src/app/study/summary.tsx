import { router, useLocalSearchParams } from "expo-router";
import {
    ArrowLeft,
    BookOpen,
    ChevronRight,
    GraduationCap,
    Sparkles,
} from "lucide-react-native";
import { useMemo } from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

import { COMPACT_BREAKPOINT } from "@/constants/palette";
import { goBack } from "@/lib/navigation";

// Shape returned by POST /api/study/generate.
type StudyMaterial = {
  id?: number;
  materialId?: number;
  fileName?: string;
  title?: string;
  summary?: string;
  keyPoints?: string[];
  quizId?: number;
  quiz?: any[];
};

export default function SummaryScreen() {
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const data = useMemo(() => {
    if (!params.result) return null;

    try {
      const rawResult = Array.isArray(params.result)
        ? params.result[0]
        : params.result;

      return JSON.parse(rawResult) as StudyMaterial;
    } catch (error) {
      console.error("Could not read the summary result:", error);
      return null;
    }
  }, [params.result]);

  const openQuiz = () => {
    if (!data) return;

    router.push({
      pathname: "/study/quiz",
      params: {
        result: JSON.stringify(data),
      },
    });
  };

  if (!data) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, isCompact && styles.compactPadding]}>
          <Pressable
            style={styles.backButton}
            onPress={() => goBack("/study")}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color="#51446B" />
          </Pressable>
          <Text style={styles.headerTitle}>AI Summary</Text>
        </View>

        <View style={[styles.emptyCard, isCompact && styles.emptyCardCompact]}>
          <Sparkles size={32} color="#9B86C4" />
          <Text style={styles.emptyTitle}>No summary available</Text>
          <Text style={styles.emptyText}>
            Upload a study material to generate your summary. Earlier
            summaries are saved in AI summaries.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => router.push("/study/upload")}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Upload material</Text>
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={() => router.push("/study/aisummary")}
            accessibilityRole="button"
          >
            <Text style={styles.linkButtonText}>See saved summaries</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SummaryContent data={data} openQuiz={openQuiz} isCompact={isCompact} />
  );
}

function SummaryContent({
  data,
  openQuiz,
  isCompact,
}: {
  data: StudyMaterial;
  openQuiz: () => void;
  isCompact: boolean;
}) {
  const title = data.title || data.fileName || "Study Summary";
  const summary = data.summary || "";
  const keyPoints = Array.isArray(data.keyPoints) ? data.keyPoints : [];
  // The quiz screen needs the questions array to render anything.
  const hasQuiz = Array.isArray(data.quiz) && data.quiz.length > 0;
  const horizontalPadding = isCompact ? styles.compactPadding : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, horizontalPadding]}>
        <Pressable
          style={styles.backButton}
          onPress={() => goBack("/study")}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color="#51446B" />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>AI Summary</Text>
          <Text style={styles.headerSubtitle}>Learn a little every day</Text>
        </View>

        <View style={styles.headerIcon}>
          <Sparkles size={23} color="#8D78B7" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, horizontalPadding]}
      >
        <View style={styles.titleCard}>
          <View style={styles.titleIcon}>
            <GraduationCap size={27} color="#8D78B7" />
          </View>
          <Text style={styles.summaryTitle}>{title}</Text>
          <Text style={styles.summarySubtitle}>
            Your personalized study notes
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <BookOpen size={20} color="#8D78B7" />
            <Text style={styles.cardTitle}>Summary</Text>
          </View>
          <Text style={styles.summaryText}>
            {summary || "No summary available."}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <Sparkles size={20} color="#8D78B7" />
            <Text style={styles.cardTitle}>Key points</Text>
          </View>

          {keyPoints.length > 0 ? (
            keyPoints.map((point, index) => (
              <View key={index} style={styles.keyPointRow}>
                <View style={styles.number}>
                  <Text style={styles.numberText}>{index + 1}</Text>
                </View>
                <Text style={styles.keyPointText}>{point}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.summaryText}>No key points available.</Text>
          )}
        </View>

        {hasQuiz && (
          <View style={styles.quizCard}>
            <View style={styles.quizIcon}>
              <GraduationCap size={25} color="#FFFFFF" />
            </View>
            <Text style={styles.quizTitle}>Ready to test yourself?</Text>
            <Text style={styles.quizDescription}>
              Practice what you have learned with a quick quiz.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.quizButton,
                pressed && styles.pressed,
              ]}
              onPress={openQuiz}
              accessibilityRole="button"
            >
              <Text style={styles.quizButtonText}>Start quiz</Text>
              <ChevronRight size={18} color="#79649F" />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7FC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "web" ? 25 : 55,
    paddingBottom: 20,
  },
  compactPadding: {
    paddingHorizontal: 18,
  },
  headerText: {
    flex: 1,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#51446B",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#A39AAF",
    marginTop: 3,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#F0EAF8",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 45,
  },
  titleCard: {
    backgroundColor: "#F0EAF8",
    borderRadius: 23,
    padding: 22,
    alignItems: "center",
    marginBottom: 19,
  },
  titleIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#51446B",
    textAlign: "center",
    marginBottom: 7,
  },
  summarySubtitle: {
    fontSize: 12,
    color: "#8D819E",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    padding: 19,
    marginBottom: 16,
  },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#51446B",
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 23,
    color: "#746B80",
  },
  keyPointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  number: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: "#F0EAF8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  numberText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8D78B7",
  },
  keyPointText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
    color: "#746B80",
    paddingTop: 2,
  },
  quizCard: {
    backgroundColor: "#8D78B7",
    borderRadius: 22,
    padding: 19,
    marginTop: 3,
  },
  quizIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  quizTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  quizDescription: {
    fontSize: 12,
    lineHeight: 19,
    color: "#F0EAF8",
    marginBottom: 17,
  },
  quizButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 17,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  quizButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#79649F",
    marginRight: 5,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 27,
    alignItems: "center",
    marginHorizontal: 22,
    marginTop: 30,
  },
  emptyCardCompact: {
    marginHorizontal: 18,
    padding: 22,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#51446B",
    marginTop: 15,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#92899F",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#9B86C4",
    paddingHorizontal: 25,
    paddingVertical: 13,
    borderRadius: 15,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  linkButton: {
    marginTop: 10,
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  linkButtonText: {
    color: "#8D78B7",
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
});
