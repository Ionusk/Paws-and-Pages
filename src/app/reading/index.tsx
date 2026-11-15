
import { router } from 'expo-router';
import {
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    BookMarked,
    BookOpen,
    BookPlus,
    LibraryBig,
    NotebookPen,
    Timer,
} from 'lucide-react-native';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

import { BookCard } from '@/components/reading/BookCard';
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
};

const READING_GOAL = 12;
const MAX_CURRENT_BOOKS = 3;

export default function ReadingScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const { books, loaded, loading, error, refresh } = useReadingBooks();

  const inProgressBooks = books.filter((book) => !isBookFinished(book));
  const finishedBooks = books.filter(isBookFinished);
  const visibleBooks = inProgressBooks.slice(0, MAX_CURRENT_BOOKS);
  const hiddenBooks = inProgressBooks.length - visibleBooks.length;

  const booksRead = finishedBooks.length;
  const progress = Math.min(booksRead / READING_GOAL, 1);
  const percentage = Math.round(progress * 100);
  const year = new Date().getFullYear();

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
            <BookCard key={book.id} book={book} compact={isCompact} />
          ))}

          {hiddenBooks > 0 && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.moreBooksLink}
              onPress={() => router.push('/reading/library')}
              accessibilityRole="button"
            >
              <Text style={styles.moreBooksText}>
                +{hiddenBooks} more {hiddenBooks === 1 ? 'book' : 'books'} in
                your library
              </Text>
              <ArrowRight size={16} color={COLORS.dark} />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.currentBookCard}>
        <View style={styles.emptyBook}>
          <View style={styles.emptyBookIcon}>
            <BookPlus size={30} color={COLORS.accent} />
          </View>

          <Text style={styles.emptyBookTitle}>
            {finishedBooks.length > 0
              ? 'Ready for your next story?'
              : 'Your reading journey starts here'}
          </Text>

          <Text style={styles.emptyBookText}>
            {finishedBooks.length > 0
              ? `You've finished ${finishedBooks.length} ${
                  finishedBooks.length === 1 ? 'book' : 'books'
                }. Add a new one to keep going.`
              : 'Add your first book and it will appear here.'}
          </Text>
        </View>
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
              A little time for yourself and your stories.
            </Text>
          </View>

          {!isCompact && (
            <View style={styles.headerIcon}>
              <BookOpen size={30} color={COLORS.accent} strokeWidth={1.6} />
            </View>
          )}
        </View>

        {/* CURRENTLY READING */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Currently reading</Text>
            <Text style={styles.sectionSubtitle}>
              Your latest reading adventures.
            </Text>
          </View>

          <BookOpen size={24} color={COLORS.accent} strokeWidth={1.6} />
        </View>

        {renderCurrentBooks()}

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.bookButton}
          onPress={() => router.push('/reading/add-book')}
          accessibilityRole="button"
        >
          <BookPlus size={17} color={COLORS.dark} />
          <Text style={styles.bookButtonText}>ADD A NEW BOOK</Text>
          <ArrowRight size={17} color={COLORS.dark} />
        </TouchableOpacity>

        {/* START READING SESSION */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Reading session</Text>
            <Text style={styles.sectionSubtitle}>
              A peaceful moment with Laica.
            </Text>
          </View>

          <Timer size={25} color={COLORS.accent} strokeWidth={1.6} />
        </View>

        <View style={styles.sessionCard}>
          <View style={styles.sessionTextContainer}>
            <Text style={styles.sessionEyebrow}>SLOW DOWN & ENJOY</Text>
            <Text style={styles.sessionTitle}>
              It’s time to get cozy.
            </Text>
            <Text style={styles.sessionDescription}>
              Start the timer, open your book and let Laica keep you company.
              Your reading time is saved when you finish the session.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.sessionButton, isCompact && styles.sessionButtonCompact]}
            activeOpacity={0.85}
            onPress={() => router.push('/reading/session')}
            accessibilityRole="button"
          >
            <Timer size={19} color={COLORS.white} />
            <Text style={styles.sessionButtonText}>
              START READING SESSION
            </Text>
            <ArrowRight size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* READING GOAL */}
        <View style={styles.sectionHeader}>
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

          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressCircle,
                isCompact && styles.progressCircleCompact,
              ]}
            >
              <View style={styles.progressInner}>
                <Text style={styles.progressSmall}>BOOKS FINISHED</Text>

                <View style={styles.progressNumbers}>
                  <Text style={styles.progressNumber}>
                    {loaded ? booksRead : '…'}
                  </Text>
                  <Text style={styles.progressSlash}>/</Text>
                  <Text style={styles.progressTarget}>{READING_GOAL}</Text>
                </View>

                <Text style={styles.progressLabel}>books completed</Text>
              </View>
            </View>
          </View>

          <View style={styles.progressInfo}>
            <Text style={styles.progressPercentage}>
              {percentage}% completed
            </Text>
            <Text style={styles.progressRemaining}>
              {Math.max(READING_GOAL - booksRead, 0)} books to go
            </Text>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${percentage}%` },
              ]}
            />
          </View>

          <Text style={styles.goalFooter}>
            A book counts as finished when your current page reaches its last
            page.
          </Text>
        </View>

        {/* LIBRARY ACTIONS */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Your bookshelf</Text>
            <Text style={styles.sectionSubtitle}>
              What would you like to do today?
            </Text>
          </View>

          <LibraryBig size={24} color={COLORS.accent} strokeWidth={1.6} />
        </View>

        <View style={[styles.actionGrid, isCompact && styles.actionGridCompact]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.actionCard,
              isCompact && styles.actionCardCompact,
              styles.addCard,
            ]}
            onPress={() => router.push('/reading/add-book')}
            accessibilityRole="button"
          >
            <View style={styles.actionTop}>
              <View style={styles.actionIcon}>
                <BookPlus size={24} color={COLORS.accent} />
              </View>
              <ArrowUpRight size={21} color={COLORS.muted} />
            </View>

            <View>
              <Text style={styles.actionTitle}>Add a book</Text>
              <Text style={styles.actionDescription}>
                Find your next favorite story.
              </Text>
            </View>

            <View style={styles.actionBottom}>
              <Text style={styles.actionLink}>ADD TO SHELF</Text>
              <ArrowRight size={17} color={COLORS.dark} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.actionCard,
              isCompact && styles.actionCardCompact,
              styles.libraryCard,
            ]}
            onPress={() => router.push('/reading/library')}
            accessibilityRole="button"
          >
            <View style={styles.actionTop}>
              <View style={styles.actionIcon}>
                <LibraryBig size={24} color={COLORS.accent} />
              </View>
              <ArrowUpRight size={21} color={COLORS.muted} />
            </View>

            <View>
              <Text style={styles.actionTitle}>My library</Text>
              <Text style={styles.actionDescription}>
                {loaded
                  ? `${books.length} ${books.length === 1 ? 'book' : 'books'} on your shelf.`
                  : 'Explore your personal bookshelf.'}
              </Text>
            </View>

            <View style={styles.actionBottom}>
              <Text style={styles.actionLink}>VIEW LIBRARY</Text>
              <ArrowRight size={17} color={COLORS.dark} />
            </View>
          </TouchableOpacity>
        </View>

        {/* READING ACTIVITIES */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Reading activities</Text>
            <Text style={styles.sectionSubtitle}>
              Keep track of your reading journey.
            </Text>
          </View>

          <NotebookPen size={24} color={COLORS.accent} strokeWidth={1.6} />
        </View>

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

        {/* FOOTER */}
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
    marginBottom: 30,
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
    fontFamily: 'Nunito_400Regular',
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

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 17,
    marginTop: 8,
    gap: 12,
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

  currentBookCard: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    padding: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  bookButton: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    minHeight: 46,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },

  bookButtonText: {
    color: COLORS.dark,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },

  emptyBook: {
    alignItems: 'center',
    paddingVertical: 12,
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
    maxWidth: 350,
  },

  sessionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 25,
    padding: 27,
    marginBottom: 38,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  sessionTextContainer: {
    marginBottom: 22,
  },

  sessionEyebrow: {
    color: COLORS.accent,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1.8,
    marginBottom: 8,
  },

  sessionTitle: {
    color: COLORS.dark,
    fontSize: 23,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  sessionDescription: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 19,
    marginTop: 8,
    maxWidth: 600,
  },

  sessionButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'flex-start',
  },

  sessionButtonCompact: {
    alignSelf: 'stretch',
  },

  sessionButtonText: {
    color: COLORS.white,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },

  goalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 30,
    paddingVertical: 27,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 38,
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
    marginTop: 6,
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

  progressContainer: {
    marginTop: 28,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressCircle: {
    width: 225,
    height: 225,
    borderRadius: 115,
    borderWidth: 13,
    borderColor: COLORS.track,
    backgroundColor: '#FDFCFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
  },

  progressCircleCompact: {
    width: 190,
    height: 190,
    borderRadius: 95,
  },

  progressInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  progressSmall: {
    color: COLORS.muted,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2,
  },

  progressNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 5,
  },

  progressNumber: {
    color: COLORS.accent,
    fontSize: 51,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: -2,
  },

  progressSlash: {
    color: COLORS.muted,
    fontSize: 27,
    marginHorizontal: 5,
  },

  progressTarget: {
    color: COLORS.dark,
    fontSize: 29,
    fontFamily: 'Nunito_800ExtraBold',
  },

  progressLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    marginTop: 1,
  },

  progressInfo: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  goalFooter: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    fontStyle: 'italic',
    marginTop: 15,
    textAlign: 'center',
  },

  actionGrid: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 38,
  },

  actionGridCompact: {
    flexDirection: 'column',
  },

  actionCard: {
    flex: 1,
    minHeight: 205,
    borderRadius: 24,
    padding: 21,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  actionCardCompact: {
    flex: 0,
    minHeight: 170,
  },

  addCard: {
    backgroundColor: COLORS.pink,
  },

  libraryCard: {
    backgroundColor: COLORS.card,
  },

  actionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionTitle: {
    color: COLORS.dark,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginTop: 17,
  },

  actionDescription: {
    color: COLORS.text,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 17,
    marginTop: 5,
  },

  actionBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 17,
  },

  actionLink: {
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1.3,
    color: COLORS.dark,
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
    marginRight: 3,
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
