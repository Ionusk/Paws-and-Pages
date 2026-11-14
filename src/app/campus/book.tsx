import { View, Text, StyleSheet } from 'react-native';

export default function BookScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Book details</Text>
      <Text style={styles.subtitle}>This page is coming soon!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F1FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#594568',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: '#8B7895',
  },
});