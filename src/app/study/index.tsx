import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';

const COLORS = {
  bg: '#FFF8F1',
  text: '#59484C',
  muted: '#9B8588',
  pink: '#DDA6AD',
};

const tools = [
  {
    emoji: '📄',
    title: 'PDF Summarizer',
    description: 'Upload your notes and get an easy-to-understand summary.',
    route: '/study/upload',
    color: '#E9E1F1',
  },
  {
    emoji: '🧠',
    title: 'Practice Quiz',
    description: 'Test your knowledge with questions generated from your notes.',
    route: '/study/quiz',
    color: '#DCE6D8',
  },
  {
    emoji: '🎧',
    title: 'Audio Lessons',
    description: 'Turn your study materials into audio lessons.',
    route: '/study/summary',
    color: '#F7E1D5',
  },
];

export default function StudyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>YOUR LEARNING CORNER ✨</Text>
        <Text style={styles.title}>Study time!</Text>
        <Text style={styles.subtitle}>
          Let's make learning a little easier today.
        </Text>

        <View style={styles.mascot}>
          <Text style={{ fontSize: 55 }}>🐶</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.mascotTitle}>Laica says...</Text>
            <Text style={styles.mascotText}>
              You've got this! One page at a time.
            </Text>
          </View>
        </View>

        <Text style={styles.section}>What would you like to do?</Text>

        {tools.map((tool) => (
          <TouchableOpacity
            key={tool.title}
            style={[styles.card, { backgroundColor: tool.color }]}
            onPress={() => router.push(tool.route as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.emoji}>{tool.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{tool.title}</Text>
              <Text style={styles.cardDescription}>
                {tool.description}
              </Text>
              <Text style={styles.open}>Open tool →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: 22, paddingBottom: 40 },
  back: { color: COLORS.muted, fontSize: 14, marginBottom: 28 },
  eyebrow: {
    color: COLORS.pink, fontSize: 10,
    fontWeight: '800', letterSpacing: 2,
  },
  title: {
    color: COLORS.text, fontSize: 34,
    fontWeight: '800', marginTop: 8,
  },
  subtitle: {
    color: COLORS.muted, fontSize: 14,
    marginTop: 8, marginBottom: 25,
  },
  mascot: {
    backgroundColor: '#F4E8ED', borderRadius: 22,
    padding: 18, flexDirection: 'row',
    alignItems: 'center', gap: 15, marginBottom: 30,
  },
  mascotTitle: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  mascotText: { color: COLORS.muted, fontSize: 12, marginTop: 5 },
  section: {
    fontSize: 19, color: COLORS.text,
    fontWeight: '800', marginBottom: 15,
  },
  card: {
    borderRadius: 22, padding: 20,
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 14, gap: 17,
  },
  emoji: { fontSize: 38 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  cardDescription: {
    color: COLORS.muted, fontSize: 12,
    lineHeight: 18, marginTop: 6,
  },
  open: {
    color: '#A66F7A', fontWeight: '800',
    fontSize: 12, marginTop: 10,
  },
});