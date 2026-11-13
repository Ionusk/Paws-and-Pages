import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { router } from 'expo-router';

export default function CampusScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>THE CAMPUS BOOK CORNER 🏡</Text>
        <Text style={styles.title}>Books bring us together.</Text>
        <Text style={styles.subtitle}>
          Borrow a book, share one with another student and discover your next read.
        </Text>

        <View style={styles.hero}>
          <Text style={{ fontSize: 60 }}>📚</Text>
          <Text style={styles.heroTitle}>A library made by students.</Text>
          <Text style={styles.heroText}>
            Find books available from other students in your university community.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primary}
          onPress={() => Alert.alert('Coming soon', 'The book marketplace is being prepared!')}
        >
          <Text style={styles.primaryText}>🔎  Browse available books</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondary}
          onPress={() => Alert.alert('Coming soon', 'You will be able to list your books here!')}
        >
          <Text style={styles.secondaryText}>＋  Share a book</Text>
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.infoTitle}>A safe student community ♡</Text>
          <Text style={styles.infoText}>
            Only verified university students will be able to participate.
            Personal contact details and meeting arrangements should stay private
            until a borrowing request is accepted.
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
    color: '#59484C', fontSize: 31,
    fontWeight: '800', marginTop: 8,
  },
  subtitle: {
    color: '#9B8588', fontSize: 14,
    lineHeight: 21, marginTop: 8, marginBottom: 25,
  },
  hero: {
    backgroundColor: '#DCE6D8', borderRadius: 25,
    alignItems: 'center', padding: 25,
  },
  heroTitle: {
    color: '#59484C', fontSize: 21,
    fontWeight: '800', textAlign: 'center', marginTop: 15,
  },
  heroText: {
    color: '#788477', fontSize: 13,
    lineHeight: 20, textAlign: 'center', marginTop: 8,
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
    backgroundColor: 'white', padding: 19,
    borderRadius: 18, marginTop: 12,
  },
  secondaryText: {
    color: '#9B6874', fontWeight: '800', textAlign: 'center',
  },
  info: {
    backgroundColor: '#F4E8ED', borderRadius: 20,
    padding: 20, marginTop: 28,
  },
  infoTitle: { color: '#59484C', fontWeight: '800', fontSize: 15 },
  infoText: {
    color: '#897C80', fontSize: 12,
    lineHeight: 19, marginTop: 8,
  },
});