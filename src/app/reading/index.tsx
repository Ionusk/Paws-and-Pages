import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookOpen,
  BookPlus,
  CheckCircle2,
  LibraryBig,
  NotebookPen,
  PencilLine,
  Search,
  Timer,
} from 'lucide-react-native';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { BookCard } from '@/components/reading/BookCard';
import { BookProgressControls } from '@/components/reading/BookProgressControls';
import { SoonBadge, StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT } from '@/constants/palette';
import { useReadingBooks } from '@/hooks/useReadingBooks';
import { goBack } from '@/lib/navigation';
import { isBookFinished } from '@/lib/readingApi';

const COLORS = {
  background: '#E9DDF2',
  primary: '#C8B5E5',
  card: '#F5ECFA',
  white: '#FFFFFF',
  pink: '#FFF0F2',
  dark: '#493653',
  text: '#806B87',
  accent: '#927BA0',
  muted: '#A99AAF',
  track: '#EAE1EF',
  border: '#DED0E8',
  done: '#5F7F5B',
  doneSoft: '#E6F0E3',
};

const READING_GOAL = 12;
const MAX_CURRENT_BOOKS = 3;
const MAX_FINISHED_PREVIEW = 6;

export default function ReadingScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const { books, loaded, loading, error, refresh } = useReadingBooks();

  const readingBooks = books.filter((book) => !isBookFinished(book));
  const finishedBooks = books.filter(isBookFinished);
  const visibleBooks = readingBooks.slice(0, MAX_CURRENT_BOOKS);
  const hiddenBooks = readingBooks.length - visibleBooks.length;

  const year = new Date().getFullYear();
  const finishedThisYear = finishedBooks.filter((book) => {
    const date = book.finishedAt ? new Date(book.finishedAt) : null;
    return !date || date.getFullYear() === year;
  }).length;
  const progress = Math.min(finishedThisYear / READING_GOAL, 1);
  const percentage = Math.round(progress * 100);

  const startSession = () => {
    // With exactly one book in progress there is nothing to choose.
    if (readingBooks.length === 1) {
      router.push({
        pathname: '/reading/session',
        params: { bookId: readingBooks[0].id },
      });
      return;
    }

    router.push('/reading/session');
  };

  const renderCurrentBooks = () => {
    if (!loaded && (loading || error)) {
      return (
        <StateCard
          loading={loading}
          loadingText="Opening your bookshelf..."
          error={error}
          onRetry={refresh}
        />
      );
    }

    if (visibleBooks.length > 0) {
      return (
        <View style={styles.bookList}>
          {visibleBooks.map((book) => (
            <BookCard key={book.id} book={book} compact={isCompact}>
              <BookProgressControls book={book} onUpdated={refresh} />
            </BookCard>
          ))}

          {hiddenBooks > 0 && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.moreBooksLink}
              onPress={() =>
                router.push({
                  pathname: '/reading/library',
                  params: { filter: 'reading' },
                })
              }
              accessibilityRole="button"
            >
              <Text style={styles.moreBooksText}>
                +{hiddenBooks} more {hiddenBooks === 1 ? 'book' : 'books'} in
                progress
              </Text>
              <ArrowRight size={16} color={COLORS.dark} />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyBookIcon}>
          <BookPlus size={30} color={COLORS.accent} />
        </View>

        <Text style={styles.emptyBookTitle}>
          {finishedBooks.length > 0
            ? 'Ready for your next story?'
            : 'Your reading journey starts here'}
        </Text>

        <Text style={styles.emptyBookText}>
          Add the book you are reading. Just type its title and pick it from
          the list.
        </Text>

        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/reading/add-book')}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Search size={16} color={COLORS.white} />
            <Text style={styles.primaryButtonText}>FIND A BOOK</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.push({
                pathname: '/reading/add-book',
                params: { mode: 'manual' },
              })
            }
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <PencilLine size={16} color={COLORS.dark} />
            <Text style={styles.secondaryButtonText}>ADD MANUALLY</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFinishedBooks = () => {
    if (!loaded) return null;

    if (finishedBooks.length === 0) {
      return (
        <View style={styles.finishedEmpty}>
          <CheckCircle2 size={20} color={COLORS.done} />
          <Text style={styles.finishedEmptyText}>
            Books you finish will be collected here. Tap “Finished” on a book,
            or reach its last page.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.finishedCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.finishedRow}
        >
          {finishedBooks.slice(0, MAX_FINISHED_PREVIEW).map((book) => (
            <View
              key={book.id}
              style={styles.finishedItem}
              accessible
              accessibilityLabel={`${book.title} by ${book.author}, finished`}
            >
              <View style={styles.finishedCover}>
                {book.coverUrl ? (
                  <Image
                    source={{ uri: book.coverUrl }}
                    style={styles.coverImage}
                    resizeMode="cover"
                  />
                ) : (
                  <BookOpen size={26} color={COLORS.accent} />
                )}
                <View style={styles.finishedBadge}>
                  <CheckCircle2 size={13} color={COLORS.white} />
                </View>
              </View>
              <Text style={styles.finishedTitle} numberOfLines={2}>
                {book.title}
              </Text>
              <Text style={styles.finishedAuthor} numberOfLines={1}>
                {book.author}
              </Text>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.finishedLink}
          onPress={() =>
            router.push({
              pathname: '/reading/library',
              params: { filter: 'finished' },
            })
          }
          accessibilityRole="button"
        >
          <Text style={styles.moreBooksText}>
            See all {finishedBooks.length} finished{' '}
            {finishedBooks.length === 1 ? 'book' : 'books'}
          </Text>
          <ArrowRight size={16} color={COLORS.dark} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container, isCompact && styles.containerCompact]}
        showsVerticalScrollIndicator={false}
      >
        {/* BACK */}
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.8}
          onPress={() => goBack('/home')}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <ArrowLeft size={18} color={COLORS.dark} />
          <Text style={styles.backButtonText}>HOME</Text>
        </TouchableOpacity>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>YOUR READING CORNER</Text>
            <Text style={[styles.title, isCompact && styles.titleCompact]}>
              My reading journey
            </Text>
            <Text style={styles.subtitle}>
              {loaded
                ? `${readingBooks.length} in progress · ${finishedBooks.length} finished`
                : 'A little time for yourself and your stories.'}
            </Text>
          </View>

          {!isCompact && (
            <View style={styles.headerIcon}>
              <BookOpen size={30} color={COLORS.accent} strokeWidth={1.6} />
            </View>
          )}
        </View>

        {/* QUICK ACTIONS */}
        <View style={[styles.quickActions, isCompact && styles.quickActionsCompact]}>
          <Pressable
            onPress={startSession}
            style={({ pressed }) => [
              styles.quickAction,
              styles.quickActionPrimary,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <View style={[styles.quickIcon, styles.quickIconPrimary]}>
              <Timer size={22} color={COLORS.white} />
            </View>
            <View style={styles.quickText}>
              <Text style={[styles.quickTitle, styles.quickTitlePrimary]}>
                Start reading
              </Text>
              <Text style={[styles.quickSubtitle, styles.quickSubtitlePrimary]}>
                Pick your book, start the timer
              </Text>
            </View>
            <ArrowRight size={18} color={COLORS.white} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/reading/add-book')}
            style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.quickIcon}>
              <BookPlus size={22} color={COLORS.accent} />
            </View>
            <View style={styles.quickText}>
              <Text style={styles.quickTitle}>Add a book</Text>
              <Text style={styles.quickSubtitle}>Search by title or add manually</Text>
            </View>
            <ArrowRight size={18} color={COLORS.dark} />
          </Pressable>
        </View>

        {/* CURRENTLY READING */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Currently reading</Text>
            <Text style={styles.sectionSubtitle}>
              Update your page or mark a book as finished.
            </Text>
          </View>

          <BookOpen size={24} color={COLORS.accent} strokeWidth={1.6} />
        </View>

        {renderCurrentBooks()}

        {/* FINISHED */}
        <View style={[styles.sectionHeader, styles.sectionSpacing]}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Finished books</Text>
            <Text style={styles.sectionSubtitle}>
              Every story you have completed.
            </Text>
          </View>

          <CheckCircle2 size={24} color={COLORS.done} strokeWidth={1.6} />
        </View>

        {renderFinishedBooks()}

        {/* READING GOAL */}
        <View style={[styles.sectionHeader, styles.sectionSpacing]}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Reading goal</Text>
            <Text style={styles.sectionSubtitle}>
              Every book brings a new adventure.
            </Text>
          </View>

          <BookMarked size={24} color={COLORS.accent} strokeWidth={1.6} />
        </View>

        <View style={[styles.goalCard, isCompact && styles.goalCardCompact]}>
          <View style={styles.cardHeader}>
            <View style={styles.sectionHeading}>
              <Text style={styles.eyebrow}>YOUR YEARLY GOAL</Text>
              <Text style={styles.goalTitle}>A year full of stories</Text>
            </View>

            <View style={styles.goalBadge}>
              <BookMarked size={15} color={COLORS.accent} />
              <Text style={styles.goalBadgeText}>{year} goal</Text>
            </View>
          </View>

          <View style={styles.goalNumbers}>
            <Text style={styles.progressNumber}>
              {loaded ? finishedThisYear : '…'}
            </Text>
            <Text style={styles.progressSlash}>/</Text>
            <Text style={styles.progressTarget}>{READING_GOAL}</Text>
            <Text style={styles.progressLabel}>books finished in {year}</Text>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
          </View>

          <View style={styles.progressInfo}>
            <Text style={styles.progressPercentage}>{percentage}% completed</Text>
            <Text style={styles.progressRemaining}>
              {Math.max(READING_GOAL - finishedThisYear, 0)} books to go
            </Text>
          </View>
        </View>

        {/* MORE */}
        <View style={[styles.sectionHeader, styles.sectionSpacing]}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>More</Text>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.activityCard}
          onPress={() => router.push('/reading/library')}
          accessibilityRole="button"
        >
          <View style={styles.activityIcon}>
            <LibraryBig size={23} color={COLORS.accent} />
          </View>

          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>My library</Text>
            <Text style={styles.activityDescription}>
              {loaded
                ? `All ${books.length} ${books.length === 1 ? 'book' : 'books'}, with search and filters.`
                : 'Your whole bookshelf, with search and filters.'}
            </Text>
          </View>

          <ArrowRight size={18} color={COLORS.dark} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.activityCard}
          onPress={() => router.push('/reading/review')}
          accessibilityRole="button"
          accessibilityLabel="Book reviews. Coming soon."
        >
          <View style={styles.activityIcon}>
            <NotebookPen size={23} color={COLORS.accent} />
          </View>

          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>Book reviews</Text>
            <Text style={styles.activityDescription}>
              Save your thoughts about the books you read.
            </Text>
          </View>

          <SoonBadge />
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>PAWS & PAGES</Text>
          <BookOpen size={14} color={COLORS.accent} />
        </View>
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
    paddingHorizontal: 55,
    paddingTop: 28,
    paddingBottom: 45,
    maxWidth: 1250,
    width: '100%',
    alignSelf: 'center',
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
  backButtonText: {
    color: COLORS.dark,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    gap: 16,
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
    letterSpacing: -0.5,
  },
  titleCompact: {
    fontSize: 27,
  },
  subtitle: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 7,
  },
  headerIcon: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 30,
  },
  quickActionsCompact: {
    flexDirection: 'column',
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickActionPrimary: {
    backgroundColor: COLORS.dark,
    borderColor: COLORS.dark,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconPrimary: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  quickText: {
    flex: 1,
  },
  quickTitle: {
    color: COLORS.dark,
    fontSize: 17,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  quickTitlePrimary: {
    color: COLORS.white,
  },
  quickSubtitle: {
    color: COLORS.text,
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 3,
  },
  quickSubtitlePrimary: {
    color: '#DCCBE8',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 12,
  },
  sectionSpacing: {
    marginTop: 34,
  },
  sectionHeading: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: COLORS.dark,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.text,
    marginTop: 5,
  },
  bookList: {
    gap: 14,
  },
  moreBooksLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  moreBooksText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyBookIcon: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  emptyBookTitle: {
    color: COLORS.dark,
    fontSize: 19,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
  },
  emptyBookText: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
    maxWidth: 360,
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dark,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: COLORS.dark,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  finishedEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.doneSoft,
    borderRadius: 18,
    padding: 16,
  },
  finishedEmptyText: {
    flex: 1,
    color: COLORS.done,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Nunito_700Bold',
  },
  finishedCard: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  finishedRow: {
    paddingHorizontal: 18,
    gap: 16,
  },
  finishedItem: {
    width: 104,
  },
  finishedCover: {
    width: 104,
    height: 152,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  finishedBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.done,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishedTitle: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
    marginTop: 8,
  },
  finishedAuthor: {
    color: COLORS.text,
    fontSize: 10,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 2,
  },
  finishedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 14,
  },
  goalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  goalCardCompact: {
    paddingHorizontal: 20,
  },
  cardHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  goalTitle: {
    color: COLORS.dark,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  goalBadge: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goalBadgeText: {
    color: COLORS.accent,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
  },
  goalNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginTop: 18,
  },
  progressNumber: {
    color: COLORS.accent,
    fontSize: 44,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: -2,
  },
  progressSlash: {
    color: COLORS.muted,
    fontSize: 24,
    marginHorizontal: 5,
  },
  progressTarget: {
    color: COLORS.dark,
    fontSize: 26,
    fontFamily: 'Nunito_800ExtraBold',
  },
  progressLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    marginLeft: 10,
  },
  progressBar: {
    width: '100%',
    height: 9,
    borderRadius: 10,
    backgroundColor: COLORS.track,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  progressInfo: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  progressPercentage: {
    color: COLORS.accent,
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
  },
  progressRemaining: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
  },
  activityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 21,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    gap: 12,
  },
  activityIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityText: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.dark,
  },
  activityDescription: {
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.text,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 30,
  },
  footerText: {
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2,
    color: COLORS.text,
  },
});
