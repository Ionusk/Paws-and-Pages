
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedMascot } from '../components/AnimatedMascot';

export default function HomeScreen() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>PAWS & PAGES</Text>
          <Text style={styles.logoSubtitle}>
            A little world of learning and stories
          </Text>
        </View>

        {/* Mascota Laica */}
        <View style={styles.mascotContainer}>
          <AnimatedMascot animation="original" />
        </View>

        {/* Text introductiv */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            Your little corner
          </Text>

          <Text style={styles.titleAccent}>
            for big adventures
          </Text>

          <Text style={styles.description}>
            Read a little. Learn a lot.
            {'\n'}
            Dream without limits.
          </Text>
        </View>

        {/* Buton */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => router.replace('/home')}
        >
          <Text style={styles.buttonText}>
            Let's beginnnnnnnnnn!
          
          </Text>
          <Text style={styles.buttonIcon}>♡</Text>
        </Pressable>

        {/* Footer */}
        <Text style={styles.footer}>
          Made with love, paws and pages ♡
        </Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF8F1',
  },

  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },

  header: {
    alignItems: 'center',
  },

  logo: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 3,
    color: '#806A70',
  },

  logoSubtitle: {
    fontSize: 13,
    letterSpacing: 1,
    color: '#B18F94',
    marginTop: 8,
  },

  mascotContainer: {
    width: '100%',
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textContainer: {
    alignItems: 'center',
  },

  title: {
    fontSize: 27,
    fontWeight: '600',
    color: '#806A70',
  },

  titleAccent: {
    fontSize: 27,
    fontWeight: '700',
    color: '#D28F9D',
    marginTop: 3,
  },

  description: {
    fontSize: 15,
    lineHeight: 24,
    color: '#9D8588',
    textAlign: 'center',
    marginTop: 15,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DDA6AD',
    paddingVertical: 16,
    paddingHorizontal: 42,
    borderRadius: 30,
    minWidth: 210,
    elevation: 3,
  },

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  buttonIcon: {
    color: '#FFFFFF',
    fontSize: 21,
    marginLeft: 10,
  },

  footer: {
    fontSize: 12,
    color: '#B69B9D',
  },
});
