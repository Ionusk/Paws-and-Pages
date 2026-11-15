import { router, useFocusEffect } from 'expo-router';
import { BookUp, LibraryBig } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CampusBookCard, cardWidth } from '@/components/campus/CampusBookCard';
import { CampusShell, PublishButton } from '@/components/campus/CampusShell';
import { Notice, StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage } from '@/lib/api';
import { useCampusApi, type CampusBook } from '@/lib/campusApi';

export default function MyCampusBooksScreen() {
  const { width } = useWindowDimensions();
  const campus = useCampusApi();

  const [books, setBooks] = useState<CampusBook[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;

    try {
      setLoading(true);
      const data = await campus.listBooks({ scope: 'mine', availability: 'all' });
      if (id !== requestId.current) return;
      setBooks(data.books);
      setLoaded(true);
      setError(null);
    } catch (err) {
      if (id === requestId.current) setError(getErrorMessage(err, "We couldn't load your listings."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [campus]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const counts = {
    available: books.filter((book) => book.status === 'available').length,
    borrowed: books.filter((book) => book.status === 'borrowed').length,
    hidden: books.filter((book) => book.status === 'inactive').length,
  };

  return (
    <CampusShell
      title="My shared books"
      subtitle="Books you’ve offered to other students. Tap one to edit, hide or remove it."
      action={<PublishButton compact={width < COMPACT_BREAKPOINT} />}
      refreshing={loading && loaded}
      onRefresh={load}
    >
      {!loaded ? (
        <StateCard loading={loading} loadingText="Gathering your books..." error={error} onRetry={load} />
      ) : books.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <LibraryBig size={28} color={PALETTE.purple} />
          </View>
          <Text style={styles.emptyTitle}>You haven’t shared a book yet</Text>
          <Text style={styles.emptyText}>
            Got a textbook you’re not using this semester? Another student
            might need it.
          </Text>
          <Pressable
            onPress={() => router.push('/campus/publish')}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <BookUp size={17} color={PALETTE.white} />
            <Text style={styles.primaryText}>Share your first book</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {error ? <Notice tone="error" message={error} actionLabel="Try again" onAction={load} style={styles.notice} /> : null}

          <View style={styles.stats}>
            <Text style={styles.stat}>
              <Text style={styles.statNumber}>{counts.available}</Text> available
            </Text>
            <Text style={styles.stat}>
              <Text style={styles.statNumber}>{counts.borrowed}</Text> lent out
            </Text>
            <Text style={styles.stat}>
              <Text style={styles.statNumber}>{counts.hidden}</Text> hidden
            </Text>
          </View>

          <View style={styles.grid}>
            {books.map((book) => (
              <CampusBookCard key={book.id} book={book} width={cardWidth(width)} />
            ))}
          </View>
        </>
      )}
    </CampusShell>
  );
}

const styles = StyleSheet.create({
  notice: { marginBottom: 14 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  stat: { color: PALETTE.muted, fontSize: 12, fontFamily: FONT.bodyBold },
  statNumber: { color: PALETTE.text, fontSize: 16, fontFamily: FONT.bodyExtraBold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  empty: {
    backgroundColor: PALETTE.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { color: PALETTE.text, fontSize: 19, fontFamily: FONT.heading, textAlign: 'center' },
  emptyText: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.body,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 360,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 15,
    backgroundColor: PALETTE.text,
    marginTop: 18,
  },
  primaryText: { color: PALETTE.white, fontSize: 13, fontFamily: FONT.bodyExtraBold },
  pressed: { opacity: 0.82 },
});
