
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
} from "react-native";

import {
  useLocalSearchParams,
  router,
} from "expo-router";
import { goBack } from '@/lib/navigation';

import { useAuth0 } from "react-native-auth0";

import {
  PawPrint,
  CheckCircle2,
  ArrowLeft,
  House,
} from "lucide-react-native";

const API_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:3001"
    : "http://localhost:3001";

const API_AUDIENCE = "https://paws-and-pages-api";
const AUTH_SCOPE = "openid profile email offline_access";

function TopNavigation() {
  return (
    <View style={styles.navigation}>
      <Pressable
        style={({ pressed }) => [
          styles.navigationButton,
          pressed && styles.navigationButtonPressed,
        ]}
        onPress={() => goBack('/study')}
      >
        <ArrowLeft size={17} color="#493653" />
        <Text style={styles.navigationButtonText}>Back</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.navigationButton,
          styles.homeButton,
          pressed && styles.navigationButtonPressed,
        ]}
        onPress={() => router.replace("/home")}
      >
        <House size={17} color="#493653" />
        <Text style={styles.navigationButtonText}>Home</Text>
      </Pressable>
    </View>
  );
}

export default function QuizScreen() {
  const {
    result,
    viewAnswersOnly,
  } = useLocalSearchParams<{
    result?: string;
    viewAnswersOnly?: string;
  }>();

  const { getCredentials } = useAuth0();

  // IMPORTANT: data trebuie declarată înainte de isAnswerMode.
  const data = useMemo(() => {
    try {
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error("Nu am putut interpreta datele quizului:", error);
      return null;
    }
  }, [result]);

  const isAnswerMode =
    String(viewAnswersOnly) === "true" ||
    data?.viewAnswersOnly === true ||
    data?.viewAnswersOnly === "true";

  const [answers, setAnswers] = useState<
    Record<number, number>
  >({});

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const saveAttemptRef = useRef(false);
  const attemptRef = useRef(0);

  const allAnswered =
    !!data?.quiz?.length &&
    data.quiz.every(
      (_: any, index: number) =>
        answers[index] !== undefined
    );

  const score = data?.quiz?.reduce(
    (total: number, question: any, index: number) =>
      total +
      (answers[index] === question.correctAnswer ? 1 : 0),
    0
  ) ?? 0;

  useEffect(() => {
    if (isAnswerMode || !allAnswered || !data?.quizId) {
      return;
    }

    if (saveAttemptRef.current) {
      return;
    }

    saveAttemptRef.current = true;

    const currentAttempt = attemptRef.current;
    let cancelled = false;

    const saveResult = async () => {
      try {
        setSaving(true);
        setSaved(false);
        setSaveError("");

        const credentials = await getCredentials(
          AUTH_SCOPE,
          0,
          {
            audience: API_AUDIENCE,
          }
        );

        const answersPayload = data.quiz.map(
          (_: any, questionIndex: number) => ({
            questionIndex,
            selectedAnswer: answers[questionIndex],
          })
        );

        const response = await fetch(
          `${API_URL}/api/study/quiz-results`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${credentials.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              quizId: Number(data.quizId),
              answers: answersPayload,
            }),
          }
        );

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(
            responseData.error ||
              "Nu am putut salva rezultatul quizului."
          );
        }

        if (
          !cancelled &&
          attemptRef.current === currentAttempt
        ) {
          setSaved(true);
          setSaveError("");
        }
      } catch (error: any) {
        console.error(
          "Eroare la salvarea rezultatului:",
          error
        );

        if (
          !cancelled &&
          attemptRef.current === currentAttempt
        ) {
          setSaveError(
            error?.message ||
              "A apărut o eroare la salvarea rezultatului."
          );
        }
      } finally {
        if (
          !cancelled &&
          attemptRef.current === currentAttempt
        ) {
          setSaving(false);
        }
      }
    };

    saveResult();

    return () => {
      cancelled = true;
    };
  }, [
    allAnswered,
    data,
    answers,
    getCredentials,
    isAnswerMode,
  ]);

  const handleRetry = () => {
    attemptRef.current += 1;
    saveAttemptRef.current = false;

    setAnswers({});
    setSaving(false);
    setSaved(false);
    setSaveError("");
  };

  if (!data?.quiz?.length) {
    return (
      <View style={styles.emptyContainer}>
        <TopNavigation />

        <PawPrint
          size={42}
          color="#806B87"
          strokeWidth={1.7}
          style={{ marginBottom: 14 }}
        />

        <Text style={styles.title}>
          No quiz available
        </Text>

        <Text style={styles.body}>
          Generate a study material first.
        </Text>
      </View>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <TopNavigation />

      <Text style={styles.eyebrow}>
        PAWS & PAGES  ·  STUDY TIME
      </Text>

      <Text style={styles.title}>
        {isAnswerMode
          ? "Answer key"
          : "Test your knowledge"}
      </Text>

      <Text style={styles.subtitle}>
        {isAnswerMode
          ? "All the correct answers, together with their explanations."
          : "A little practice goes a long way."}
      </Text>

      <View style={styles.topicCard}>
        <Text style={styles.topicLabel}>
          YOUR STUDY MATERIAL
        </Text>

        <Text style={styles.topicTitle}>
          {data.title}
        </Text>
      </View>

      <View style={styles.progressInfo}>
        <Text style={styles.progressText}>
          {isAnswerMode
            ? "CORRECT ANSWERS"
            : "YOUR QUESTIONS"}
        </Text>

        <Text style={styles.progressCount}>
          {isAnswerMode
            ? `${data.quiz.length} questions`
            : `${answeredCount} / ${data.quiz.length}`}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: isAnswerMode
                ? "100%"
                : `${(answeredCount / data.quiz.length) * 100}%`,
              backgroundColor: isAnswerMode
                ? "#638363"
                : "#806B87",
            },
          ]}
        />
      </View>

      {data.quiz.map((question: any, index: number) => {
        const selected = answers[index];
        const answered = selected !== undefined;

        return (
          <View style={styles.card} key={index}>
            <Text style={styles.questionNumber}>
              QUESTION {String(index + 1).padStart(2, "0")}
            </Text>

            <Text style={styles.question}>
              {question.question}
            </Text>

            {question.options.map(
              (option: string, optionIndex: number) => {
                const isCorrect =
                  optionIndex === question.correctAnswer;

                const isSelected =
                  selected === optionIndex;

                return (
                  <Pressable
                    key={optionIndex}
                    disabled={isAnswerMode || answered}
                    onPress={() =>
                      setAnswers((previous) => ({
                        ...previous,
                        [index]: optionIndex,
                      }))
                    }
                    style={[
                      styles.option,

                      isAnswerMode &&
                        isCorrect &&
                        styles.correct,

                      !isAnswerMode &&
                        isSelected &&
                        styles.selected,

                      !isAnswerMode &&
                        answered &&
                        isCorrect &&
                        styles.correct,

                      !isAnswerMode &&
                        answered &&
                        isSelected &&
                        !isCorrect &&
                        styles.incorrect,
                    ]}
                  >
                    <View style={styles.optionContent}>
                      <View
                        style={[
                          styles.optionLetter,

                          !isAnswerMode &&
                            isSelected &&
                            styles.optionLetterSelected,

                          (isAnswerMode || (answered && isCorrect)) &&
                            isCorrect &&
                            styles.optionLetterCorrect,

                          !isAnswerMode &&
                            answered &&
                            isSelected &&
                            !isCorrect &&
                            styles.optionLetterIncorrect,
                        ]}
                      >
                        <Text style={styles.optionLetterText}>
                          {String.fromCharCode(65 + optionIndex)}
                        </Text>
                      </View>

                      <Text style={styles.optionText}>
                        {option}
                      </Text>

                      {(isAnswerMode || answered) && isCorrect && (
                        <CheckCircle2
                          size={21}
                          color="#638363"
                          strokeWidth={2.2}
                        />
                      )}
                    </View>
                  </Pressable>
                );
              }
            )}

            {(isAnswerMode || answered) && (
              <View
                style={[
                  styles.explanation,
                  isAnswerMode ||
                  selected === question.correctAnswer
                    ? styles.correctExplanation
                    : styles.incorrectExplanation,
                ]}
              >
                <Text style={styles.explanationTitle}>
                  {isAnswerMode
                    ? "Correct answer"
                    : selected === question.correctAnswer
                    ? "Lovely! That's correct"
                    : "A little reminder"}
                </Text>

                <Text style={styles.explanationText}>
                  {question.explanation ||
                    "Review this question and remember the correct answer."}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {!isAnswerMode && allAnswered && (
        <View style={styles.resultCard}>
          <Text style={styles.resultDecoration}>
            ✿  ♡  ✿
          </Text>

          <Text style={styles.resultTitle}>
            Your little achievement
          </Text>

          <Text style={styles.score}>
            {score} / {data.quiz.length}
          </Text>

          <Text style={styles.resultText}>
            {score === data.quiz.length
              ? "Amazing! You know your material so well!"
              : "Good work! Every question is a chance to learn something new."}
          </Text>

          <View style={styles.saveStatus}>
            {saving && (
              <Text style={styles.savingText}>
                Saving your result...
              </Text>
            )}

            {saved && (
              <Text style={styles.savedText}>
                Result saved successfully!
              </Text>
            )}

            {!!saveError && (
              <Text style={styles.errorText}>
                {saveError}
              </Text>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={handleRetry}
          >
            <Text style={styles.retryText}>
              Try again  ↻
            </Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.footer}>
        MADE WITH LOVE  ·  PAWS & PAGES
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#E9DDF2",
    paddingHorizontal: 22,
    paddingTop: 45,
    paddingBottom: 35,
  },

  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },

  navigationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5ECFA",
    borderRadius: 14,
    paddingHorizontal: 17,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#DCCBE7",
  },

  homeButton: {
    backgroundColor: "#E0D1EA",
    borderColor: "#CDB9DC",
  },

  navigationButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },

  navigationButtonText: {
    color: "#493653",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 13,
  },

  emptyContainer: {
    flex: 1,
    backgroundColor: "#E9DDF2",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },

  eyebrow: {
    color: "#806B87",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 11,
    letterSpacing: 2,
  },

  title: {
    color: "#493653",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    marginTop: 17,
  },

  subtitle: {
    color: "#806B87",
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    marginTop: 7,
    marginBottom: 23,
    lineHeight: 22,
  },

  topicCard: {
    backgroundColor: "#F5ECFA",
    borderRadius: 19,
    padding: 17,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#DCCBE7",
  },

  topicLabel: {
    color: "#806B87",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 7,
  },

  topicTitle: {
    color: "#493653",
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
    lineHeight: 23,
  },

  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
  },

  progressText: {
    color: "#806B87",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1.3,
  },

  progressCount: {
    color: "#493653",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 12,
  },

  progressTrack: {
    height: 7,
    backgroundColor: "#DCCBE7",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 24,
  },

  progressFill: {
    height: "100%",
    borderRadius: 10,
  },

  card: {
    backgroundColor: "#F5ECFA",
    borderRadius: 22,
    padding: 20,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: "#DCCBE7",
    shadowColor: "#493653",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },

  questionNumber: {
    color: "#806B87",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 13,
  },

  question: {
    color: "#493653",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 18,
  },

  option: {
    backgroundColor: "#EDE2F3",
    borderWidth: 1,
    borderColor: "#DCCBE7",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  optionLetter: {
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: "#DCCBE7",
    justifyContent: "center",
    alignItems: "center",
  },

  optionLetterSelected: {
    backgroundColor: "#CDB9DC",
  },

  optionLetterCorrect: {
    backgroundColor: "#C9DCC9",
  },

  optionLetterIncorrect: {
    backgroundColor: "#F2D3CC",
  },

  optionLetterText: {
    color: "#493653",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 12,
  },

  selected: {
    borderColor: "#806B87",
    borderWidth: 1.7,
    backgroundColor: "#E7D9EF",
  },

  correct: {
    backgroundColor: "#EAF1E7",
    borderColor: "#A8BDA4",
  },

  incorrect: {
    backgroundColor: "#F9EAE5",
    borderColor: "#D9A69C",
  },

  optionText: {
    flex: 1,
    color: "#594763",
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    lineHeight: 21,
  },

  explanation: {
    padding: 15,
    borderRadius: 14,
    marginTop: 7,
  },

  correctExplanation: {
    backgroundColor: "#EAF1E7",
  },

  incorrectExplanation: {
    backgroundColor: "#F9EAE5",
  },

  explanationTitle: {
    color: "#493653",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 13,
    marginBottom: 6,
  },

  explanationText: {
    color: "#594763",
    fontFamily: "Nunito_400Regular",
    lineHeight: 21,
    fontSize: 13,
  },

  resultCard: {
    backgroundColor: "#F5ECFA",
    padding: 25,
    borderRadius: 23,
    alignItems: "center",
    marginTop: 5,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#DCCBE7",
  },

  resultDecoration: {
    color: "#806B87",
    fontSize: 19,
    marginBottom: 10,
  },

  resultTitle: {
    color: "#493653",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 23,
    textAlign: "center",
  },

  score: {
    color: "#806B87",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 43,
    marginVertical: 12,
  },

  resultText: {
    color: "#594763",
    fontFamily: "Nunito_600SemiBold",
    textAlign: "center",
    lineHeight: 22,
    fontSize: 14,
  },

  saveStatus: {
    marginTop: 16,
    alignItems: "center",
    width: "100%",
  },

  savingText: {
    color: "#806B87",
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    textAlign: "center",
  },

  savedText: {
    color: "#638363",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 13,
    textAlign: "center",
  },

  errorText: {
    color: "#B45F55",
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },

  retryButton: {
    backgroundColor: "#806B87",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 21,
    shadowColor: "#493653",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },

  retryButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },

  retryText: {
    color: "#FFFFFF",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 14,
  },

  body: {
    color: "#806B87",
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    textAlign: "center",
  },

  footer: {
    color: "#806B87",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 9,
    letterSpacing: 1.7,
    textAlign: "center",
    marginTop: 8,
  },
});
