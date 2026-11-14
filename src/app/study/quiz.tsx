
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
} from "react-native";

import {
  useLocalSearchParams,
  router,
} from "expo-router";

import { useAuth0 } from "react-native-auth0";

const API_URL = "http://localhost:3001";
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
        onPress={() => router.back()}
      >
        <Text style={styles.navigationButtonText}>← Back</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.navigationButton,
          styles.homeButton,
          pressed && styles.navigationButtonPressed,
        ]}
        onPress={() => router.replace("/home")}
      >
        <Text style={styles.navigationButtonText}>⌂ Home</Text>
      </Pressable>
    </View>
  );
}

export default function QuizScreen() {
  const { result } = useLocalSearchParams<{
    result?: string;
  }>();

  const { getCredentials } = useAuth0();

  const data = useMemo(() => {
    
    try {
      return result ? JSON.parse(result) : null;
    } catch {
      return null;
    }
  }, [result]);

  console.log("DATE QUIZ:", data);
console.log("QUIZ ID:", data?.quizId);

  const [answers, setAnswers] = useState<
    Record<number, number>
  >({});

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Previne salvarea de mai multe ori pentru aceeași încercare.
  const saveAttemptRef = useRef(false);

  // Identifică încercarea curentă, inclusiv după Try again.
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
    if (!allAnswered || !data?.quizId) {
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

        console.log("Se salvează rezultatul quizului...");

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

        console.log(
          "Rezultat salvat în TigerData:",
          responseData.result
        );

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
  }, [allAnswered, data, answers, getCredentials]);

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

        <Text style={styles.emptyEmoji}>🐾</Text>

        <Text style={styles.title}>
          No quiz available
        </Text>

        <Text style={styles.body}>
          Generate a study material first.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <TopNavigation />

      <Text style={styles.eyebrow}>
        PAWS & PAGES  ✿  STUDY TIME
      </Text>

      <Text style={styles.title}>
        Test your knowledge
      </Text>

      <Text style={styles.subtitle}>
        A little practice goes a long way ♡
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
          YOUR QUESTIONS
        </Text>

        <Text style={styles.progressCount}>
          {Object.keys(answers).length} / {data.quiz.length}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${
                (Object.keys(answers).length / data.quiz.length) * 100
              }%`,
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
              QUESTION {String(index + 1).padStart(2, "0")}  ✿
            </Text>

            <Text style={styles.question}>
              {question.question}
            </Text>

            {question.options.map(
              (option: string, optionIndex: number) => {
                const isCorrect =
                  optionIndex === question.correctAnswer;

                const isSelected = selected === optionIndex;

                return (
                  <Pressable
                    key={optionIndex}
                    disabled={answered}
                    onPress={() =>
                      setAnswers((previous) => ({
                        ...previous,
                        [index]: optionIndex,
                      }))
                    }
                    style={[
                      styles.option,
                      isSelected && styles.selected,
                      answered && isCorrect && styles.correct,
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
                          isSelected && styles.optionLetterSelected,
                          answered &&
                            isCorrect &&
                            styles.optionLetterCorrect,
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
                    </View>
                  </Pressable>
                );
              }
            )}

            {answered && (
              <View
                style={[
                  styles.explanation,
                  selected === question.correctAnswer
                    ? styles.correctExplanation
                    : styles.incorrectExplanation,
                ]}
              >
                <Text style={styles.explanationTitle}>
                  {selected === question.correctAnswer
                    ? "Lovely! That's correct ♡"
                    : "A little reminder ✿"}
                </Text>

                <Text style={styles.explanationText}>
                  {question.explanation}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {allAnswered && (
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
                ✓ Result saved successfully!
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
        MADE WITH LOVE  ♡  PAWS & PAGES
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#FFF8F1",
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
    backgroundColor: "#F4E8ED",
    borderRadius: 14,
    paddingHorizontal: 17,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#EBD9E0",
  },

  homeButton: {
    backgroundColor: "#EAEFE6",
    borderColor: "#DCE6D8",
  },

  navigationButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },

  navigationButtonText: {
    color: "#8E6872",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 13,
  },

  emptyContainer: {
    flex: 1,
    backgroundColor: "#FFF8F1",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },

  emptyEmoji: {
    fontSize: 38,
    marginBottom: 14,
  },

  eyebrow: {
    color: "#A58B7C",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 11,
    letterSpacing: 2,
  },

  title: {
    color: "#59484C",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    marginTop: 17,
  },

  subtitle: {
    color: "#9B8588",
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    marginTop: 7,
    marginBottom: 23,
  },

  topicCard: {
    backgroundColor: "#F4E8ED",
    borderRadius: 19,
    padding: 17,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#EBD9E0",
  },

  topicLabel: {
    color: "#B77D88",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 7,
  },

  topicTitle: {
    color: "#59484C",
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
    color: "#9B8588",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1.3,
  },

  progressCount: {
    color: "#B77D88",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 12,
  },

  progressTrack: {
    height: 7,
    backgroundColor: "#F0E4E5",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 24,
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#DDA6AD",
    borderRadius: 10,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: "#F0E4DA",
    shadowColor: "#80675C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.055,
    shadowRadius: 10,
    elevation: 2,
  },

  questionNumber: {
    color: "#B77D88",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 13,
  },

  question: {
    color: "#59484C",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 18,
  },

  option: {
    backgroundColor: "#FFF9F5",
    borderWidth: 1,
    borderColor: "#F0E4DA",
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
    backgroundColor: "#F4E8ED",
    justifyContent: "center",
    alignItems: "center",
  },

  optionLetterSelected: {
    backgroundColor: "#EBD0D8",
  },

  optionLetterCorrect: {
    backgroundColor: "#C9DCC9",
  },

  optionLetterIncorrect: {
    backgroundColor: "#F2D3CC",
  },

  optionLetterText: {
    color: "#8E6872",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 12,
  },

  selected: {
    borderColor: "#DDA6AD",
    borderWidth: 1.7,
    backgroundColor: "#FDF4F5",
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
    color: "#78666A",
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
    backgroundColor: "#EFF4EC",
  },

  incorrectExplanation: {
    backgroundColor: "#F9EFEB",
  },

  explanationTitle: {
    color: "#59484C",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 13,
    marginBottom: 6,
  },

  explanationText: {
    color: "#78666A",
    fontFamily: "Nunito_400Regular",
    lineHeight: 21,
    fontSize: 13,
  },

  resultCard: {
    backgroundColor: "#F4E8ED",
    padding: 25,
    borderRadius: 23,
    alignItems: "center",
    marginTop: 5,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#EBD9E0",
  },

  resultDecoration: {
    color: "#B77D88",
    fontSize: 19,
    marginBottom: 10,
  },

  resultTitle: {
    color: "#59484C",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 23,
    textAlign: "center",
  },

  score: {
    color: "#B77D88",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 43,
    marginVertical: 12,
  },

  resultText: {
    color: "#78666A",
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
    color: "#9B8588",
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
    backgroundColor: "#DDA6AD",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 21,
    shadowColor: "#B77D88",
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
    color: "#9B8588",
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    textAlign: "center",
  },

  footer: {
    color: "#B6A196",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 9,
    letterSpacing: 1.7,
    textAlign: "center",
    marginTop: 8,
  },
});
