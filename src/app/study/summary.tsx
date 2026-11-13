import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';

export default function SummaryScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Your study summary ✨</Text>

        <View style={styles.card}>
          <Text style={styles.emoji}>📝</Text>
          <Text style={styles.heading}>Your notes will appear here.</Text>
          <Text style={styles.description}>
            Once you upload a PDF, Gemini will help turn your materials into
            clear, organized summaries and audio lessons.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/study/upload')}
        >
          <Text style={styles.buttonText}>Upload a PDF →</Text>
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
  card: {
    backgroundColor: '#E9E1F1', borderRadius: 25,
    padding: 25, alignItems: 'center', marginTop: 35,
  },
  emoji: { fontSize: 50 },
  heading: {
    color: '#59484C', fontSize: 19,
    fontWeight: '800', marginTop: 15, textAlign: 'center',
  },
  description: {
    color: '#897C8B', fontSize: 13,
    lineHeight: 21, marginTop: 12, textAlign: 'center',
  },
  button: {
    backgroundColor: '#DDA6AD', padding: 18,
    borderRadius: 18, marginTop: 22,
  },
  buttonText: { color: 'white', fontWeight: '800', textAlign: 'center' },
});