import { router } from 'expo-router';
import { BookOpen, NotebookPen, Quote, Star, Timer } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ComingSoonScreen } from '@/components/ui/ComingSoonScreen';
import { FONT, PALETTE } from '@/constants/palette';

// The previous version of this screen said reviews were "created locally",
// but nothing was stored anywhere. Until the backend can save reviews, this
// screen explains the feature and points to what already works.
export default function ReviewScreen() {
  return (
    <ComingSoonScreen
      eyebrow="YOUR BOOK THOUGHTS"
      title="Book reviews"
      subtitle="Every book leaves a little something behind."
      heroIcon={NotebookPen}
      heroTitle="Reviews are on their way"
      heroText="Saving reviews isn't available yet. Soon you'll be able to rate the books you finish and keep your thoughts in one place."
      backFallback="/reading"
      backLabel="Back to reading"
      features={[
        {
          icon: Star,
          title: 'Ratings',
          description: 'Give each finished book up to five stars.',
          color: PALETTE.peach,
          iconColor: '#A77C6C',
        },
        {
          icon: NotebookPen,
          title: 'Written reviews',
          description: 'Write down what you loved, or didn\'t.',
          color: PALETTE.lavender,
          iconColor: PALETTE.purple,
        },
        {
          icon: Quote,
          title: 'Favourite quotes',
          description: 'Save the lines you want to remember.',
        },
      ]}
    >
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={() => router.push('/reading/session')}
          accessibilityRole="button"
        >
          <Timer size={18} color={PALETTE.white} />
          <Text style={styles.actionText}>Start a reading session</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.action,
            styles.actionSecondary,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push('/reading/library')}
          accessibilityRole="button"
        >
          <BookOpen size={18} color={PALETTE.text} />
          <Text style={[styles.actionText, styles.actionTextSecondary]}>
            Open my library
          </Text>
        </Pressable>
      </View>
    </ComingSoonScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  action: {
    flexGrow: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 15,
    paddingHorizontal: 18,
    backgroundColor: PALETTE.text,
  },
  actionSecondary: {
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  actionText: {
    color: PALETTE.white,
    fontSize: 13,
    fontFamily: FONT.bodyExtraBold,
  },
  actionTextSecondary: {
    color: PALETTE.text,
  },
  pressed: {
    opacity: 0.8,
  },
});
