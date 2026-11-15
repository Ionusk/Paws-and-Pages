import { router } from 'expo-router';
import { BookOpen, Inbox, UserRound } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import {
    BOOK_STATUS_LABEL,
    REQUEST_STATUS_LABEL,
    type BookStatus,
    type CampusBook,
} from '@/lib/campusApi';

/** Responsive card width: 3 columns on desktop, 2 on tablets, 1 on phones. */
export function cardWidth(width: number) {
  if (width >= 1050) return '31.8%' as const;
  if (width >= COMPACT_BREAKPOINT) return '48.5%' as const;
  return '100%' as const;
}

const STATUS_COLORS: Record<BookStatus, { background: string; color: string }> = {
  available: { background: PALETTE.successSoft, color: PALETTE.success },
  borrowed: { background: '#FCEBD9', color: '#9A6A3C' },
  inactive: { background: '#EFEAF1', color: PALETTE.muted },
};

export function BookStatusBadge({ status }: { status: BookStatus }) {
  const colors = STATUS_COLORS[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
      <View style={[styles.statusDot, { backgroundColor: colors.color }]} />
      <Text style={[styles.statusText, { color: colors.color }]}>
        {BOOK_STATUS_LABEL[status].toUpperCase()}
      </Text>
    </View>
  );
}

export function BookCover({ uri, height = 190 }: { uri: string | null; height?: number }) {
  return (
    <View style={[styles.cover, { height }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.coverImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.coverPlaceholder}>
          <BookOpen size={34} color={PALETTE.purple} strokeWidth={1.5} />
        </View>
      )}
    </View>
  );
}

/** Book listing card for the Campus grid. */
export function CampusBookCard({ book, width }: { book: CampusBook; width: number | `${number}%` }) {
  const ownerLabel = book.isOwner ? 'Your listing' : `@${book.owner.username}`;

  return (
    <Pressable
      onPress={() => router.push(`/campus/book/${book.id}`)}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.author}. ${BOOK_STATUS_LABEL[book.status]}. ${ownerLabel}.`}
    >
      <BookCover uri={book.coverUrl} />

      <View style={styles.body}>
        <View style={styles.badges}>
          <BookStatusBadge status={book.status} />
          {book.category ? (
            <View style={styles.category}>
              <Text style={styles.categoryText} numberOfLines={1}>
                {book.category}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {book.title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {book.author}
        </Text>

        {book.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {book.description}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.owner}>
            <UserRound size={13} color={PALETTE.muted} />
            <Text style={styles.ownerText} numberOfLines={1}>
              {ownerLabel}
            </Text>
          </View>

          {book.isOwner && (book.pendingRequests ?? 0) > 0 ? (
            <View style={styles.requestPill}>
              <Inbox size={12} color={PALETTE.darkPink} />
              <Text style={styles.requestPillText}>{book.pendingRequests} waiting</Text>
            </View>
          ) : book.myRequest ? (
            <View style={styles.requestPill}>
              <Text style={styles.requestPillText}>{REQUEST_STATUS_LABEL[book.myRequest.status]}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cover: {
    width: '100%',
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: PALETTE.lavender,
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 6, paddingTop: 12, paddingBottom: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, letterSpacing: 0.8, fontFamily: FONT.bodyExtraBold },
  category: {
    backgroundColor: PALETTE.lavender,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: 160,
  },
  categoryText: { color: PALETTE.purple, fontSize: 9, letterSpacing: 0.5, fontFamily: FONT.bodyExtraBold },
  title: { color: PALETTE.text, fontSize: 17, lineHeight: 23, fontFamily: FONT.heading },
  author: { color: PALETTE.muted, fontSize: 12, fontFamily: FONT.bodyMedium, marginTop: 3 },
  description: {
    color: PALETTE.muted,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: FONT.body,
    marginTop: 7,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  ownerText: { color: PALETTE.muted, fontSize: 11, fontFamily: FONT.bodyBold, flexShrink: 1 },
  requestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PALETTE.lightPink,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  requestPillText: { color: PALETTE.darkPink, fontSize: 10, fontFamily: FONT.bodyExtraBold },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
