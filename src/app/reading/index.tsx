import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';

export default function ReadingScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>YOUR READING CORNER 📖</Text>
        <Text style={styles.title}>Time to get cozy.</Text>
        <Text style={styles.subtitle}>
          Pick up your book and let yourself get lost in another world.
        </Text>

        <View style={styles.hero}>
          <Text style={{ fontSize: 65 }}>📚</Text>
          <Text style={styles.heroTitle}>A little reading goes a long way.</Text>
          <Text style={styles.heroText}>
            Your next favorite chapter is waiting for you.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primary}
          onPress={() => router.push('/reading/session')}
        >
          <Text style={styles.primaryText}>♡ Start a reading session</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          onPress={() => router.push('/reading/review')}
        >
          <Text style={styles.secondaryText}>Write a book review →</Text>
        </TouchableOpacity>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Laica's little reminder 🐾</Text>
          <Text style={styles.noteText}>
            You don't have to finish a book today. Just enjoy the pages.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF8F1' },
  container: { padding: 22, paddingBottom: 40 },
  back: { color: '#9B8588', marginBottom: 28 },
  eyebrow: {
    color: '#DDA6AD', fontSize: 10,
    fontWeight: '800', letterSpacing: 2,
  },
  title: {
    color: '#59484C', fontSize: 32,
    fontWeight: '800', marginTop: 8,
  },
  subtitle: {
    color: '#9B8588', fontSize: 14,
    lineHeight: 21, marginTop: 8, marginBottom: 25,
  },
  hero: {
    backgroundColor: '#F7E1D5', borderRadius: 25,
    alignItems: 'center', padding: 28,
  },
  heroTitle: {
    color: '#59484C', fontSize: 21,
    fontWeight: '800', textAlign: 'center', marginTop: 15,
  },
  heroText: {
    color: '#9B8588', textAlign: 'center',
    fontSize: 13, marginTop: 10, lineHeight: 20,
  },
  primary: {
    backgroundColor: '#DDA6AD', padding: 19,
    borderRadius: 18, marginTop: 22,
  },
  primaryText: {
    color: 'white', fontWeight: '800',
    textAlign: 'center', fontSize: 15,
  },
  secondary: {
    backgroundColor: 'white', padding: 18,
    borderRadius: 18, marginTop: 12,
  },
  secondaryText: {
    color: '#9B6874', fontWeight: '800', textAlign: 'center',
  },
  note: {
    backgroundColor: '#DCE6D8', padding: 20,
    borderRadius: 20, marginTop: 28,
  },
  noteTitle: { color: '#59484C', fontWeight: '800', fontSize: 15 },
  noteText: {
    color: '#786D6E', fontSize: 13,
    lineHeight: 20, marginTop: 8,
  },
});