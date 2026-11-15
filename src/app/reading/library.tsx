import { router } from 'expo-router';
import { ArrowLeft, BookPlus, LibraryBig, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { BookCard } from '@/components/reading/BookCard';
import { Notice, StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT } from '@/constants/palette';
import { useReadingBooks } from '@/hooks/useReadingBooks';
import { goBack } from '@/lib/navigation';
import { isBookFinished } from '@/lib/readingApi';

const COLORS = {
  background: '#E9DDF2',
  card: '#F5ECFA',
  white: '#FFFFFF',
  dark: '#493653',
  text: '#806B87',
  accent: '#927BA0',
  muted: '#A99AAF',
  border: '#DED0E8',
};

type Filter = 'all' | 'reading' | 'finished';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'reading', label: 'Reading' },
  { id: 'finished', label: 'Finished' },
];

export default function LibraryScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const isWide = width >= 1000;

  const { books, loaded, loading, error, refresh } = useReadingBooks();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      all: books.length,
      reading: books.filter((book) => !isBookFinished(book)).length,
      finished: books.filter(isBookFinished).length,
    }),
    [books]
  );

  const visibleBooks = useMemo(() => {
    const search = query.trim().toLowerCase();

    return books.filter((book) => {
      if (filter === 'reading' && isBookFinished(book)) return false;
      if (filter === 'finished' && !isBookFinished(book)) return false;
      if (!search) return true;

      return (
        book.title.toLowerCase().includes(search) ||
        book.author.toLowerCase().includes(search)
      );
    });
  }, [books, filter, query]);

  const renderContent = () => {
    if (!loaded) {
      return (
        <StateCard
          loading={loading}
          loadingText="Opening your library..."
          error={error}
          onRetry={refresh}
        />
      );
    }

    if (books.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <LibraryBig size={28} color={COLORS.accent} />
          </View>
          <Text style={styles.emptyTitle}>Your shelf is still empty</Text>
          <Text style={styles.emptyText}>
            Add the book you’re reading right now to start your library.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/reading/add-book')}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <BookPlus size={17} color={COLORS.white} />
            <Text style={styles.primaryButtonText}>ADD YOUR FIRST BOOK</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (visibleBooks.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No books match</Text>
          <Text style={styles.emptyText}>
            Try another search or filter.
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setQuery('');
              setFilter('all');
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Show all books</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.grid}>
        {visibleBooks.map((book) => (
          <View
            key={book.id}
            style={[styles.gridItem, isWide && styles.gridItemWide]}
          >
            <BookCard book={book} compact={isCompact || isWide} />
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isCompact && styles.containerCompact,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBack('/reading')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Back to reading"
        >
          <ArrowLeft size={18} color={COLORS.dark} />
          <Text style={styles.backText}>BACK TO READING</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>YOUR BOOKSHELF</Text>
            <Text style={[styles.title, isCompact && styles.titleCompact]}>
              My library
            </Text>
            <Text style={styles.subtitle}>
              Every story you’ve added, in one cozy place.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/reading/add-book')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Add a book"
          >
            <BookPlus size={18} color={COLORS.dark} />
            {!isCompact && <Text style={styles.addButtonText}>ADD BOOK</Text>}
          </TouchableOpacity>
        </View>

        {loaded && error ? (
          <Notice
            tone="error"
            message={error}
            actionLabel="Try again"
            onAction={refresh}
            style={styles.notice}
          />
        ) : null}

        {loaded && books.length > 0 && (
          <>
            <View style={styles.searchBox}>
              <Search size={17} color={COLORS.muted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search by title or author"
                placeholderTextColor={COLORS.muted}
                returnKeyType="search"
                accessibilityLabel="Search books"
              />
              {query !== '' && (
                <Pressable
                  onPress={() => setQuery('')}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <X size={16} color={COLORS.muted} />
                </Pressable>
              )}
            </View>

            <View style={styles.filters} accessibilityRole="tablist">
              {FILTERS.map((item) => {
                const selected = filter === item.id;

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setFilter(item.id)}
                    style={[styles.filterChip, selected && styles.filterChipActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        selected && styles.filterTextActive,
                      ]}
                    >
                      {item.label} · {counts[item.id]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {renderContent()}

        <Text style={styles.footnote}>
          Updating the current page of a saved book isn’t available yet.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    width: '100%',
    maxWidth: 1250,
    alignSelf: 'center',
    paddingHorizontal: 55,
    paddingTop: 28,
    paddingBottom: 45,
  },
  containerCompact: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  backText: {
    color: COLORS.dark,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 22,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: COLORS.accent,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2,
    marginBottom: 9,
  },
  title: {
    color: COLORS.dark,
    fontSize: 32,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  titleCompact: {
    fontSize: 27,
  },
  subtitle: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    marginTop: 7,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    minWidth: 46,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addButtonText: {
    color: COLORS.dark,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  notice: {
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
    minHeight: 48,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: COLORS.dark,
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    paddingVertical: 12,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  filterChip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.dark,
    borderColor: COLORS.dark,
  },
  filterText: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
  },
  filterTextActive: {
    color: COLORS.white,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  gridItem: {
    width: '100%',
  },
  gridItemWide: {
    width: '48.8%',
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: COLORS.dark,
    fontSize: 19,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: 7,
    maxWidth: 360,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.dark,
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 18,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 18,
    marginTop: 16,
  },
  secondaryButtonText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
  },
  footnote: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: 26,
  },
});
