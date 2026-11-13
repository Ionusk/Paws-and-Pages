import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';

export default function UploadScreen() {
  const [fileName, setFileName] = useState('');

  const choosePDF = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      setFileName(result.assets[0].name);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Upload your notes 📄</Text>
        <Text style={styles.subtitle}>
          Choose a PDF file to start creating your study materials.
        </Text>

        <TouchableOpacity style={styles.upload} onPress={choosePDF}>
          <Text style={{ fontSize: 45 }}>☁️</Text>
          <Text style={styles.uploadTitle}>Choose a PDF</Text>
          <Text style={styles.hint}>Tap here to browse your files</Text>
        </TouchableOpacity>

        {fileName !== '' && (
          <View style={styles.file}>
            <Text style={styles.fileText}>📄 {fileName}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            Alert.alert(
              'PDF selected',
              'The file picker works! Gemini processing will be connected next.',
            )
          }
          disabled={!fileName}
        >
          <Text style={styles.buttonText}>Continue →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF8F1' },
  container: { flex: 1, padding: 22 },
  back: { color: '#9B8588', marginBottom: 35 },
  title: { color: '#59484C', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#9B8588', marginTop: 10, lineHeight: 21 },
  upload: {
    borderWidth: 2, borderColor: '#DDA6AD',
    borderStyle: 'dashed', borderRadius: 25,
    padding: 35, alignItems: 'center', marginTop: 40,
    backgroundColor: '#FDF1F0',
  },
  uploadTitle: {
    color: '#59484C', fontSize: 18,
    fontWeight: '800', marginTop: 15,
  },
  hint: { color: '#9B8588', fontSize: 12, marginTop: 8 },
  file: {
    backgroundColor: 'white', borderRadius: 15,
    padding: 15, marginTop: 20,
  },
  fileText: { color: '#59484C', fontSize: 13 },
  button: {
    backgroundColor: '#DDA6AD', padding: 18,
    borderRadius: 18, marginTop: 25,
  },
  buttonText: {
    color: 'white', textAlign: 'center', fontWeight: '800',
  },
});