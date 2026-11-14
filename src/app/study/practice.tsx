import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';

import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth0 } from 'react-native-auth0';

import {
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  FileText,
  Library,
  Play,
  Plus,
  Sparkles,
  BookMarked,
  Clock3,
} from 'lucide-react-native';

const API_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3001'
    : 'http://localhost:3001';

const AUTH_AUDIENCE = 'https://paws-and-pages-api';
const AUTH_SCOPE = 'openid profile email';

// --------------------------------------------------
// COLORS - PAWS & PAGES PURPLE / PINK THEME
// --------------------------------------------------

const COLORS = {
  background: '#E9DDF2',
  surface: '#FFFFFF',
  surfaceWarm: '#F5ECFA',

  ink: '#493653',
  secondary: '#806B87',
  muted: '#A995B2',

  lavender: '#E8D9F2',
  lavenderDark: '#927BA0',
  lavenderLight: '#F5ECFA',

  peach: '#FFF0F2',
  peachDark: '#B77D88',

  sage: '#E7EDE4',
  sageDark: '#71836D',

  border: '#E7D9EE',
  shadow: '#705B83',
};

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Question = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

type Quiz = {
  id: number;
  materialId?: number;
  title: string;
  questions: Question[];
  createdAt?: string;
};

type Material = {
  id: number;
  fileName: string;
  fileType?: string;
  title: string;
  summary?: string;
  keyPoints?: string[];
  quizzes: Quiz[];
  quizId?: number | null;
  quiz?: Question[];
};

// --------------------------------------------------
// MAIN SCREEN
// --------------------------------------------------

export default function PracticeScreen() {
  const router = useRouter();
  const { getCredentials } = useAuth0();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingQuiz, setGeneratingQuiz] = useState<number | null>(null);

  // --------------------------------------------------
  // NORMALIZE MATERIALS
  // --------------------------------------------------

  const normalizeMaterials = (items: any[]): Material[] => {
    return items.map((item) => {
      let quizzes: Quiz[] = [];

      if (
        Array.isArray(item.quizzes) &&
        item.quizzes.length > 0
      ) {
        quizzes = item.quizzes.map(
          (quiz: any, index: number) => ({
            id: Number(quiz.id),
            materialId: Number(item.id),
            title: quiz.title || `Quiz ${index + 1}`,
            questions: Array.isArray(quiz.questions)
              ? quiz.questions
              : [],
            createdAt: quiz.createdAt,
          })
        );
      } else if (
        item.quizId &&
        Array.isArray(item.quiz) &&
        item.quiz.length > 0
      ) {
        quizzes = [
          {
            id: Number(item.quizId),
            materialId: Number(item.id),
            title: 'Quiz 1',
            questions: item.quiz,
          },
        ];
      }

      return {
        id: Number(item.id),
        fileName: item.fileName || 'Material fără nume',
        fileType: item.fileType,
        title: item.title || item.fileName || 'Material de studiu',
        summary: item.summary || '',
        keyPoints: Array.isArray(item.keyPoints)
          ? item.keyPoints
          : [],
        quizzes,
        quizId: item.quizId,
        quiz: item.quiz,
      };
    });
  };

  // --------------------------------------------------
  // LOAD MATERIALS
  // --------------------------------------------------

  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);

      const credentials = await getCredentials(
        AUTH_SCOPE,
        0,
        { audience: AUTH_AUDIENCE }
      );

      if (!credentials?.accessToken) {
        throw new Error(
          'Nu am putut obține token-ul de autentificare.'
        );
      }

      const response = await fetch(
        `${API_URL}/api/study/materials`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Nu am putut încărca materialele.'
        );
      }

      const receivedMaterials = Array.isArray(data.materials)
        ? data.materials
        : [];

      setMaterials(normalizeMaterials(receivedMaterials));

    } catch (error: any) {
      console.error(
        'Eroare la încărcarea quizurilor:',
        error
      );

      Alert.alert(
        'Eroare',
        error?.message || 'Nu am putut încărca quizurile.'
      );

    } finally {
      setLoading(false);
    }
  }, [getCredentials]);

  // --------------------------------------------------
  // REFRESH WHEN SCREEN IS FOCUSED
  // --------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      fetchMaterials();
    }, [fetchMaterials])
  );

  // --------------------------------------------------
  // START SELECTED QUIZ
  // --------------------------------------------------

  const startQuiz = (material: Material, quiz: Quiz) => {
    if (!quiz.questions || quiz.questions.length === 0) {
      Alert.alert(
        'Quiz indisponibil',
        'Acest quiz nu conține întrebări.'
      );
      return;
    }

    const quizData = {
      ...material,
      quizId: quiz.id,
      quiz: quiz.questions,
      materialId: material.id,
      selectedQuiz: quiz,
    };

    router.push({
      pathname: '/study/quiz',
      params: {
        result: JSON.stringify(quizData),
      },
    });
  };

  // --------------------------------------------------
  // VIEW ANSWERS
  // --------------------------------------------------

  const viewAnswers = (material: Material, quiz: Quiz) => {
    if (!quiz.questions || quiz.questions.length === 0) {
      Alert.alert(
        'Răspunsuri indisponibile',
        'Acest quiz nu conține întrebări.'
      );
      return;
    }

    const quizData = {
      ...material,
      quizId: quiz.id,
      quiz: quiz.questions,
      materialId: material.id,
      selectedQuiz: quiz,
      viewAnswersOnly: true,
    };

    router.push({
      pathname: '/study/quiz',
      params: {
        result: JSON.stringify(quizData),
      },
    });
  };

  // --------------------------------------------------
  // GENERATE ANOTHER QUIZ
  // --------------------------------------------------

  const generateAnotherQuiz = async (material: Material) => {
    try {
      setGeneratingQuiz(material.id);

      const credentials = await getCredentials(
        AUTH_SCOPE,
        0,
        { audience: AUTH_AUDIENCE }
      );

      if (!credentials?.accessToken) {
        throw new Error(
          'Nu am putut obține token-ul de autentificare.'
        );
      }

      const response = await fetch(
        `${API_URL}/api/study/materials/${material.id}/quizzes`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Nu am putut genera un quiz nou.'
        );
      }

      await fetchMaterials();

      Alert.alert(
        'Quiz nou creat!',
        'Un nou quiz a fost adăugat în biblioteca ta.'
      );

    } catch (error: any) {
      console.error(
        'Eroare la generarea unui quiz nou:',
        error
      );

      Alert.alert(
        'Nu s-a putut genera quizul',
        error?.message ||
          'Încearcă din nou peste puțin timp.'
      );

    } finally {
      setGeneratingQuiz(null);
    }
  };

  // --------------------------------------------------
  // LOADING SCREEN
  // --------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <BookOpen
              size={30}
              color={COLORS.lavenderDark}
              strokeWidth={1.7}
            />
          </View>

          <ActivityIndicator
            size="small"
            color={COLORS.ink}
          />

          <Text style={styles.loadingText}>
            Pregătim biblioteca ta...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------
  // FILTER MATERIALS WITH QUIZZES
  // --------------------------------------------------

  const materialsWithQuizzes = materials.filter(
    (material) => material.quizzes.length > 0
  );

  const totalQuizzes = materialsWithQuizzes.reduce(
    (total, material) => total + material.quizzes.length,
    0
  );

  // --------------------------------------------------
  // EMPTY STATE
  // --------------------------------------------------

  if (materialsWithQuizzes.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyIllustration}>
            <Library
              size={48}
              color={COLORS.lavenderDark}
              strokeWidth={1.4}
            />

            <View style={styles.emptySmallIcon}>
              <Sparkles
                size={19}
                color={COLORS.peachDark}
              />
            </View>
          </View>

          <Text style={styles.emptyEyebrow}>
            PAWS & PAGES LIBRARY
          </Text>

          <Text style={styles.emptyTitle}>
            Your study corner
          </Text>

          <Text style={styles.emptyText}>
            Biblioteca ta este încă goală. Încarcă un material
            de studiu, iar noi îți vom pregăti primul quiz.
          </Text>

          <Pressable
            style={styles.emptyButton}
            onPress={() => router.push('/study/upload')}
          >
            <Plus
              size={18}
              color="#FFFFFF"
              strokeWidth={2.2}
            />

            <Text style={styles.emptyButtonText}>
              Încarcă un material
            </Text>
          </Pressable>

          <Pressable
            style={styles.backToStudyButton}
            onPress={() => router.replace("/home")}
          >
            <ArrowLeft
              size={15}
              color={COLORS.secondary}
            />

            <Text style={styles.backToStudyText}>
              Înapoi la Study
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------
  // MAIN CONTENT
  // --------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
           onPress={() => router.replace("/home")}
          >
            <ArrowLeft
              size={20}
              color={COLORS.ink}
              strokeWidth={1.8}
            />
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerEyebrow}>
              PAWS & PAGES
            </Text>

            <Text style={styles.title}>
              Study Library
            </Text>

            <Text style={styles.subtitle}>
              Un loc liniștit pentru idei mari.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <BookMarked
              size={24}
              color={COLORS.lavenderDark}
              strokeWidth={1.5}
            />
          </View>
        </View>

        {/* LIBRARY SUMMARY */}

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryIcon}>
              <Brain
                size={23}
                color={COLORS.peachDark}
                strokeWidth={1.6}
              />
            </View>

            <View style={styles.summaryTextContainer}>
              <Text style={styles.summaryTitle}>
                Ready to practice?
              </Text>

              <Text style={styles.summaryDescription}>
                Alege un quiz și descoperă cât de multe ai reținut.
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {materialsWithQuizzes.length}
              </Text>

              <Text style={styles.statLabel}>
                materiale
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {totalQuizzes}
              </Text>

              <Text style={styles.statLabel}>
                quizuri
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {totalQuizzes * 5}
              </Text>

              <Text style={styles.statLabel}>
                întrebări
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION TITLE */}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionEyebrow}>
              YOUR COLLECTION
            </Text>

            <Text style={styles.sectionTitle}>
              Materialele tale
            </Text>
          </View>

          <View style={styles.collectionIcon}>
            <Library
              size={20}
              color={COLORS.peachDark}
              strokeWidth={1.7}
            />
          </View>
        </View>

        {/* MATERIALS */}

        {materialsWithQuizzes.map((material, materialIndex) => {
          const quizzes = material.quizzes;

          return (
            <View
              key={material.id}
              style={styles.materialSection}
            >
              {/* MATERIAL CARD */}

              <View style={styles.materialCard}>
                <View style={styles.materialHeader}>
                  <View
                    style={[
                      styles.documentIcon,
                      materialIndex % 2 === 0
                        ? styles.documentIconLavender
                        : styles.documentIconPeach,
                    ]}
                  >
                    <FileText
                      size={25}
                      color={
                        materialIndex % 2 === 0
                          ? COLORS.lavenderDark
                          : COLORS.peachDark
                      }
                      strokeWidth={1.6}
                    />
                  </View>

                  <View style={styles.materialHeaderText}>
                    <Text style={styles.materialEyebrow}>
                      STUDY MATERIAL
                    </Text>

                    <Text
                      style={styles.materialTitle}
                      numberOfLines={2}
                    >
                      {material.title || material.fileName}
                    </Text>

                    <Text
                      style={styles.fileName}
                      numberOfLines={1}
                    >
                      {material.fileName}
                    </Text>
                  </View>
                </View>

                <View style={styles.materialFooter}>
                  <View style={styles.quizCountContainer}>
                    <BookOpen
                      size={14}
                      color={COLORS.lavenderDark}
                      strokeWidth={1.8}
                    />

                    <Text style={styles.quizCount}>
                      {quizzes.length === 1
                        ? '1 quiz disponibil'
                        : `${quizzes.length} quizuri disponibile`}
                    </Text>
                  </View>

                  <View style={styles.materialDot} />
                </View>
              </View>

              {/* QUIZ LIST */}

              <View style={styles.quizList}>
                {quizzes.map((quiz, quizIndex) => {
                  const questionCount = Array.isArray(
                    quiz.questions
                  )
                    ? quiz.questions.length
                    : 0;

                  return (
                    <View
                      key={quiz.id}
                      style={styles.quizCard}
                    >
                      <View style={styles.quizTopRow}>
                        <View style={styles.quizNumber}>
                          <Text style={styles.quizNumberText}>
                            {String(quizIndex + 1).padStart(2, '0')}
                          </Text>
                        </View>

                        <View style={styles.quizInfo}>
                          <Text style={styles.quizEyebrow}>
                            PRACTICE SET {quizIndex + 1}
                          </Text>

                          <Text
                            style={styles.quizTitle}
                            numberOfLines={2}
                          >
                            {quiz.title || `Quiz ${quizIndex + 1}`}
                          </Text>

                          <View style={styles.questionMeta}>
                            <Clock3
                              size={12}
                              color={COLORS.muted}
                              strokeWidth={1.8}
                            />

                            <Text style={styles.questionCount}>
                              {questionCount} întrebări
                            </Text>
                          </View>
                        </View>

                        <View style={styles.quizDecoration}>
                          <CheckCircle2
                            size={18}
                            color={COLORS.sageDark}
                            strokeWidth={1.7}
                          />
                        </View>
                      </View>

                      {/* QUIZ ACTIONS */}

                      <View style={styles.buttonsRow}>
                        <Pressable
                          style={styles.playButton}
                          onPress={() =>
                            startQuiz(material, quiz)
                          }
                        >
                          <Play
                            size={15}
                            color="#FFFFFF"
                            fill="#FFFFFF"
                            strokeWidth={1.5}
                          />

                          <Text style={styles.playButtonText}>
                            Începe quizul
                          </Text>
                        </Pressable>

                        <Pressable
                          style={styles.answersButton}
                          onPress={() =>
                            viewAnswers(material, quiz)
                          }
                        >
                          <CheckCircle2
                            size={15}
                            color={COLORS.lavenderDark}
                            strokeWidth={1.8}
                          />

                          <Text style={styles.answersButtonText}>
                            Răspunsuri
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* GENERATE ANOTHER QUIZ */}

              <Pressable
                style={[
                  styles.generateButton,
                  generatingQuiz === material.id &&
                    styles.generateButtonDisabled,
                ]}
                onPress={() => generateAnotherQuiz(material)}
                disabled={generatingQuiz === material.id}
              >
                {generatingQuiz === material.id ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.lavenderDark}
                    />

                    <Text style={styles.generateButtonText}>
                      Se pregătește un quiz nou...
                    </Text>
                  </>
                ) : (
                  <>
                    <Sparkles
                      size={17}
                      color={COLORS.lavenderDark}
                      strokeWidth={1.8}
                    />

                    <Text style={styles.generateButtonText}>
                      Generează alt quiz
                    </Text>

                    <ChevronRight
                      size={17}
                      color={COLORS.lavenderDark}
                      strokeWidth={1.8}
                    />
                  </>
                )}
              </Pressable>
            </View>
          );
        })}

        {/* BOTTOM NOTE */}

        <View style={styles.bottomNote}>
          <Sparkles
            size={15}
            color={COLORS.peachDark}
            strokeWidth={1.7}
          />

          <Text style={styles.bottomNoteText}>
            Little steps, big progress.
          </Text>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
  },

  contentContainer: {
    paddingHorizontal: 21,
    paddingTop: 19,
    paddingBottom: 35,
  },

  // HEADER

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerEyebrow: {
    fontSize: 9,
    letterSpacing: 2.2,
    color: COLORS.peachDark,
    fontWeight: '800',
    marginBottom: 3,
  },

  title: {
    fontSize: 27,
    color: COLORS.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  subtitle: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 3,
    fontFamily: 'Nunito_400Regular',
  },

  headerIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: COLORS.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // SUMMARY CARD

  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 23,
    padding: 18,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.09,
    shadowRadius: 9,
    elevation: 2,
  },

  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryIcon: {
    width: 47,
    height: 47,
    borderRadius: 16,
    backgroundColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  summaryTextContainer: {
    flex: 1,
  },

  summaryTitle: {
    fontSize: 18,
    color: COLORS.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 4,
  },

  summaryDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.secondary,
    fontFamily: 'Nunito_400Regular',
  },

  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
  },

  statNumber: {
    fontSize: 21,
    color: COLORS.lavenderDark,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  statLabel: {
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 2,
    fontFamily: 'Nunito_400Regular',
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },

  // SECTION HEADING

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },

  sectionEyebrow: {
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.peachDark,
    fontWeight: '800',
    marginBottom: 4,
  },

  sectionTitle: {
    fontSize: 22,
    color: COLORS.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  collectionIcon: {
    width: 39,
    height: 39,
    borderRadius: 14,
    backgroundColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // MATERIAL SECTION

  materialSection: {
    marginBottom: 27,
  },

  materialCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 11,

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },

  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  documentIcon: {
    width: 49,
    height: 53,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  documentIconLavender: {
    backgroundColor: COLORS.lavenderLight,
  },

  documentIconPeach: {
    backgroundColor: COLORS.peach,
  },

  materialHeaderText: {
    flex: 1,
  },

  materialEyebrow: {
    fontSize: 8,
    letterSpacing: 1.6,
    color: COLORS.muted,
    fontWeight: '800',
    marginBottom: 4,
  },

  materialTitle: {
    fontSize: 16,
    lineHeight: 21,
    color: COLORS.ink,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  fileName: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 4,
    fontFamily: 'Nunito_400Regular',
  },

  materialFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  quizCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  quizCount: {
    fontSize: 11,
    color: COLORS.lavenderDark,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },

  materialDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.sageDark,
  },

  // QUIZ LIST

  quizList: {
    paddingLeft: 9,
    borderLeftWidth: 1,
    borderLeftColor: '#D8C5E4',
    marginLeft: 12,
  },

  quizCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 1,
  },

  quizTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  quizNumber: {
    width: 39,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.lavenderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  quizNumberText: {
    fontSize: 16,
    color: COLORS.lavenderDark,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  quizInfo: {
    flex: 1,
  },

  quizEyebrow: {
    fontSize: 8,
    letterSpacing: 1.4,
    color: COLORS.muted,
    fontWeight: '800',
    marginBottom: 3,
  },

  quizTitle: {
    fontSize: 14,
    lineHeight: 19,
    color: COLORS.ink,
    fontFamily: 'Nunito_700Bold',
  },

  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },

  questionCount: {
    fontSize: 10,
    color: COLORS.secondary,
    fontFamily: 'Nunito_400Regular',
  },

  quizDecoration: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: COLORS.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
  },

  // QUIZ BUTTONS

  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  playButton: {
    flex: 1,
    minHeight: 41,
    borderRadius: 12,
    backgroundColor: COLORS.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
  },

  playButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Nunito_700Bold',
  },

  answersButton: {
    flex: 1,
    minHeight: 41,
    borderRadius: 12,
    backgroundColor: COLORS.peach,
    borderWidth: 1,
    borderColor: '#F3D8DF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },

  answersButtonText: {
    color: COLORS.peachDark,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Nunito_700Bold',
  },

  // GENERATE BUTTON

  generateButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CDB9D9',
    backgroundColor: COLORS.lavenderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 12,
    marginLeft: 9,
  },

  generateButtonDisabled: {
    opacity: 0.6,
  },

  generateButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.lavenderDark,
    fontFamily: 'Nunito_700Bold',
  },

  // EMPTY STATE

  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    paddingBottom: 50,
  },

  emptyIllustration: {
    width: 104,
    height: 104,
    borderRadius: 34,
    backgroundColor: COLORS.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 23,
  },

  emptySmallIcon: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 35,
    height: 35,
    borderRadius: 13,
    backgroundColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyEyebrow: {
    fontSize: 9,
    letterSpacing: 2,
    color: COLORS.lavenderDark,
    fontWeight: '800',
    marginBottom: 8,
  },

  emptyTitle: {
    fontSize: 27,
    color: COLORS.ink,
    textAlign: 'center',
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 10,
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Nunito_400Regular',
  },

  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.ink,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
  },

  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Nunito_700Bold',
  },

  backToStudyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 20,
    padding: 8,
  },

  backToStudyText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontFamily: 'Nunito_600SemiBold',
  },

  // LOADING

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingIcon: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: COLORS.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.secondary,
    fontFamily: 'Nunito_400Regular',
  },

  // BOTTOM NOTE

  bottomNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 3,
    marginBottom: 8,
  },

  bottomNoteText: {
    fontSize: 11,
    color: COLORS.muted,
    fontFamily: 'Nunito_400Regular',
    fontStyle: 'italic',
  },

  bottomSpace: {
    height: 20,
  },
});