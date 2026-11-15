import { router, useSegments } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth0 } from 'react-native-auth0';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PALETTE } from '@/constants/palette';

// Screens that already show the account button themselves (home), are the
// account page, or are for logged-out users.
const HIDDEN_ON = new Set(['', 'index', 'login', 'username', 'home', 'account']);

/**
 * The account icon in the top-right corner, shown on every logged-in screen
 * (same look as the one on Home). Rendered once by the root layout.
 */
export function AccountButton() {
  const { user } = useAuth0();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  if (!user || HIDDEN_ON.has(String(segments[0] ?? ''))) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 18 }]}>
      <Pressable
        onPress={() => router.push('/account')}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="My account"
      >
        <UserRound size={23} color={PALETTE.darkPink} strokeWidth={1.7} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    zIndex: 100,
    elevation: 100,
  },
  button: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: PALETTE.lavender,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.text,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
