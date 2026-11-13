import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';

export default function ReadingSessionScreen() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [running]);

  const formatTime = () => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds,
    ).padStart(2, '0')}`;
  };

  const finish = () => {
    setRunning(false);

    Alert.alert(
      'Lovely job! 🐾',
      `You spent ${formatTime()} reading!`,
      [
        {
          text: 'Write a review',
          onPress: () => router.push('/reading/review'),
        },
        {
          text: 'Back to reading',
          onPress: () => router.replace('/reading'),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>YOUR LITTLE ESCAPE</Text>
        <Text style={styles.title}>Happy reading! 📖</Text>

        <Text style={styles.dog}>🐶</Text>

        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>TIME SPENT READING</Text>
          <Text style={styles.timer}>{formatTime()}</Text>
          <Text style={styles.timerHint}>
            {running ? 'Enjoy your book ♡' : 'Take your time.'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primary}
          onPress={() => setRunning(!running)}
        >
          <Text style={styles.primaryText}>
            {running ? 'Ⅱ  Pause' : '▶  Start reading'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.finish} onPress={finish}>
          <Text style={styles.finishText}>Finish session</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF8F1' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  back: { color: '#9B8588', position: 'absolute', top: -180 },
  eyebrow: {
    color: '#DDA6AD', fontSize: 10,
    fontWeight: '800', letterSpacing: 2, textAlign: 'center',
  },
  title: {
    color: '#59484C', fontSize: 30,
    fontWeight: '800', textAlign: 'center', marginTop: 12,
  },
  dog: { fontSize: 75, textAlign: 'center', margin: 25 },
  timerCard: {
    backgroundColor: 'white', borderRadius: 25,
    padding: 30, alignItems: 'center',
  },
  timerLabel: {
    color: '#9B8588', fontSize: 10,
    fontWeight: '800', letterSpacing: 2,
  },
  timer: {
    color: '#59484C', fontSize: 65,
    fontWeight: '800', marginVertical: 15,
  },
  timerHint: { color: '#9B8588', fontSize: 13 },
  primary: {
    backgroundColor: '#DDA6AD', padding: 19,
    borderRadius: 18, marginTop: 25,
  },
  primaryText: {
    color: 'white', fontWeight: '800',
    textAlign: 'center', fontSize: 16,
  },
  finish: {
    padding: 18, backgroundColor: '#F4E8ED',
    borderRadius: 18, marginTop: 12,
  },
  finishText: {
    color: '#9B6874', fontWeight: '800', textAlign: 'center',
  },
});