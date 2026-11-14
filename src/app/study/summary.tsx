
import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";

export default function SummaryScreen() {
  const { result } = useLocalSearchParams<{ result?: string }>();

  const data = useMemo(() => {
    try {
      return result ? JSON.parse(result) : null;
    } catch {
      return null;
    }
  }, [result]);

  if (!data) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>No study material yet 🐾</Text>
        <Text style={styles.text}>
          Upload a document to generate your summary.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push("/study/upload")}
        >
          <Text style={styles.buttonText}>Upload material</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>YOUR STUDY NOTES</Text>

      <Text style={styles.title}>{data.title}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📖 Summary</Text>
        <Text style={styles.body}>{data.summary}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>✨ Key concepts</Text>

        {data.keyPoints?.map((point: string, index: number) => (
          <View style={styles.point} key={index}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.body}>{point}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={styles.button}
        onPress={() =>
          router.push({
            pathname: "/study/quiz",
            params: {
              result: JSON.stringify(data),
            },
          } as any)
        }
      >
        <Text style={styles.buttonText}>Take the quiz 🧠</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#FFF8F1",
    padding: 24,
    paddingTop: 55,
  },
  empty: {
    flex: 1,
    backgroundColor: "#FFF8F1",
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },
  eyebrow: {
    color: "#9A806E",
    letterSpacing: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  title: {
    color: "#59483E",
    fontSize: 27,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 22,
    borderRadius: 22,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: "#F0E4DA",
  },
  sectionTitle: {
    color: "#59483E",
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 14,
  },
  body: {
    color: "#78665C",
    fontSize: 15,
    lineHeight: 24,
  },
  point: {
    flexDirection: "row",
    marginBottom: 10,
  },
  bullet: {
    color: "#B98F9C",
    fontSize: 20,
    marginRight: 10,
  },
  button: {
    backgroundColor: "#B98F9C",
    padding: 17,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  text: {
    color: "#78665C",
    textAlign: "center",
  },
});
