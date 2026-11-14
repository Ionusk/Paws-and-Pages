
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";

const API_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:3001"
    : "http://localhost:3001";

const FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/*",
];

function getMimeType(filename: string) {
  const extension = filename.toLowerCase().split(".").pop();

  const types: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    gif: "image/gif",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
    avif: "image/avif",
  };

  return types[extension || ""] || "application/octet-stream";
}

export default function UploadScreen() {
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState("");

  async function selectFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: FILE_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      setFilename(file.name);

      await uploadFile(file);
    } catch (error: any) {
      console.error("Selection error:", error);

      Alert.alert(
        "Ups!",
        error.message || "Nu am putut selecta fișierul."
      );
    }
  }

  async function uploadFile(
    file: DocumentPicker.DocumentPickerAsset
  ) {
    setLoading(true);

    try {
      const formData = new FormData();

      if (Platform.OS === "web") {
        // Browser: trimitem obiectul File propriu-zis.
        if (!file.file) {
          throw new Error(
            "Browserul nu a furnizat fișierul. Încearcă să îl selectezi din nou."
          );
        }

        formData.append("file", file.file, file.name);
      } else {
        // Android / iOS: trimitem URI-ul local.
        formData.append(
          "file",
          {
            uri: file.uri,
            name: file.name,
            type: file.mimeType || getMimeType(file.name),
          } as any
        );
      }

      console.log("Uploading:", file.name);
      console.log("Platform:", Platform.OS);

      const response = await fetch(
        `${API_URL}/api/study/generate`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Nu am putut procesa materialul."
        );
      }

      console.log("Gemini response:", data);

      router.push({
        pathname: "/study/summary",
        params: {
          result: JSON.stringify(data),
        },
      } as any);
    } catch (error: any) {
      console.error("Upload error:", error);

      Alert.alert(
        "Nu am putut genera materialul",
        error.message ||
          "Verifică dacă backend-ul este pornit și încearcă din nou."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>
        PAWS & PAGES • STUDY
      </Text>

      <Text style={styles.title}>
        Let's study together! 🐾
      </Text>

      <Text style={styles.description}>
        Încarcă-ți cursurile, iar Laica te ajută să le transformi
        în rezumate și quiz-uri.
      </Text>

      <View style={styles.uploadCard}>
        <Text style={styles.documentIcon}>📚</Text>

        <Text style={styles.cardTitle}>
          Your study material
        </Text>

        <Text style={styles.cardDescription}>
          PDF, Word, PowerPoint sau fotografii cu notițele tale.
        </Text>

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={selectFile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              Choose a file
            </Text>
          )}
        </Pressable>

        {!!filename && (
          <Text style={styles.filename}>
            Selected: {filename}
          </Text>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          What will you get?
        </Text>

        <Text style={styles.infoText}>
          ✨ A structured summary
        </Text>
        <Text style={styles.infoText}>
          📖 Important concepts
        </Text>
        <Text style={styles.infoText}>
          🧠 A quiz with 5 questions
        </Text>
        <Text style={styles.infoText}>
          💡 Explanations for answers
        </Text>
      </View>
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
  eyebrow: {
    color: "#9A806E",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    color: "#59483E",
    fontSize: 29,
    fontWeight: "800",
    marginTop: 14,
  },
  description: {
    color: "#8C7A70",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    marginBottom: 28,
  },
  uploadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0E4DA",
  },
  documentIcon: {
    fontSize: 45,
    marginBottom: 15,
  },
  cardTitle: {
    color: "#59483E",
    fontSize: 21,
    fontWeight: "700",
  },
  cardDescription: {
    color: "#9A8A80",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 9,
    marginBottom: 22,
  },
  button: {
    backgroundColor: "#B98F9C",
    paddingVertical: 15,
    paddingHorizontal: 35,
    borderRadius: 18,
    minWidth: 180,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  filename: {
    color: "#8C7A70",
    fontSize: 12,
    marginTop: 15,
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: "#F2EAE2",
    padding: 22,
    borderRadius: 22,
    marginTop: 22,
  },
  infoTitle: {
    color: "#59483E",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 14,
  },
  infoText: {
    color: "#78665C",
    fontSize: 14,
    marginVertical: 5,
  },
});
