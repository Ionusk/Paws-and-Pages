import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';

export default function ReviewScreen() {
  const [book, setBook] = useState('');
  const [review, setReview] = useState('');
  const [rating, setRating] = useState(0);

  const submitReview = () => {
    if (!book.trim() || !review.trim() || rating === 0) {
      Alert.alert('Almost there!', 'Add a book title, review and rating.');
      return;
    }

    Alert.alert(
      'Lovely review! 💗',
      'Your review has been created locally. Connecting it to your friends feed comes next.',
      [{ text: 'Done', onPress: () => router.replace('/reading') }],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Your book thoughts 💌</Text>
        <Text style={styles.subtitle}>
          Every book leaves a little something behind.
        </Text>

        <Text style={styles.label}>BOOK TITLE</Text>
        <TextInput
          style={styles.input}
          placeholder="What did you read?"
          placeholderTextColor="#B7A5A7"
          value={book}
          onChangeText={setBook}
        />

        <Text style={styles.label}>YOUR RATING</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRating(star)}>
              <Text style={{ fontSize: 35 }}>
                {star <= rating ? '⭐' : '☆'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>YOUR REVIEW</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Tell us what you thought about this book..."
          placeholderTextColor="#B7A5A7"
          multiline
          textAlignVertical="top"
          value={review}
          onChangeText={setReview}
        />

        <TouchableOpacity style={styles.button} onPress={submitReview}>
          <Text style={styles.buttonText}>Save my review ♡</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF8F1' },
  container: { flex: 1, padding: 22 },
  back: { color: '#9B8588', marginBottom: 28 },
  title: { color: '#59484C', fontSize: 27, fontWeight: '800' },
  subtitle: { color: '#9B8588', marginTop: 8, marginBottom: 25 },
  label: {
    color: '#9B8588', fontSize: 10,
    fontWeight: '800', letterSpacing: 1.5, marginBottom: 10,
    marginTop: 18,
  },
  input: {
    backgroundColor: 'white', borderRadius: 15,
    padding: 16, color: '#59484C', fontSize: 14,
  },
  stars: { flexDirection: 'row', gap: 12 },
  textArea: { height: 150 },
  button: {
    backgroundColor: '#DDA6AD', padding: 18,
    borderRadius: 18, marginTop: 25,
  },
  buttonText: {
    color: 'white', fontWeight: '800', textAlign: 'center',
  },
});