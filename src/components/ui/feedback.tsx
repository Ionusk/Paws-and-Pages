import {
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
  X,
} from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { FONT, PALETTE } from '@/constants/palette';

type Tone = 'success' | 'error' | 'info';

const TONES: Record<
  Tone,
  { background: string; border: string; color: string; Icon: typeof Info }
> = {
  success: {
    background: PALETTE.successSoft,
    border: '#C9DCC4',
    color: PALETTE.success,
    Icon: CheckCircle2,
  },
  error: {
    background: PALETTE.dangerSoft,
    border: '#F2C3CB',
    color: PALETTE.danger,
    Icon: AlertCircle,
  },
  info: {
    background: '#FFF4F5',
    border: PALETTE.pink,
    color: PALETTE.darkPink,
    Icon: Info,
  },
};

type NoticeProps = {
  tone?: Tone;
  message: string;
  title?: string;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Inline banner for success, error and informational feedback. */
export function Notice({
  tone = 'info',
  message,
  title,
  onDismiss,
  actionLabel,
  onAction,
  style,
}: NoticeProps) {
  const { background, border, color, Icon } = TONES[tone];

  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: background, borderColor: border },
        style,
      ]}
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
      accessibilityLiveRegion="polite"
    >
      <Icon size={18} color={color} />

      <View style={styles.noticeBody}>
        {title ? <Text style={styles.noticeTitle}>{title}</Text> : null}
        <Text style={styles.noticeText}>{message}</Text>
      </View>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [styles.noticeAction, pressed && styles.pressed]}
        >
          <Text style={[styles.noticeActionText, { color }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          hitSlop={10}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <X size={16} color={PALETTE.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

type StateCardProps = {
  loading?: boolean;
  loadingText?: string;
  error?: string | null;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading / error placeholder for a section. Renders nothing when there is
 * neither a loading state nor an error.
 */
export function StateCard({
  loading,
  loadingText = 'Loading...',
  error,
  onRetry,
  style,
}: StateCardProps) {
  if (loading) {
    return (
      <View style={[styles.stateCard, style]}>
        <ActivityIndicator color={PALETTE.purple} />
        <Text style={styles.stateText}>{loadingText}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.stateCard, style]} accessibilityRole="alert">
        <AlertCircle size={22} color={PALETTE.danger} />
        <Text style={styles.stateTitle}>Something went wrong</Text>
        <Text style={styles.stateText}>{error}</Text>

        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <RefreshCw size={14} color={PALETTE.text} />
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return null;
}

/** Small pill used to mark features that are not available yet. */
export function SoonBadge({ label = 'COMING SOON' }: { label?: string }) {
  return (
    <View style={styles.soonBadge}>
      <Text style={styles.soonBadgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  noticeBody: {
    flex: 1,
  },
  noticeTitle: {
    color: PALETTE.text,
    fontSize: 13,
    fontFamily: FONT.bodyExtraBold,
    marginBottom: 2,
  },
  noticeText: {
    color: PALETTE.text,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.bodyBold,
  },
  noticeAction: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  noticeActionText: {
    fontSize: 12,
    fontFamily: FONT.bodyExtraBold,
  },
  stateCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  stateTitle: {
    color: PALETTE.text,
    fontSize: 15,
    fontFamily: FONT.bodyExtraBold,
  },
  stateText: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: FONT.body,
    maxWidth: 420,
  },
  retryButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: PALETTE.lavender,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  retryText: {
    color: PALETTE.text,
    fontSize: 12,
    fontFamily: FONT.bodyExtraBold,
  },
  soonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: PALETTE.lavender,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  soonBadgeText: {
    color: PALETTE.purple,
    fontSize: 8,
    letterSpacing: 1.2,
    fontFamily: FONT.bodyExtraBold,
  },
  pressed: {
    opacity: 0.75,
  },
});
