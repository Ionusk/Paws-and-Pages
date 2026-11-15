import { router, useFocusEffect } from "expo-router";
import {
    ArrowLeft,
    BookOpen,
    ChevronRight,
    FileText,
    GraduationCap,
    Sparkles
} from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

import { StateCard } from "@/components/ui/feedback";
import { COMPACT_BREAKPOINT } from "@/constants/palette";
import { getErrorMessage, useApi } from "@/lib/api";
import { goBack } from "@/lib/navigation";

type MaterialQuiz = {
  id: number;
  title?: string;
  questions: any[];
  createdAt?: string;
};

// Shape returned by GET /api/study/materials.
type StudyMaterial = {
  id: number;
  fileName: string;
  fileType?: string;
  title?: string;
  summary?: string;
  keyPoints?: string[];
  quizzes?: MaterialQuiz[];
};

// The backend returns quizzes oldest first; offer the most recent one.
function getLatestQuiz(material: StudyMaterial) {
  const quizzes = (material.quizzes || []).filter(
    (quiz) => Array.isArray(quiz.questions) && quiz.questions.length > 0
  );

  return quizzes.length > 0 ? quizzes[quizzes.length - 1] : null;
}

function quizCountLabel(material: StudyMaterial) {
  const count = material.quizzes?.length ?? 0;

  if (count === 0) return "No quiz yet";

  return count === 1 ? "1 quiz" : `${count} quizzes`;
}

export default function AISummaryScreen() {
  const { request } = useApi();
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [selectedMaterial, setSelectedMaterial] =
    useState<StudyMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadingRef = useRef(false);

  const fetchMaterials = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      setLoading(true);
      setError("");

      const data = await request<{ materials?: StudyMaterial[] }>(
        "/api/study/materials"
      );

      setMaterials(Array.isArray(data.materials) ? data.materials : []);
    } catch (err) {
      console.error("Could not load summaries:", err);
      setError(
        getErrorMessage(err, "Something went wrong while loading your summaries.")
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [request]);

  // Reload the library whenever the user comes back to this page.
  useFocusEffect(
    useCallback(() => {
      setSelectedMaterial(null);
      fetchMaterials();
    }, [fetchMaterials])
  );

  const openQuiz = () => {
    if (!selectedMaterial) return;

    const quiz = getLatestQuiz(selectedMaterial);
    if (!quiz) return;

    // The quiz screen expects `quizId` + `quiz` (the questions array).
    router.push({
      pathname: "/study/quiz",
      params: {
        result: JSON.stringify({
          ...selectedMaterial,
          materialId: selectedMaterial.id,
          quizId: quiz.id,
          quiz: quiz.questions,
        }),
      },
    });
  };

  const horizontalPadding = isCompact ? styles.compactPadding : null;

  if (selectedMaterial) {
    return (
      <SummaryDetails
        data={selectedMaterial}
        onBack={() => setSelectedMaterial(null)}
        openQuiz={openQuiz}
        isCompact={isCompact}
      />
    );
  }

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
          <Text style={styles.headerTitle}>AI Summaries</Text>
          <Text style={styles.headerSubtitle}>
            Your little study library
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Sparkles size={23} color="#8D78B7" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, horizontalPadding]}
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <BookOpen size={26} color="#8D78B7" />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.introTitle}>
              Your study collection
            </Text>
            <Text style={styles.introDescription}>
              All your generated summaries, together in one place.
            </Text>
          </View>
        </View>

        {loading || error ? (
          <StateCard
            loading={loading}
            loadingText="Loading your summaries..."
            error={error}
            onRetry={fetchMaterials}
          />
        ) : materials.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <FileText size={32} color="#9B86C4" />
            </View>

            <Text style={styles.emptyTitle}>
              No summaries yet
            </Text>

            <Text style={styles.emptyDescription}>
              Upload your first study material and let AI turn it
              into an easy-to-learn summary.
            </Text>

            <Pressable
              style={styles.uploadButton}
              onPress={() => router.push("/study/upload")}
              accessibilityRole="button"
            >
              <Text style={styles.uploadButtonText}>
                Upload material
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Your summaries
              </Text>
              <Text style={styles.countText}>
                {materials.length} saved
              </Text>
            </View>

            {materials.map((material) => {
              const title =
                material.title || material.fileName || "Untitled material";

              return (
                <Pressable
                  key={material.id}
                  style={({ pressed }) => [
                    styles.materialCard,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setSelectedMaterial(material)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open summary: ${title}`}
                >
                  <View style={styles.materialIcon}>
                    <FileText size={23} color="#8D78B7" />
                  </View>

                  <View style={styles.materialInfo}>
                    <Text
                      style={styles.materialTitle}
                      numberOfLines={2}
                    >
                      {title}
                    </Text>

                    <View style={styles.materialMeta}>
                      <GraduationCap size={13} color="#A39AAF" />
                      <Text style={styles.materialDate} numberOfLines={1}>
                        {quizCountLabel(material)}
                      </Text>
                    </View>
                  </View>

                  <ChevronRight size={21} color="#A99ABD" />
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryDetails({
  data,
  onBack,
  openQuiz,
  isCompact,
}: {
  data: StudyMaterial;
  onBack: () => void;
  openQuiz: () => void;
  isCompact: boolean;
}) {
  const latestQuiz = getLatestQuiz(data);
  const quizTotal = data.quizzes?.length ?? 0;
  const horizontalPadding = isCompact ? styles.compactPadding : null;

  return (
    <View style={styles.container}>
      <View style={[styles.header, horizontalPadding]}>
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to your summaries"
        >
          <ArrowLeft size={22} color="#51446B" />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Your summary</Text>
          <Text style={styles.headerSubtitle}>
            Learn a little every day
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Sparkles size={23} color="#8D78B7" />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.detailsContent, horizontalPadding]}
      >
        <View style={styles.titleCard}>
          <View style={styles.titleIcon}>
            <GraduationCap size={27} color="#8D78B7" />
          </View>

          <Text style={styles.summaryTitle}>
            {data.title || data.fileName || "Study Summary"}
          </Text>

          <Text style={styles.summarySubtitle}>
            Your personalized study notes
          </Text>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.cardHeading}>
            <BookOpen size={19} color="#8D78B7" />
            <Text style={styles.cardTitle}>Summary</Text>
          </View>

          <Text style={styles.summaryText}>
            {data.summary || "No summary available."}
          </Text>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.cardHeading}>
            <Sparkles size={19} color="#8D78B7" />
            <Text style={styles.cardTitle}>Key points</Text>
          </View>

          {data.keyPoints && data.keyPoints.length > 0 ? (
            data.keyPoints.map((point, index) => (
              <View key={index} style={styles.keyPointRow}>
                <View style={styles.keyPointNumber}>
                  <Text style={styles.keyPointNumberText}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={styles.keyPointText}>{point}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.summaryText}>
              No key points available.
            </Text>
          )}
        </View>

        <View style={styles.quizCard}>
          <View style={styles.quizIcon}>
            <GraduationCap size={25} color="#FFFFFF" />
          </View>

          <Text style={styles.quizTitle}>
            Ready to test yourself?
          </Text>

          <Text style={styles.quizDescription}>
            {latestQuiz
              ? quizTotal > 1
                ? `Practice with your latest quiz. All ${quizTotal} quizzes for this material are in Practice quizzes.`
                : "Practice what you have learned with a quick quiz."
              : "This material doesn't have a quiz yet. You can create one in Practice quizzes."}
          </Text>

          {latestQuiz ? (
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
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.quizButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/study/practice")}
              accessibilityRole="button"
            >
              <Text style={styles.quizButtonText}>Go to Practice quizzes</Text>
              <ChevronRight size={18} color="#79649F" />
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.quizButton, pressed && styles.pressed]}
            onPress={() =>
              router.push({
                pathname: "/study/audio",
                params: { materialId: String(data.id) },
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.quizButtonText}>Listen to this summary</Text>
            <ChevronRight size={18} color="#79649F" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.quizButton, pressed && styles.pressed]}
            onPress={() =>
              router.push({
                pathname: "/study/tutor",
                params: { materialId: String(data.id) },
              })
            }
            accessibilityRole="button"
          >
            <Text style={styles.quizButtonText}>Ask questions about it</Text>
            <ChevronRight size={18} color="#79649F" />
          </Pressable>
        </View>
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
  listContent: {
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  introCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0EAF8",
    padding: 18,
    borderRadius: 22,
    marginBottom: 27,
  },
  introIcon: {
    width: 49,
    height: 49,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  introTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#51446B",
    marginBottom: 4,
  },
  introDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#827693",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 27,
    alignItems: "center",
    marginTop: 10,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: "#F0EAF8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#51446B",
    marginBottom: 9,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "#92899F",
    textAlign: "center",
    marginBottom: 22,
  },
  uploadButton: {
    backgroundColor: "#9B86C4",
    paddingHorizontal: 25,
    paddingVertical: 13,
    borderRadius: 15,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#51446B",
  },
  countText: {
    fontSize: 12,
    color: "#A39AAF",
  },
  materialCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    padding: 16,
    marginBottom: 12,
  },
  materialIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: "#F0EAF8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  materialInfo: {
    flex: 1,
    marginRight: 8,
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#51446B",
    lineHeight: 20,
  },
  materialMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },
  materialDate: {
    fontSize: 11,
    color: "#A39AAF",
    marginLeft: 5,
  },
  detailsContent: {
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
  contentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    padding: 19,
    marginBottom: 16,
  },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
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
  keyPointNumber: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: "#F0EAF8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  keyPointNumberText: {
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
  pressed: {
    opacity: 0.85,
  },
});
