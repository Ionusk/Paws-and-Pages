import { ArrowLeft, Sparkles, type LucideIcon } from 'lucide-react-native';
import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Href } from 'expo-router';

import { SoonBadge } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { goBack } from '@/lib/navigation';

export type PlannedFeature = {
  icon: LucideIcon;
  title: string;
  description: string;
  color?: string;
  iconColor?: string;
};

type ComingSoonScreenProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  heroIcon: LucideIcon;
  heroTitle: string;
  heroText: string;
  heroColor?: string;
  features: PlannedFeature[];
  note?: { title: string; text: string };
  backFallback?: Href;
  backLabel?: string;
  children?: React.ReactNode;
};

/**
 * Shared layout for sections whose backend does not exist yet. It explains
 * what is planned without pretending that any action works.
 */
export function ComingSoonScreen({
  eyebrow,
  title,
  subtitle,
  heroIcon: HeroIcon,
  heroTitle,
  heroText,
  heroColor = PALETTE.lavender,
  features,
  note,
  backFallback = '/home',
  backLabel = 'Back',
  children,
}: ComingSoonScreenProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isCompact && styles.containerCompact,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.blobTop} pointerEvents="none" />

        <Pressable
          onPress={() => goBack(backFallback)}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <ArrowLeft size={18} color={PALETTE.text} />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>

        <View style={styles.eyebrowRow}>
          <Sparkles size={14} color={PALETTE.darkPink} />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        </View>
        <Text style={[styles.title, isCompact && styles.titleCompact]}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={[styles.hero, { backgroundColor: heroColor }]}>
          <View style={styles.heroIcon}>
            <HeroIcon size={38} color={PALETTE.darkPink} strokeWidth={1.5} />
          </View>
          <SoonBadge />
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          <Text style={styles.heroText}>{heroText}</Text>
        </View>

        {children}

        <Text style={styles.sectionTitle}>What’s planned</Text>

        <View style={styles.featureList}>
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <View key={feature.title} style={styles.featureCard}>
                <View
                  style={[
                    styles.featureIcon,
                    { backgroundColor: feature.color ?? PALETTE.lightPink },
                  ]}
                >
                  <Icon
                    size={22}
                    color={feature.iconColor ?? PALETTE.darkPink}
                    strokeWidth={1.7}
                  />
                </View>

                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>
                    {feature.description}
                  </Text>
                </View>

                <SoonBadge label="SOON" />
              </View>
            );
          })}
        </View>

        {note ? (
          <View style={styles.note}>
            <Text style={styles.noteTitle}>{note.title}</Text>
            <Text style={styles.noteText}>{note.text}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PALETTE.background,
  },
  container: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: 35,
    paddingTop: 25,
    paddingBottom: 45,
    overflow: 'hidden',
  },
  containerCompact: {
    paddingHorizontal: 18,
  },
  blobTop: {
    position: 'absolute',
    top: -130,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: PALETTE.pink,
    opacity: 0.4,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    backgroundColor: PALETTE.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 14,
    marginBottom: 26,
  },
  backText: {
    color: PALETTE.text,
    fontSize: 13,
    fontFamily: FONT.bodyExtraBold,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eyebrow: {
    color: PALETTE.darkPink,
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: FONT.bodyExtraBold,
  },
  title: {
    color: PALETTE.text,
    fontSize: 32,
    fontFamily: FONT.heading,
    marginTop: 8,
  },
  titleCompact: {
    fontSize: 27,
  },
  subtitle: {
    color: PALETTE.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.body,
    marginTop: 8,
    marginBottom: 24,
  },
  hero: {
    borderRadius: 27,
    padding: 26,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: PALETTE.text,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 13,
    elevation: 3,
  },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: PALETTE.text,
    fontSize: 21,
    fontFamily: FONT.heading,
    textAlign: 'center',
  },
  heroText: {
    color: PALETTE.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.body,
    textAlign: 'center',
    maxWidth: 480,
  },
  sectionTitle: {
    color: PALETTE.text,
    fontSize: 21,
    fontFamily: FONT.heading,
    marginTop: 30,
    marginBottom: 14,
  },
  featureList: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    color: PALETTE.text,
    fontSize: 14,
    fontFamily: FONT.bodyExtraBold,
  },
  featureDescription: {
    color: PALETTE.muted,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: FONT.body,
    marginTop: 3,
  },
  note: {
    backgroundColor: PALETTE.lavender,
    borderRadius: 20,
    padding: 20,
    marginTop: 26,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  noteTitle: {
    color: PALETTE.text,
    fontSize: 15,
    fontFamily: FONT.heading,
  },
  noteText: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: FONT.body,
    marginTop: 6,
  },
  pressed: {
    opacity: 0.8,
  },
});
