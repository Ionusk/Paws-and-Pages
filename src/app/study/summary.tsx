
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
        <Text style={styles.emptyEmoji}>🐾</Text>

        <Text style={styles.emptyTitle}>
          Your study corner is waiting
        </Text>

        <Text style={styles.text}>
          Upload a document to create your own study notes.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.push("/study/upload")}
        >
          <Text style={styles.buttonText}>Upload material  ✿</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>
        PAWS & PAGES  ✿  YOUR STUDY NOTES
      </Text>

      <Text style={styles.title}>{data.title}</Text>

      <Text style={styles.subtitle}>
        Your little collection of things worth remembering ♡
      </Text>

      <View style={styles.decorativeLine}>
        <View style={styles.line} />
        <Text style={styles.decorativeIcon}>✿</Text>
        <View style={styles.line} />
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.iconCircle}>
            <Text style={styles.sectionIcon}>📖</Text>
          </View>

          <View>
            <Text style={styles.sectionTitle}>The summary</Text>
            <Text style={styles.sectionSubtitle}>
              THE BIG PICTURE
            </Text>
          </View>
        </View>

        <Text style={styles.body}>{data.summary}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconCircle, styles.sageCircle]}>
            <Text style={styles.sectionIcon}>✧</Text>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Key concepts</Text>
            <Text style={styles.sectionSubtitle}>
              THINGS TO REMEMBER
            </Text>
          </View>
        </View>

        {data.keyPoints?.map((point: string, index: number) => (
          <View style={styles.point} key={index}>
            <View style={styles.pointNumber}>
              <Text style={styles.pointNumberText}>
                {String(index + 1).padStart(2, "0")}
              </Text>
            </View>

            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
      </View>

      <View style={styles.quizBanner}>
        <Text style={styles.bannerDecoration}>✿  ♡  ✿</Text>

        <Text style={styles.bannerTitle}>
          Ready to test yourself?
        </Text>

        <Text style={styles.bannerText}>
          See how much you've learned with a little practice.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.quizButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() =>
            router.push({
              pathname: "/study/quiz",
              params: {
                result: JSON.stringify(data),
              },
            } as any)
          }
        >
          <Text style={styles.buttonText}>
            Take the quiz  ✧
          </Text>
        </Pressable>
      </View>

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
    paddingTop: 58,
    paddingBottom: 35,
  },

  empty: {
    flex: 1,
    backgroundColor: "#FFF8F1",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },

  emptyEmoji: {
    fontSize: 38,
    marginBottom: 15,
  },

  emptyTitle: {
    color: "#59484C",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 25,
    textAlign: "center",
    marginBottom: 10,
  },

  eyebrow: {
    color: "#A58B7C",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
    letterSpacing: 1.8,
  },

  title: {
    color: "#59484C",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    lineHeight: 39,
    marginTop: 17,
  },

  subtitle: {
    color: "#9B8588",
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 18,
  },

  decorativeLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 22,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#EBD9E0",
  },

  decorativeIcon: {
    color: "#C58F9C",
    fontSize: 17,
  },

  card: {
    backgroundColor: "#FFFFFF",
    padding: 21,
    borderRadius: 22,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: "#F0E4DA",
    shadowColor: "#80675C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },

  iconCircle: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#F4E8ED",
    alignItems: "center",
    justifyContent: "center",
  },

  sageCircle: {
    backgroundColor: "#EAF0E6",
  },

  sectionIcon: {
    fontSize: 19,
    color: "#8E6872",
  },

  sectionTitle: {
    color: "#59484C",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
  },

  sectionSubtitle: {
    color: "#B18E91",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 9,
    letterSpacing: 1.4,
    marginTop: 3,
  },

  body: {
    color: "#78666A",
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    lineHeight: 24,
  },

  point: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },

  pointNumber: {
    width: 27,
    height: 27,
    borderRadius: 10,
    backgroundColor: "#F4E8ED",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },

  pointNumberText: {
    color: "#B77D88",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 10,
  },

  pointText: {
    flex: 1,
    color: "#78666A",
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    lineHeight: 22,
  },

  quizBanner: {
    backgroundColor: "#F4E8ED",
    padding: 23,
    borderRadius: 23,
    alignItems: "center",
    marginTop: 5,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#EBD9E0",
  },

  bannerDecoration: {
    color: "#B77D88",
    fontSize: 19,
    marginBottom: 10,
  },

  bannerTitle: {
    color: "#59484C",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 22,
    textAlign: "center",
  },

  bannerText: {
    color: "#8D777B",
    fontFamily: "Nunito_400Regular",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 5,
  },

  button: {
    backgroundColor: "#DDA6AD",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 19,
    shadowColor: "#B77D88",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.17,
    shadowRadius: 5,
    elevation: 3,
  },

  quizButton: {
    width: "100%",
  },

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },

  buttonText: {
    color: "#FFFFFF",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 14,
  },

  text: {
    color: "#9B8588",
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },

  footer: {
    color: "#B6A196",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 9,
    letterSpacing: 1.7,
    textAlign: "center",
    marginTop: 5,
  },
});
