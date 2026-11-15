
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { goBack } from '@/lib/navigation';
import { useAuth0 } from "react-native-auth0";
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  GraduationCap,
  Clock,
  ChevronRight,
  FileText,
} from "lucide-react-native";

const API_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:3001"
    : "http://localhost:3001";

const API_AUDIENCE = "https://paws-and-pages-api";
const AUTH_SCOPE = "openid profile email offline_access";

type StudyMaterial = {
  id: number;
  fileName: string;
  fileType?: string;
  title?: string;
  summary?: string;
  keyPoints?: string[];
  quizId?: number;
  quiz?: any[];
};

export default function AISummaryScreen() {
  const { getCredentials } = useAuth0();

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [selectedMaterial, setSelectedMaterial] =
    useState<StudyMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const credentials = await getCredentials(
        AUTH_SCOPE,
        0,
        { audience: API_AUDIENCE }
      );

      const response = await fetch(`${API_URL}/api/study/materials`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            responseData.error ||
            "Nu am putut încărca rezumatele."
        );
      }

      setMaterials(responseData.materials || []);
    } catch (err: any) {
      console.log("Eroare la încărcarea rezumatelor:", err);
      setError(
        err.message || "A apărut o eroare la încărcarea rezumatelor."
      );
    } finally {
      setLoading(false);
    }
  }, [getCredentials]);

  // Reîncarcă istoricul când utilizatorul revine pe această pagină.
  useFocusEffect(
    useCallback(() => {
      setSelectedMaterial(null);
      fetchMaterials();
    }, [fetchMaterials])
  );

  const openQuiz = () => {
    if (!selectedMaterial) return;

    router.push({
      pathname: "/study/quiz",
      params: {
        result: JSON.stringify(selectedMaterial),
      },
    } as any);
  };

  if (selectedMaterial) {
    return (
      <SummaryDetails
        data={selectedMaterial}
        onBack={() => setSelectedMaterial(null)}
        openQuiz={openQuiz}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => goBack('/study')}
        >
          <ArrowLeft size={22} color="#51446B" />
        </Pressable>

        <View style={{ flex: 1 }}>
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
        contentContainerStyle={styles.listContent}
      >
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <BookOpen size={26} color="#8D78B7" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>
              Your study collection
            </Text>
            <Text style={styles.introDescription}>
              All your generated summaries, together in one place.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#9B86C4" />
            <Text style={styles.loadingText}>
              Loading your summaries...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Something went wrong
            </Text>
            <Text style={styles.emptyDescription}>{error}</Text>

            <Pressable
              style={styles.uploadButton}
              onPress={fetchMaterials}
            >
              <Text style={styles.uploadButtonText}>Try again</Text>
            </Pressable>
          </View>
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
              onPress={() => router.push("/study/upload" as any)}
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

            {materials.map((material) => (
              <Pressable
                key={material.id}
                style={styles.materialCard}
                onPress={() => setSelectedMaterial(material)}
              >
                <View style={styles.materialIcon}>
                  <FileText size={23} color="#8D78B7" />
                </View>

                <View style={styles.materialInfo}>
                  <Text
                    style={styles.materialTitle}
                    numberOfLines={2}
                  >
                    {material.title ||
                      material.fileName ||
                      "Untitled material"}
                  </Text>

                  <View style={styles.materialMeta}>
                    <Clock size={13} color="#A39AAF" />
                    <Text style={styles.materialDate}>
                      Study material
                    </Text>
                  </View>
                </View>

                <ChevronRight size={21} color="#A99ABD" />
              </Pressable>
            ))}
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
}: {
  data: StudyMaterial;
  onBack: () => void;
  openQuiz: () => void;
}) {
  const hasQuiz = Boolean(
    data.quizId || (data.quiz && data.quiz.length > 0)
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={22} color="#51446B" />
        </Pressable>

        <View style={{ flex: 1 }}>
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
        contentContainerStyle={styles.detailsContent}
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

        {hasQuiz && (
          <View style={styles.quizCard}>
            <View style={styles.quizIcon}>
              <GraduationCap size={25} color="#FFFFFF" />
            </View>

            <Text style={styles.quizTitle}>
              Ready to test yourself?
            </Text>

            <Text style={styles.quizDescription}>
              Practice what you have learned with a quick quiz.
            </Text>

            <Pressable style={styles.quizButton} onPress={openQuiz}>
              <Text style={styles.quizButtonText}>Start quiz</Text>
              <ChevronRight size={18} color="#FFFFFF" />
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
  centerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 65,
  },
  loadingText: {
    color: "#8D78B7",
    fontSize: 14,
    marginTop: 14,
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
});
