import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';

const COLORS = {
  background: '#FFF8F1',
  pink: '#DDA6AD',
  darkPink: '#B77D88',
  text: '#59484C',
  muted: '#9B8588',
  white: '#FFFFFF',
  sage: '#DCE6D8',
  lavender: '#E9E1F1',
  peach: '#F7E1D5',
};

function FeatureCard({
  emoji,
  title,
  description,
  color,
  onPress,
}: {
  emoji: string;
  title: string;
  description: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.featureCard, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
      <Text style={styles.arrow}>Explore →</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>paws & pages 🐾</Text>
            <Text style={styles.subtitle}>Your cozy little space</Text>
          </View>

          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push('/friends')}
          >
            <Text style={styles.avatarText}>🐶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.welcomeSmall}>HELLO, BOOKWORM!</Text>
            <Text style={styles.welcomeTitle}>
              Ready for a little adventure?
            </Text>
            <Text style={styles.welcomeDescription}>
              Learn something new, read a few pages and enjoy your day with Laica.
            </Text>
          </View>
          <Text style={styles.dog}>🐕</Text>
        </View>

        <Text style={styles.sectionTitle}>Your little world ✨</Text>

        <View style={styles.grid}>
          <FeatureCard
            emoji="📚"
            title="Study"
            description="Learn smarter, not harder."
            color={COLORS.lavender}
            onPress={() => router.push('/study')}
          />

          <FeatureCard
            emoji="📖"
            title="Reading"
            description="Your next reading adventure."
            color={COLORS.peach}
            onPress={() => router.push('/reading')}
          />

          <FeatureCard
            emoji="💌"
            title="Friends"
            description="Share your little victories."
            color={COLORS.sage}
            onPress={() => router.push('/friends')}
          />

          <FeatureCard
            emoji="🏡"
            title="Campus Books"
            description="Borrow and share books."
            color="#F4E8ED"
            onPress={() => router.push('/campus')}
          />
        </View>

        <Text style={styles.sectionTitle}>Your progress 🌷</Text>

        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statEmoji}>📕</Text>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Books read</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statEmoji}>⏰</Text>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Study hours</Text>
          </View>

          <View style={styles.stat}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quote}>
            "A little progress each day adds up to big results."
          </Text>
          <Text style={styles.quoteAuthor}>— Laica's reminder 🐾</Text>
        </View>

        <Text style={styles.footer}>Made with love, paws and pages ♡</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 22,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  logo: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 13,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 26,
  },
  welcomeCard: {
    backgroundColor: COLORS.pink,
    borderRadius: 25,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  welcomeSmall: {
    color: '#FFF8F1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
  },
  welcomeTitle: {
    fontSize: 23,
    color: '#FFFFFF',
    fontWeight: '800',
    lineHeight: 29,
  },
  welcomeDescription: {
    color: '#FFF8F1',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
  },
  dog: {
    fontSize: 55,
    marginLeft: 5,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  featureCard: {
    width: '48%',
    minHeight: 170,
    borderRadius: 22,
    padding: 16,
    marginBottom: 13,
  },
  featureEmoji: {
    fontSize: 30,
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  featureDescription: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 6,
    lineHeight: 16,
  },
  arrow: {
    color: COLORS.darkPink,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
  },
  statsContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 17,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 25,
  },
  stat: {
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 23,
    marginBottom: 7,
  },
  statNumber: {
    fontSize: 22,
    color: COLORS.text,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 4,
  },
  quoteCard: {
    backgroundColor: '#F3E9E8',
    borderRadius: 20,
    padding: 20,
  },
  quote: {
    fontSize: 15,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 23,
  },
  quoteAuthor: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 10,
    textAlign: 'right',
  },
  footer: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 28,
  },
});