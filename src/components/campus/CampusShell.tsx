import { router, useFocusEffect, usePathname, type Href } from 'expo-router';
import {
  ArrowLeft,
  BookUp,
  Inbox,
  LibraryBig,
  MessagesSquare,
  Search,
  type LucideIcon,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { useCampusApi, type CampusSummary } from '@/lib/campusApi';
import { goBack } from '@/lib/navigation';

type Tab = { href: Href; path: string; label: string; icon: LucideIcon; badge?: keyof CampusSummary };

const TABS: Tab[] = [
  { href: '/campus', path: '/campus', label: 'Browse', icon: Search },
  { href: '/campus/mine', path: '/campus/mine', label: 'My books', icon: LibraryBig },
  { href: '/campus/requests', path: '/campus/requests', label: 'Requests', icon: Inbox, badge: 'pendingIncoming' },
  { href: '/campus/messages', path: '/campus/messages', label: 'Messages', icon: MessagesSquare, badge: 'unreadMessages' },
];

/** Badge counts for the Campus tabs, refreshed whenever a Campus screen gains focus. */
export function useCampusSummary() {
  const campus = useCampusApi();
  const [summary, setSummary] = useState<CampusSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      campus
        .summary()
        .then((data) => {
          if (active) setSummary(data);
        })
        .catch(() => {});

      return () => {
        active = false;
      };
    }, [campus])
  );

  return summary;
}

type CampusShellProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  backFallback?: Href;
  backLabel?: string;
  showTabs?: boolean;
  action?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Shared page frame for Campus: back button, title, section tabs. */
export function CampusShell({
  title,
  subtitle,
  eyebrow = 'CAMPUS BOOKS',
  backFallback = '/home',
  backLabel = 'Back',
  showTabs = true,
  action,
  refreshing = false,
  onRefresh,
  scroll = true,
  children,
  contentStyle,
}: CampusShellProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const pathname = usePathname();
  const summary = useCampusSummary();

  const header = (
    <>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => goBack(backFallback)}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <ArrowLeft size={18} color={PALETTE.text} />
          {!isCompact && <Text style={styles.backText}>{backLabel}</Text>}
        </Pressable>

        {action}
      </View>

      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={[styles.title, isCompact && styles.titleCompact]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {showTabs && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          accessibilityRole="tablist"
        >
          {TABS.map((tab) => {
            const active = pathname === tab.path;
            const count = tab.badge && summary ? Number(summary[tab.badge]) || 0 : 0;
            const Icon = tab.icon;

            return (
              <Pressable
                key={tab.path}
                onPress={() => (active ? null : router.navigate(tab.href))}
                style={({ pressed }) => [
                  styles.tab,
                  active && styles.tabActive,
                  pressed && !active && styles.pressed,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={count > 0 ? `${tab.label}, ${count} new` : tab.label}
              >
                <Icon size={15} color={active ? PALETTE.white : PALETTE.text} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                {count > 0 && (
                  <View style={[styles.badge, active && styles.badgeActive]}>
                    <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </>
  );

  const containerStyle = [styles.container, isCompact && styles.containerCompact, contentStyle];

  return (
    <SafeAreaView style={styles.safe}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={containerStyle}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PALETTE.purple} />
            ) : undefined
          }
        >
          <View style={styles.blobTop} pointerEvents="none" />
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[containerStyle, styles.fill]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

/** Pink "publish a book" button used in Campus headers. */
export function PublishButton({ compact = false }: { compact?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push('/campus/publish')}
      style={({ pressed }) => [styles.publish, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Share a book"
    >
      <BookUp size={17} color={PALETTE.text} />
      {!compact && <Text style={styles.publishText}>Share a book</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  fill: { flex: 1 },
  container: {
    width: '100%',
    maxWidth: 1150,
    alignSelf: 'center',
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  containerCompact: { paddingHorizontal: 18, paddingTop: 16 },
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  backText: { color: PALETTE.text, fontSize: 13, fontFamily: FONT.bodyExtraBold },
  eyebrow: {
    color: PALETTE.darkPink,
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: FONT.bodyExtraBold,
  },
  title: { color: PALETTE.text, fontSize: 30, fontFamily: FONT.heading, marginTop: 6 },
  titleCompact: { fontSize: 25 },
  subtitle: {
    color: PALETTE.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.body,
    marginTop: 6,
  },
  tabs: { gap: 8, paddingVertical: 18 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  tabActive: { backgroundColor: PALETTE.text, borderColor: PALETTE.text },
  tabText: { color: PALETTE.text, fontSize: 12, fontFamily: FONT.bodyExtraBold },
  tabTextActive: { color: PALETTE.white },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: PALETTE.darkPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: { backgroundColor: PALETTE.pink },
  badgeText: { color: PALETTE.white, fontSize: 10, fontFamily: FONT.bodyExtraBold },
  badgeTextActive: { color: PALETTE.text },
  publish: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: PALETTE.pink,
    borderWidth: 1,
    borderColor: '#E8B7C5',
  },
  publishText: { color: PALETTE.text, fontSize: 13, fontFamily: FONT.bodyExtraBold },
  pressed: { opacity: 0.8 },
});
