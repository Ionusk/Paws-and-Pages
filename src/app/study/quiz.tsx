import { router, useLocalSearchParams } from "expo-router";
import {
    ArrowLeft,
    CheckCircle2,
    FileUp,
    House,
    PawPrint,
} from "lucide-react-native";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ComponentRef,
} from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

import { Notice } from "@/components/ui/feedback";
import { COMPACT_BREAKPOINT } from "@/constants/palette";
import { getErrorMessage, useApi } from "@/lib/api";
import { goBack } from "@/lib/navigation";

function TopNavigation() {
  return (
    <View style={styles.navigation}>
      <Pressable
        style={({ pressed }) => [
          styles.navigationButton,
          pressed && styles.navigationButtonPressed,
        ]}
        onPress={() => goBack("/study")}
        accessibilityRole="button"
        accessibilityLabel="Go back"
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
        accessibilityRole="button"
        accessibilityLabel="Go to home"
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

  const { request } = useApi();
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  // `data` must be declared before isAnswerMode.
  const data = useMemo(() => {
    try {
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error("Could not read the quiz data:", error);
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

  // One save per attempt. attemptRef changes when the user restarts the
  // quiz, so late responses from an older attempt are ignored.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const saveAttemptRef = useRef(false);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const requestRef = useRef(request);

  useEffect(() => {
    requestRef.current = request;
  }, [request]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const canSave = !isAnswerMode && !!data?.quizId;

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

  const saveResult = useCallback(
    async (currentAnswers: Record<number, number>) => {
      if (!canSave || saveAttemptRef.current) {
        return;
      }

      saveAttemptRef.current = true;

      const currentAttempt = attemptRef.current;
      const isCurrent = () =>
        mountedRef.current && attemptRef.current === currentAttempt;

      try {
        setSaving(true);
        setSaved(false);
        setSaveError("");

        const answersPayload = data.quiz.map(
          (_: any, questionIndex: number) => ({
            questionIndex,
            selectedAnswer: currentAnswers[questionIndex],
          })
        );

        await requestRef.current("/api/study/quiz-results", {
          method: "POST",
          body: JSON.stringify({
            quizId: Number(data.quizId),
            answers: answersPayload,
          }),
        });

        if (isCurrent()) {
          setSaved(true);
          setSaveError("");
        }
      } catch (error) {
        console.error("Could not save the quiz result:", error);

        if (isCurrent()) {
          // Allow the user to retry saving this same attempt.
          saveAttemptRef.current = false;
          setSaveError(
            getErrorMessage(
              error,
              "Something went wrong while saving your result."
            )
          );
        }
      } finally {
        if (isCurrent()) {
          setSaving(false);
        }
      }
    },
    [canSave, data]
  );

  // Save automatically as soon as the last question is answered.
  // Retries after a failed save are manual.
  const handleAnswer = (questionIndex: number, optionIndex: number) => {
    const nextAnswers = { ...answers, [questionIndex]: optionIndex };
    setAnswers(nextAnswers);

    const complete =
      !!data?.quiz?.length &&
      data.quiz.every(
        (_: any, index: number) => nextAnswers[index] !== undefined
      );

    if (complete) {
      saveResult(nextAnswers);
    }
  };

  const handleRetry = () => {
    attemptRef.current += 1;
    saveAttemptRef.current = false;

    setAnswers({});
    setSaving(false);
    setSaved(false);
    setSaveError("");

    // Bring the first question back into view.
    scrollRef.current?.scrollTo({ y: 0, animated: true });
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
          Upload a study material first and Laica will prepare a quiz for you.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            styles.emptyButton,
            pressed && styles.retryButtonPressed,
          ]}
          onPress={() => router.push("/study/upload")}
          accessibilityRole="button"
        >
          <FileUp size={16} color="#FFFFFF" />
          <Text style={styles.retryText}>Upload material</Text>
        </Pressable>
      </View>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[
        styles.container,
        isCompact && styles.containerCompact,
      ]}
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
          {data.title || data.fileName || "Study material"}
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
        const options: string[] = Array.isArray(question.options)
          ? question.options
          : [];

        return (
          <View style={styles.card} key={index}>
            <Text style={styles.questionNumber}>
              QUESTION {String(index + 1).padStart(2, "0")}
            </Text>

            <Text style={styles.question}>
              {question.question}
            </Text>

            {options.map(
              (option: string, optionIndex: number) => {
                const isCorrect =
                  optionIndex === question.correctAnswer;

                const isSelected =
                  selected === optionIndex;

                const letter = String.fromCharCode(65 + optionIndex);

                return (
                  <Pressable
                    key={optionIndex}
                    disabled={isAnswerMode || answered}
                    onPress={() => handleAnswer(index, optionIndex)}
                    accessibilityRole="button"
                    accessibilityLabel={`Option ${letter}: ${option}`}
                    accessibilityState={{
                      disabled: isAnswerMode || answered,
                      selected: isSelected,
                    }}
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
                          {letter}
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
            {!canSave && (
              <Notice
                tone="info"
                message="This quiz isn't linked to your library, so this result won't be saved."
              />
            )}

            {saving && (
              <Text style={styles.savingText}>
                Saving your result...
              </Text>
            )}

            {saved && (
              <Notice tone="success" message="Result saved successfully!" />
            )}

            {!!saveError && !saving && (
              <Notice
                tone="error"
                title="Your result wasn't saved"
                message={saveError}
                actionLabel="Save again"
                onAction={() => saveResult(answers)}
              />
            )}
          </View>

          <View style={styles.resultActions}>
            <Pressable
              style={({ pressed }) => [
                styles.retryButton,
                styles.resultActionButton,
                pressed && styles.retryButtonPressed,
              ]}
              onPress={handleRetry}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Try the quiz again"
              accessibilityState={{ disabled: saving }}
            >
              <Text style={styles.retryText}>
                Try again  ↻
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.retryButton,
                styles.resultActionButton,
                styles.studyButton,
                pressed && styles.retryButtonPressed,
              ]}
              onPress={() => router.dismissTo("/study")}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Back to your study space"
              accessibilityState={{ disabled: saving }}
            >
              <Text style={[styles.retryText, styles.studyButtonText]}>
                Back to Study
              </Text>
            </Pressable>
          </View>
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

  containerCompact: {
    paddingHorizontal: 16,
    paddingTop: 32,
  },

  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
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
    minHeight: 42,
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

  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    alignItems: "stretch",
    width: "100%",
    gap: 10,
  },

  savingText: {
    color: "#806B87",
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    textAlign: "center",
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

  resultActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginTop: 21,
  },

  resultActionButton: {
    marginTop: 0,
    minWidth: 160,
    alignItems: "center",
  },

  studyButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7D9EE",
  },

  studyButtonText: {
    color: "#493653",
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
    marginTop: 8,
    maxWidth: 380,
    lineHeight: 21,
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
