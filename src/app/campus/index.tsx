import { router, useFocusEffect } from 'expo-router';
import { BookUp, LibraryBig, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';

import { CampusBookCard, cardWidth } from '@/components/campus/CampusBookCard';
import { CampusShell, PublishButton } from '@/components/campus/CampusShell';
import { Notice, StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage } from '@/lib/api';
import { CAMPUS_CATEGORIES, useCampusApi, type CampusBook } from '@/lib/campusApi';
import { useProfile } from '@/lib/profile';

export default function CampusHomeScreen() {
  const { width } = useWindowDimensions();
  const campus = useCampusApi();
  const { user } = useProfile();

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(true);

  const [books, setBooks] = useState<CampusBook[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Debounce typing in the search box.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (mode: 'replace' | 'more' | 'refresh', offset = 0) => {
      const id = ++requestId.current;

      if (mode === 'more') setLoadingMore(true);
      else if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);

      try {
        const data = await campus.listBooks({
          q: search,
          category,
          availability: availableOnly ? 'available' : 'all',
          offset,
        });

        if (id !== requestId.current) return;

        setBooks((previous) => (mode === 'more' ? [...previous, ...data.books] : data.books));
        setHasMore(data.hasMore);
        setLoaded(true);
        setError(null);
      } catch (err) {
        if (id === requestId.current) {
          setError(getErrorMessage(err, "We couldn't load the campus library."));
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [availableOnly, campus, category, search]
  );

  useFocusEffect(
    useCallback(() => {
      load('replace');
    }, [load])
  );

  const filtersActive = Boolean(search || category) || !availableOnly;

  const renderResults = () => {
    if (!loaded && (loading || error)) {
      return (
        <StateCard
          loading={loading}
          loadingText="Looking through the campus shelves..."
          error={error}
          onRetry={() => load('replace')}
        />
      );
    }

    if (books.length === 0) {
      return (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <LibraryBig size={28} color={PALETTE.purple} />
          </View>
          <Text style={styles.emptyTitle}>
            {filtersActive ? 'No books match your search' : 'The campus shelves are empty'}
          </Text>
          <Text style={styles.emptyText}>
            {filtersActive
              ? 'Try another title, author or category.'
              : 'Be the first to share a book with other UPT students.'}
          </Text>

          {filtersActive ? (
            <Pressable
              onPress={() => {
                setQuery('');
                setCategory(null);
                setAvailableOnly(true);
              }}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Clear filters</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/campus/publish')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <BookUp size={17} color={PALETTE.white} />
              <Text style={styles.primaryText}>Share a book</Text>
            </Pressable>
          )}
        </View>
      );
    }

    return (
      <>
        {error ? (
          <Notice tone="error" message={error} actionLabel="Try again" onAction={() => load('replace')} style={styles.notice} />
        ) : null}

        <View style={styles.grid}>
          {books.map((book) => (
            <CampusBookCard key={book.id} book={book} width={cardWidth(width)} />
          ))}
        </View>

        {hasMore && (
          <Pressable
            onPress={() => load('more', books.length)}
            disabled={loadingMore}
            style={({ pressed }) => [styles.secondaryButton, styles.moreButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            {loadingMore ? <ActivityIndicator color={PALETTE.text} /> : null}
            <Text style={styles.secondaryText}>{loadingMore ? 'Loading...' : 'Show more books'}</Text>
          </Pressable>
        )}
      </>
    );
  };

  return (
    <CampusShell
      title="Books bring us together."
      subtitle={`Hi ${user?.username ?? 'there'}! Borrow a book from another UPT student, or share one of yours.`}
      action={<PublishButton compact={width < COMPACT_BREAKPOINT} />}
      refreshing={refreshing}
      onRefresh={() => load('refresh')}
    >
      <View style={styles.searchBox}>
        <Search size={17} color={PALETTE.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by title or author"
          placeholderTextColor="#A99AAF"
          returnKeyType="search"
          maxLength={100}
          accessibilityLabel="Search books"
        />
        {query !== '' && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <X size={16} color={PALETTE.muted} />
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[null, ...CAMPUS_CATEGORIES].map((item) => {
          const selected = category === item;

          return (
            <Pressable
              key={item ?? 'all'}
              onPress={() => setCategory(item)}
              style={[styles.chip, selected && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item ?? 'All subjects'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Only show books I can borrow now</Text>
        <Switch
          value={availableOnly}
          onValueChange={setAvailableOnly}
          trackColor={{ false: '#E3D8EA', true: PALETTE.darkPink }}
          thumbColor={PALETTE.white}
          accessibilityLabel="Only show available books"
        />
      </View>

      {loading && loaded ? <ActivityIndicator color={PALETTE.purple} style={styles.inlineLoader} /> : null}

      {renderResults()}
    </CampusShell>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PALETTE.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 15,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    color: PALETTE.text,
    fontSize: 14,
    fontFamily: FONT.bodyMedium,
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,
  chips: { gap: 8, paddingVertical: 14 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  chipActive: { backgroundColor: PALETTE.purple, borderColor: PALETTE.purple },
  chipText: { color: PALETTE.text, fontSize: 12, fontFamily: FONT.bodyBold },
  chipTextActive: { color: PALETTE.white },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  toggleLabel: { flex: 1, color: PALETTE.muted, fontSize: 12, fontFamily: FONT.bodyBold },
  inlineLoader: { marginBottom: 12 },
  notice: { marginBottom: 14 },
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
  primaryButton: {
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
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: PALETTE.lavender,
    marginTop: 16,
  },
  moreButton: { alignSelf: 'center', marginTop: 22 },
  secondaryText: { color: PALETTE.text, fontSize: 13, fontFamily: FONT.bodyExtraBold },
  pressed: { opacity: 0.82 },
});
