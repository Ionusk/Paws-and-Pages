import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { router } from 'expo-router';

export default function QuizScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Practice quiz 🧠</Text>

        <View style={styles.card}>
          <Text style={{ fontSize: 50 }}>🌷</Text>
          <Text style={styles.heading}>Ready to test yourself?</Text>
          <Text style={styles.description}>
            Upload your study materials and generate a quiz with questions
            based on your notes.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/study/upload')}
        >
          <Text style={styles.buttonText}>Choose study material →</Text>
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
    backgroundColor: '#DCE6D8', borderRadius: 25,
    padding: 28, alignItems: 'center', marginTop: 35,
  },
  heading: {
    color: '#59484C', fontSize: 20,
    fontWeight: '800', marginTop: 15, textAlign: 'center',
  },
  description: {
    color: '#788477', fontSize: 13,
    lineHeight: 21, marginTop: 12, textAlign: 'center',
  },
  button: {
    backgroundColor: '#DDA6AD', padding: 18,
    borderRadius: 18, marginTop: 22,
  },
  buttonText: { color: 'white', fontWeight: '800', textAlign: 'center' },
});