
import { View, Text, StyleSheet } from 'react-native';

export default function AppHomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Paws & Pages! 🐾</Text>
      <Text style={styles.subtitle}>
        Your reading and studying adventure starts here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F1',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#765B53',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 15,
    fontSize: 16,
    color: '#A8877B',
    textAlign: 'center',
  },
});
