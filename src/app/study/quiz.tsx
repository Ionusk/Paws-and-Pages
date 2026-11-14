
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function QuizScreen() {
  const { result } = useLocalSearchParams<{ result?: string }>();

  const data = useMemo(() => {
    try {
      return result ? JSON.parse(result) : null;
    } catch {
      return null;
    }
  }, [result]);

  const [answers, setAnswers] = useState<Record<number, number>>({});

  if (!data?.quiz?.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No quiz available 🐾</Text>
        <Text style={styles.body}>
          Generate a study material first.
        </Text>
      </View>
    );
  }

  const score = data.quiz.reduce(
    (total: number, question: any, index: number) =>
      total +
      (answers[index] === question.correctAnswer ? 1 : 0),
    0
  );

  const allAnswered = data.quiz.every(
    (_: any, index: number) => answers[index] !== undefined
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>PAWS & PAGES • QUIZ</Text>

      <Text style={styles.title}>Test your knowledge! 🧠</Text>

      <Text style={styles.subtitle}>
        {data.title}
      </Text>

      {data.quiz.map((question: any, index: number) => {
        const selected = answers[index];
        const answered = selected !== undefined;

        return (
          <View style={styles.card} key={index}>
            <Text style={styles.questionNumber}>
              QUESTION {index + 1}
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
                    <Text style={styles.optionText}>
                      {String.fromCharCode(65 + optionIndex)}.{" "}
                      {option}
                    </Text>
                  </Pressable>
                );
              }
            )}

            {answered && (
              <View style={styles.explanation}>
                <Text style={styles.explanationTitle}>
                  {selected === question.correctAnswer
                    ? "✨ Correct answer!"
                    : "💡 Not quite!"}
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
          <Text style={styles.resultTitle}>Your result 🐾</Text>

          <Text style={styles.score}>
            {score} / {data.quiz.length}
          </Text>

          <Text style={styles.resultText}>
            {score === data.quiz.length
              ? "Amazing! You know your material!"
              : "Good work! Review the explanations and try again."}
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={() => setAnswers({})}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#FFF8F1",
    padding: 22,
    paddingTop: 55,
  },
  eyebrow: {
    color: "#9A806E",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    color: "#59483E",
    fontSize: 27,
    fontWeight: "800",
    marginTop: 14,
  },
  subtitle: {
    color: "#9A806E",
    fontSize: 15,
    marginTop: 8,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#F0E4DA",
  },
  questionNumber: {
    color: "#B98F9C",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  question: {
    color: "#59483E",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: 17,
  },
  option: {
    backgroundColor: "#FFF8F1",
    borderWidth: 1,
    borderColor: "#F0E4DA",
    borderRadius: 13,
    padding: 14,
    marginBottom: 9,
  },
  selected: {
    borderColor: "#B98F9C",
    borderWidth: 2,
  },
  correct: {
    backgroundColor: "#E5F0E5",
    borderColor: "#8BA98C",
  },
  incorrect: {
    backgroundColor: "#F9E6E3",
    borderColor: "#D99A91",
  },
  optionText: {
    color: "#78665C",
    fontSize: 14,
    lineHeight: 21,
  },
  explanation: {
    backgroundColor: "#F2EAE2",
    padding: 14,
    borderRadius: 13,
    marginTop: 8,
  },
  explanationTitle: {
    color: "#59483E",
    fontWeight: "700",
    marginBottom: 6,
  },
  explanationText: {
    color: "#78665C",
    lineHeight: 21,
    fontSize: 13,
  },
  resultCard: {
    backgroundColor: "#F2EAE2",
    padding: 25,
    borderRadius: 22,
    alignItems: "center",
    marginBottom: 25,
  },
  resultTitle: {
    color: "#59483E",
    fontSize: 20,
    fontWeight: "700",
  },
  score: {
    color: "#B98F9C",
    fontSize: 42,
    fontWeight: "800",
    marginVertical: 12,
  },
  resultText: {
    color: "#78665C",
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: "#B98F9C",
    paddingHorizontal: 30,
    paddingVertical: 13,
    borderRadius: 15,
    marginTop: 20,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  body: {
    color: "#78665C",
  },
});
