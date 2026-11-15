import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { goBack } from '@/lib/navigation';

export default function FriendsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => goBack('/home')}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>YOUR LITTLE COMMUNITY 💌</Text>
        <Text style={styles.title}>Friends & pages</Text>
        <Text style={styles.subtitle}>
          Share your reading adventures and celebrate each other's progress.
        </Text>

        <View style={styles.hero}>
          <Text style={{ fontSize: 55 }}>🐰💗🐶</Text>
          <Text style={styles.heroTitle}>Better together!</Text>
          <Text style={styles.heroText}>
            Your friends' reading updates and study achievements will appear here.
          </Text>
        </View>

        <Text style={styles.section}>Your community</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => Alert.alert('Coming soon', 'Friend profiles will be available soon!')}
        >
          <Text style={styles.emoji}>👯</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Find friends</Text>
            <Text style={styles.cardText}>Connect with other readers and students.</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => Alert.alert('Coming soon', 'Your friends’ activity will appear here!')}
        >
          <Text style={styles.emoji}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Friends activity</Text>
            <Text style={styles.cardText}>See what your friends are reading and learning.</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => Alert.alert('Coming soon', 'Shared reviews will appear here!')}
        >
          <Text style={styles.emoji}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Shared reviews</Text>
            <Text style={styles.cardText}>Discover what everyone thinks about their books.</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
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
    backgroundColor: '#E9E1F1', borderRadius: 25,
    alignItems: 'center', padding: 25,
  },
  heroTitle: {
    color: '#59484C', fontSize: 22,
    fontWeight: '800', marginTop: 15,
  },
  heroText: {
    color: '#897C8B', fontSize: 13,
    lineHeight: 20, textAlign: 'center', marginTop: 8,
  },
  section: {
    color: '#59484C', fontSize: 19,
    fontWeight: '800', marginTop: 30, marginBottom: 15,
  },
  card: {
    backgroundColor: 'white', borderRadius: 20,
    padding: 18, flexDirection: 'row',
    alignItems: 'center', marginBottom: 12, gap: 14,
  },
  emoji: { fontSize: 30 },
  cardTitle: { color: '#59484C', fontWeight: '800', fontSize: 15 },
  cardText: {
    color: '#9B8588', fontSize: 11,
    lineHeight: 17, marginTop: 5,
  },
  arrow: { color: '#B77D88', fontSize: 22 },
});