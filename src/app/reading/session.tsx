import { router, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    BookOpen,
    BookPlus,
    Check,
    CheckCircle2,
    Circle,
    Pause,
    Play,
    Star,
    Timer,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
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

import { Notice, StateCard } from '@/components/ui/feedback';
import { useReadingBooks } from '@/hooks/useReadingBooks';
import { getErrorMessage, useApi } from '@/lib/api';
import { confirmAction } from '@/lib/feedback';
import { goBack } from '@/lib/navigation';
import {
    isBookFinished,
    saveReadingSession,
    type ReadingBook,
} from '@/lib/readingApi';

import { AnimatedMascot } from '../../components/AnimatedMascot';

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
  border: '#DED0E8',
  done: '#5F7F5B',
  doneSoft: '#E6F0E3',
};

/** "none" = read without linking the session to a book. */
const NO_BOOK = 'none';

const formatTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
};

export default function ReadingSessionScreen() {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 760;

  const { getAccessToken } = useApi();
  const params = useLocalSearchParams<{ bookId?: string }>();
  const { books, loaded, loading, error, refresh } = useReadingBooks();
  const readingBooks = books.filter((book) => !isBookFinished(book));

  // Opening the screen from a book ("Read now") starts right away.
  const [selectedId, setSelectedId] = useState<string | null>(
    params.bookId ?? null
  );
  const [started, setStarted] = useState(Boolean(params.bookId));

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [isFinished, setIsFinished] = useState(false);

  const [endPage, setEndPage] = useState('');
  const [finishedBook, setFinishedBook] = useState(false);
  const [impressions, setImpressions] = useState('');
  const [pageError, setPageError] = useState('');

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [saveError, setSaveError] = useState('');
  const [savedBook, setSavedBook] = useState<ReadingBook | null>(null);

  const book =
    selectedId && selectedId !== NO_BOOK
      ? readingBooks.find((item) => item.id === selectedId) ?? null
      : null;

  // A book from the link that doesn't exist (or is finished) falls back to
  // the picker instead of a broken session.
  const linkedBookMissing =
    loaded && selectedId !== null && selectedId !== NO_BOOK && !book;

  const phase: 'loading' | 'pick' | 'reading' | 'review' =
    isFinished
      ? 'review'
      : !started || linkedBookMissing
        ? 'pick'
        : selectedId !== NO_BOOK && !loaded
          ? 'loading'
          : 'reading';

  useEffect(() => {
    if (phase !== 'reading' || !isRunning) return;

    const interval = setInterval(() => {
      setElapsedSeconds((previous) => previous + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, isRunning]);

  const startSession = () => {
    if (!selectedId) return;

    setStarted(true);
    setIsRunning(true);
  };

  const handleFinish = () => {
    setIsRunning(false);
    setIsFinished(true);
    setEndPage(book ? String(book.currentPage) : '');
  };

  const saveSession = async () => {
    if (saveState === 'saving' || saveState === 'saved') return;

    let page: number | null = null;

    if (book && !finishedBook) {
      page = Number(endPage);

      if (!endPage.trim() || !Number.isInteger(page) || page < 0) {
        setPageError('Enter the page you stopped at.');
        return;
      }

      if (page > book.pages) {
        setPageError(`This book has ${book.pages} pages.`);
        return;
      }
    }

    try {
      setSaveState('saving');
      setSaveError('');
      setPageError('');

      const result = await saveReadingSession(
        {
          durationSeconds: elapsedSeconds,
          bookId: book?.id ?? null,
          startPage: book?.currentPage ?? 0,
          endPage: page,
          finishedBook: Boolean(book) && finishedBook,
          impressions,
        },
        await getAccessToken()
      );

      setSavedBook(result.book);
      setSaveState('saved');

      // Finishing the book: ask for a review while the story is fresh.
      if (result.book && isBookFinished(result.book)) {
        openReviewFor(result.book.id);
      }
    } catch (err) {
      console.error('Reading session save error:', err);

      setSaveState('error');
      setSaveError(getErrorMessage(err, "We couldn't save this reading session."));
    }
  };

  const openReviewFor = (bookId: string) => {
    router.replace({
      pathname: '/reading/review/[bookId]',
      params: { bookId, justFinished: '1' },
    });
  };

  const handleBack = async () => {
    if (elapsedSeconds > 0 && saveState !== 'saved') {
      const leave = await confirmAction({
        title: 'Leave this session?',
        message:
          'Your reading time is only saved when you tap "Save session". If you leave now, this session will be lost.',
        confirmText: 'Leave',
        destructive: true,
      });

      if (!leave) return;
    }

    goBack('/reading');
  };

  // ------------------------------------------------
  // PICK A BOOK
  // ------------------------------------------------

  const renderPicker = () => {
    if (!loaded) {
      return (
        <StateCard
          loading={loading}
          loadingText="Finding your books..."
          error={error}
          onRetry={refresh}
        />
      );
    }

    const options = [
      ...readingBooks.map((item) => ({ id: item.id, item })),
      { id: NO_BOOK, item: null as ReadingBook | null },
    ];

    return (
      <View style={styles.pickCard}>
        {linkedBookMissing ? (
          <Notice
            tone="info"
            message="That book isn't in your currently reading list anymore. Pick another one."
            style={styles.pickNotice}
          />
        ) : null}

        {readingBooks.length === 0 ? (
          <View style={styles.noBooks}>
            <Text style={styles.noBooksText}>
              You have no books in progress. Add the one you are reading so
              your pages are tracked, or just read without one.
            </Text>
            <TouchableOpacity
              style={styles.addBookLink}
              onPress={() => router.push('/reading/add-book')}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <BookPlus size={16} color={COLORS.dark} />
              <Text style={styles.addBookLinkText}>ADD A BOOK</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.options} accessibilityRole="radiogroup">
          {options.map(({ id, item }) => {
            const selected = selectedId === id && !linkedBookMissing;

            return (
              <Pressable
                key={id}
                onPress={() => setSelectedId(id)}
                style={[styles.option, selected && styles.optionSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={
                  item
                    ? `${item.title}, page ${item.currentPage} of ${item.pages}`
                    : 'Read without choosing a book'
                }
              >
                <View style={styles.optionCover}>
                  {item?.coverUrl ? (
                    <Image
                      source={{ uri: item.coverUrl }}
                      style={styles.coverImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <BookOpen size={20} color={COLORS.accent} />
                  )}
                </View>

                <View style={styles.optionText}>
                  <Text style={styles.optionTitle} numberOfLines={2}>
                    {item ? item.title : 'Just read'}
                  </Text>
                  <Text style={styles.optionMeta} numberOfLines={1}>
                    {item
                      ? `Page ${item.currentPage} of ${item.pages} · ${item.author}`
                      : 'Time only, no book progress'}
                  </Text>
                </View>

                {selected ? (
                  <CheckCircle2 size={22} color={COLORS.accent} />
                ) : (
                  <Circle size={22} color={COLORS.border} />
                )}
              </Pressable>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.startButton, (!selectedId || linkedBookMissing) && styles.disabledButton]}
          onPress={startSession}
          disabled={!selectedId || linkedBookMissing}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Play size={18} color={COLORS.white} fill={COLORS.white} />
          <Text style={styles.startButtonText}>START SESSION</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ------------------------------------------------
  // END OF SESSION
  // ------------------------------------------------

  const renderReview = () => {
    if (saveState === 'saved') {
      const nowFinished = savedBook && isBookFinished(savedBook);

      return (
        <View style={styles.finishedContainer}>
          <Notice
            tone="success"
            message={
              nowFinished
                ? `Saved! "${savedBook.title}" moved to your finished books.`
                : savedBook
                  ? `Saved! You are now on page ${savedBook.currentPage} of ${savedBook.pages}.`
                  : 'Saved to your reading history. It counts toward your quests.'
            }
            style={styles.saveNotice}
          />

          {nowFinished ? (
            <TouchableOpacity
              style={styles.backHomeButton}
              activeOpacity={0.85}
              onPress={() => openReviewFor(savedBook.id)}
              accessibilityRole="button"
            >
              <Star size={18} color={COLORS.white} />
              <Text style={styles.backHomeButtonText}>WRITE A REVIEW</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.backHomeButton}
              activeOpacity={0.85}
              onPress={() => router.replace('/reading')}
              accessibilityRole="button"
            >
              <BookOpen size={18} color={COLORS.white} />
              <Text style={styles.backHomeButtonText}>BACK TO MY READING</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (elapsedSeconds === 0) {
      return (
        <View style={styles.finishedContainer}>
          <Notice
            tone="info"
            message="This session was too short to save."
            style={styles.saveNotice}
          />
          <TouchableOpacity
            style={styles.backHomeButton}
            activeOpacity={0.85}
            onPress={() => goBack('/reading')}
            accessibilityRole="button"
          >
            <BookOpen size={18} color={COLORS.white} />
            <Text style={styles.backHomeButtonText}>BACK TO MY READING</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const saving = saveState === 'saving';

    return (
      <View style={styles.reviewForm}>
        {book ? (
          <>
            <Text style={styles.reviewLabel}>WHAT PAGE DID YOU REACH?</Text>
            <View style={styles.pageRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.pageInput,
                  pageError && styles.inputError,
                  finishedBook && styles.inputDisabled,
                ]}
                value={finishedBook ? String(book.pages) : endPage}
                onChangeText={(value) => {
                  setEndPage(value.replace(/[^0-9]/g, ''));
                  setPageError('');
                }}
                editable={!finishedBook && !saving}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={6}
                accessibilityLabel={`Page reached in ${book.title}`}
              />
              <Text style={styles.ofPages}>of {book.pages}</Text>
            </View>
            {pageError ? <Text style={styles.fieldError}>{pageError}</Text> : null}

            <Pressable
              onPress={() => {
                setFinishedBook((value) => !value);
                setPageError('');
              }}
              disabled={saving}
              style={[styles.finishToggle, finishedBook && styles.finishToggleOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: finishedBook }}
            >
              {finishedBook ? (
                <CheckCircle2 size={20} color={COLORS.done} />
              ) : (
                <Circle size={20} color={COLORS.muted} />
              )}
              <Text style={[styles.finishToggleText, finishedBook && { color: COLORS.done }]}>
                I finished this book!
              </Text>
            </Pressable>
          </>
        ) : null}

        <Text style={styles.reviewLabel}>YOUR IMPRESSIONS (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={impressions}
          onChangeText={setImpressions}
          placeholder="A thought, a favourite line, how it made you feel..."
          placeholderTextColor={COLORS.muted}
          multiline
          maxLength={4000}
          editable={!saving}
          accessibilityLabel="Impressions about this session"
        />
        <Text style={styles.helperText}>
          Writing something completes the “Share your thoughts” quest.
        </Text>

        {saveState === 'error' ? (
          <Notice tone="error" message={saveError} style={styles.saveNotice} />
        ) : null}

        <TouchableOpacity
          style={[styles.backHomeButton, saving && styles.disabledButton]}
          activeOpacity={0.85}
          onPress={saveSession}
          disabled={saving}
          accessibilityRole="button"
          accessibilityState={{ busy: saving }}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Check size={18} color={COLORS.white} />
          )}
          <Text style={styles.backHomeButtonText}>
            {saving ? 'SAVING...' : 'SAVE SESSION'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ------------------------------------------------
  // SCREEN
  // ------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.8}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Back to reading"
          >
            <ArrowLeft size={19} color={COLORS.dark} />
            <Text style={styles.backButtonText}>BACK TO READING</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.eyebrow}>PAWS & PAGES</Text>
            <Text style={styles.title}>
              {phase === 'pick'
                ? 'What are you reading?'
                : phase === 'review'
                  ? 'Beautifully done!'
                  : 'Your reading time'}
            </Text>
            <Text style={styles.subtitle}>
              {phase === 'pick'
                ? 'Choose a book from your currently reading list.'
                : phase === 'review'
                  ? 'You made time for yourself today.'
                  : book
                    ? `${book.title} · page ${book.currentPage} of ${book.pages}`
                    : 'Slow down, get cozy and enjoy your book.'}
            </Text>
          </View>

          {phase === 'pick' ? (
            renderPicker()
          ) : phase === 'loading' ? (
            <StateCard
              loading={loading}
              loadingText="Opening your book..."
              error={error}
              onRetry={refresh}
            />
          ) : (
            <View style={[styles.contentRow, !isWideLayout && styles.contentColumn]}>
              <View
                style={[styles.mascotCard, isWideLayout ? styles.wideCard : styles.mobileCard]}
              >
                <View style={styles.videoContainer}>
                  <AnimatedMascot animation="original" size={width < 400 ? 240 : 300} />
                </View>

                <Text style={styles.mascotTitle}>
                  {phase === 'review'
                    ? 'Laica is proud of you!'
                    : 'Laica is keeping you company'}
                </Text>

                <Text style={styles.mascotSubtitle}>
                  {phase === 'review'
                    ? 'Every little reading moment counts.'
                    : 'A cozy little reading date, just for you.'}
                </Text>
              </View>

              <View
                style={[styles.timerCard, isWideLayout ? styles.wideCard : styles.mobileCard]}
              >
                <View style={styles.timerIcon}>
                  <Timer size={25} color={COLORS.accent} strokeWidth={1.7} />
                </View>

                <Text style={styles.timerEyebrow}>
                  {phase === 'review' ? 'YOU READ FOR' : 'YOUR FOCUS TIME'}
                </Text>

                <Text style={styles.timerDisplay}>{formatTime(elapsedSeconds)}</Text>

                {phase === 'reading' ? (
                  <>
                    <View style={styles.statusContainer}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isRunning ? '#8BAF91' : COLORS.muted },
                        ]}
                      />
                      <Text style={styles.timerCaption}>
                        {isRunning ? 'YOUR SESSION IS IN PROGRESS' : 'SESSION PAUSED'}
                      </Text>
                    </View>

                    <View style={styles.buttons}>
                      <TouchableOpacity
                        style={[styles.mainButton, !isRunning && styles.resumeButton]}
                        activeOpacity={0.85}
                        onPress={() => setIsRunning((value) => !value)}
                      >
                        {isRunning ? (
                          <Pause size={18} color={COLORS.dark} />
                        ) : (
                          <Play size={18} color={COLORS.white} fill={COLORS.white} />
                        )}
                        <Text
                          style={[styles.mainButtonText, !isRunning && styles.resumeButtonText]}
                        >
                          {isRunning ? 'PAUSE' : 'RESUME READING'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.finishButton}
                        activeOpacity={0.85}
                        onPress={handleFinish}
                      >
                        <Check size={18} color={COLORS.white} />
                        <Text style={styles.finishButtonText}>FINISH SESSION</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  renderReview()
                )}
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>A LITTLE TIME FOR YOURSELF</Text>
            <Text style={styles.footerSubtext}>made with love, paws & pages</Text>
          </View>
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
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 25,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: COLORS.white,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  backButtonText: {
    color: COLORS.dark,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  header: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  eyebrow: {
    color: COLORS.accent,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    color: COLORS.dark,
    fontSize: 32,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    textAlign: 'center',
    marginTop: 8,
  },

  // PICKER
  pickCard: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickNotice: {
    marginBottom: 14,
  },
  noBooks: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  noBooksText: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: 'Nunito_400Regular',
  },
  addBookLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  addBookLinkText: {
    color: COLORS.dark,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: 'Nunito_800ExtraBold',
  },
  options: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 11,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  optionSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.card,
  },
  optionCover: {
    width: 44,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    color: COLORS.dark,
    fontSize: 14,
    fontFamily: 'Nunito_800ExtraBold',
  },
  optionMeta: {
    color: COLORS.text,
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 3,
  },
  startButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 15,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  startButtonText: {
    color: COLORS.white,
    fontSize: 11,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },

  // SESSION
  contentRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 20,
  },
  contentColumn: {
    flexDirection: 'column',
  },
  wideCard: {
    flex: 1,
  },
  mobileCard: {
    width: '100%',
  },
  mascotCard: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  videoContainer: {
    width: '100%',
    minHeight: 300,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: COLORS.card,
  },
  mascotTitle: {
    color: COLORS.dark,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
    marginTop: 14,
  },
  mascotSubtitle: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: 5,
  },
  timerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  timerIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  timerEyebrow: {
    color: COLORS.accent,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2,
    textAlign: 'center',
  },
  timerDisplay: {
    color: COLORS.dark,
    fontSize: 48,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerCaption: {
    color: COLORS.text,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 0.7,
    textAlign: 'center',
  },
  buttons: {
    width: '100%',
    gap: 12,
    marginTop: 27,
  },
  mainButton: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mainButtonText: {
    color: COLORS.dark,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  resumeButton: {
    backgroundColor: COLORS.dark,
  },
  resumeButtonText: {
    color: COLORS.white,
  },
  finishButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  finishButtonText: {
    color: COLORS.white,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },

  // REVIEW
  finishedContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 18,
  },
  reviewForm: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  reviewLabel: {
    color: COLORS.accent,
    fontSize: 10,
    letterSpacing: 1.5,
    fontFamily: 'Nunito_800ExtraBold',
    marginTop: 16,
    marginBottom: 8,
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.dark,
    fontSize: 14,
    fontFamily: 'Nunito_600SemiBold',
    outlineStyle: 'none',
  } as any,
  pageInput: {
    width: 110,
    fontSize: 18,
    fontFamily: 'Nunito_800ExtraBold',
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#D98A97',
    backgroundColor: '#FFF5F6',
  },
  inputDisabled: {
    opacity: 0.6,
  },
  ofPages: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
  },
  fieldError: {
    color: '#B44B58',
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    marginTop: 6,
  },
  finishToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: COLORS.white,
  },
  finishToggleOn: {
    backgroundColor: COLORS.doneSoft,
  },
  finishToggleText: {
    color: COLORS.dark,
    fontSize: 13,
    fontFamily: 'Nunito_800ExtraBold',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: 'Nunito_400Regular',
    marginTop: 6,
  },
  saveNotice: {
    alignSelf: 'stretch',
    marginTop: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  backHomeButton: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.dark,
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  backHomeButtonText: {
    color: COLORS.white,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
    marginTop: 18,
  },
  footerText: {
    color: COLORS.accent,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 2,
  },
  footerSubtext: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: 'Nunito_400Regular',
    marginTop: 6,
  },
});
