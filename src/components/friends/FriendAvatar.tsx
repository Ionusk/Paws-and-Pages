import { StyleSheet, Text, View } from 'react-native';

import { FONT } from '@/constants/palette';

// Pastel pairs (background, letter) from the app palette.
const SWATCHES = [
  ['#F5ECFA', '#9B829F'],
  ['#FFF0F2', '#B77D88'],
  ['#DCE6D8', '#71866F'],
  ['#F7E1D5', '#A77C6C'],
  ['#E9DDF2', '#493653'],
] as const;

/** Same username, same color, on every device. */
function swatchFor(username: string) {
  let hash = 0;
  for (const char of username.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return SWATCHES[hash % SWATCHES.length];
}

/** Round initial for a username. */
export function FriendAvatar({ username, size = 44 }: { username: string; size?: number }) {
  const [background, color] = swatchFor(username);

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.letter, { color, fontSize: Math.round(size * 0.42) }]}>
        {username.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: FONT.heading,
  },
});
