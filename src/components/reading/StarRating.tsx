import { Star } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PALETTE } from '@/constants/palette';

const STAR_FILL = '#E9B872';
const STAR_EMPTY = '#DED0E8';

export const RATING_LABELS = [
  '',
  'Not for me',
  'It was okay',
  'I liked it',
  'I really liked it',
  'I loved it!',
] as const;

type Props = {
  /** 0 means "not rated yet". */
  value: number;
  /** Makes the stars tappable. Without it the rating is read-only. */
  onChange?: (value: number) => void;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Five stars, either as a picker or as a read-only rating. */
export function StarRating({ value, onChange, size = 18, disabled, style }: Props) {
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <View
        style={[styles.row, { gap: Math.round(size / 6) }, style]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${value} out of 5 stars`}
      >
        {stars.map((star) => (
          <Star
            key={star}
            size={size}
            color={star <= value ? STAR_FILL : STAR_EMPTY}
            fill={star <= value ? STAR_FILL : 'transparent'}
            strokeWidth={1.8}
          />
        ))}
      </View>
    );
  }

  return (
    <View
      style={[styles.row, { gap: Math.round(size / 5) }, style]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Rating"
    >
      {stars.map((star) => {
        const filled = star <= value;

        return (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            disabled={disabled}
            hitSlop={4}
            style={({ pressed }) => [styles.touch, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected: star === value, disabled }}
            accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}, ${RATING_LABELS[star]}`}
          >
            <Star
              size={size}
              color={filled ? STAR_FILL : PALETTE.purple}
              fill={filled ? STAR_FILL : 'transparent'}
              strokeWidth={1.6}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  touch: {
    padding: 2,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
});
