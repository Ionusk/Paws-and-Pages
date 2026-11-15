import { router, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    BookOpen,
    Check,
    CheckCircle2,
    NotebookPen,
    PartyPopper,
    Trash2,
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
    useWindowDimensions,
    View,
} from 'react-native';

import { RATING_LABELS, StarRating } from '@/components/reading/StarRating';
import { Notice, StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { ApiError, getErrorMessage, useApi } from '@/lib/api';
import { confirmAction } from '@/lib/feedback';
import { goBack } from '@/lib/navigation';
import {
    deleteReview,
    getReview,
    REVIEW_MAX_LENGTH,
    saveReview,
    type BookReviewDetails,
} from '@/lib/readingApi';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; notFound: boolean }
  | { status: 'ready'; details: BookReviewDetails };

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Rate and review one finished book. Opened right after a book is finished
 * (with `justFinished=1`) and from the reviews list.
 */
export default function BookReviewScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const { getAccessToken } = useApi();
  const params = useLocalSearchParams<{ bookId: string; justFinished?: string }>();
  const bookId = String(params.bookId ?? '');
  const justFinished = params.justFinished === '1';

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [saveError, setSaveError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const details = await getReview(bookId, await getAccessToken());
        if (!active) return;

        setRating(details.review?.rating ?? 0);
        setBody(details.review?.body ?? '');
        setLoad({ status: 'ready', details });
      } catch (error) {
        console.error('Review load error:', error);
        if (!active) return;

        setLoad({
          status: 'error',
          notFound: error instanceof ApiError && error.status === 404,
          message: getErrorMessage(error, "We couldn't open this review."),
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [bookId, reloadKey, getAccessToken]);

  const retry = () => {
    setLoad({ status: 'loading' });
    setReloadKey((key) => key + 1);
  };

  const details = load.status === 'ready' ? load.details : null;
  const existing = details?.review ?? null;
  const busy = saveState === 'saving' || deleting;

  const dirty =
    rating !== (existing?.rating ?? 0) ||
    body.trim() !== (existing?.body ?? '').trim();

  const showSaved = saveState === 'saved' && !dirty;

  const editRating = (value: number) => {
    setRating(value);
    if (saveState !== 'saving') setSaveState('idle');
  };

  const editBody = (value: string) => {
    setBody(value);
    if (saveState !== 'saving') setSaveState('idle');
  };

  const save = async () => {
    if (!details || busy) return;

    if (rating < 1) {
      setSaveState('error');
      setSaveError('Tap a star to rate the book first.');
      return;
    }

    try {
      setSaveState('saving');
      setSaveError('');

      const result = await saveReview(
        bookId,
        { rating, body: body.trim() },
        await getAccessToken()
      );

      setRating(result.review.rating);
      setBody(result.review.body ?? '');
      setLoad({
        status: 'ready',
        details: { ...details, book: result.book, review: result.review, canReview: true },
      });
      setSaveState('saved');
    } catch (error) {
      console.error('Review save error:', error);

      setSaveState('error');
      setSaveError(getErrorMessage(error, "We couldn't save your review."));
    }
  };

  const remove = async () => {
    if (!details || !existing || busy) return;

    const stillFinished = details.book.status === 'finished';
    const ok = await confirmAction({
      title: 'Delete this review?',
      message: stillFinished
        ? 'Your rating and thoughts about this book will be removed.'
        : 'Your rating and thoughts will be removed. You can write a new review when you finish the book again.',
      confirmText: 'Delete',
      destructive: true,
    });

    if (!ok) return;

    try {
      setDeleting(true);
      setSaveError('');

      await deleteReview(bookId, await getAccessToken());

      router.dismissTo('/reading/review');
    } catch (error) {
      console.error('Review delete error:', error);

      setDeleting(false);
      setSaveState('error');
      setSaveError(getErrorMessage(error, "We couldn't delete your review."));
    }
  };

  // ------------------------------------------------
  // PIECES
  // ------------------------------------------------

  const renderBook = () => {
    if (!details) return null;

    const { book } = details;
    const finishedOn = formatDate(book.finishedAt);

    return (
      <View style={[styles.bookCard, isCompact && styles.bookCardCompact]}>
        <View style={[styles.cover, isCompact && styles.coverCompact]}>
          {book.coverUrl ? (
            <Image source={{ uri: book.coverUrl }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <BookOpen size={30} color={PALETTE.purple} />
          )}
        </View>

        <View style={styles.bookInfo}>
          {book.status === 'finished' ? (
            <View style={styles.finishedPill}>
              <CheckCircle2 size={11} color={PALETTE.success} />
              <Text style={styles.finishedPillText}>FINISHED</Text>
            </View>
          ) : (
            <View style={styles.readingPill}>
              <BookOpen size={11} color={PALETTE.purple} />
              <Text style={styles.readingPillText}>READING AGAIN</Text>
            </View>
          )}

          <Text style={[styles.bookTitle, isCompact && styles.bookTitleCompact]} numberOfLines={3}>
            {book.title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={2}>
            {book.author}
          </Text>
          <Text style={styles.bookMeta}>
            {book.pages} pages
            {finishedOn && book.status === 'finished' ? ` · finished ${finishedOn}` : ''}
          </Text>
        </View>
      </View>
    );
  };

  const renderActions = () => {
    if (showSaved) {
      return (
        <>
          <Notice
            tone="success"
            title="Review saved"
            message="You can come back and change it any time."
            style={styles.notice}
          />

          <View style={[styles.actions, isCompact && styles.actionsCompact]}>
            <Pressable
              onPress={() => router.dismissTo('/reading/review')}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <NotebookPen size={17} color={PALETTE.white} />
              <Text style={styles.primaryText}>ALL MY REVIEWS</Text>
            </Pressable>

            <Pressable
              onPress={() => router.dismissTo('/reading')}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <BookOpen size={17} color={PALETTE.text} />
              <Text style={styles.secondaryText}>BACK TO MY READING</Text>
            </Pressable>
          </View>
        </>
      );
    }

    const saving = saveState === 'saving';

    return (
      <>
        {saveState === 'error' && saveError ? (
          <Notice
            tone="error"
            message={saveError}
            onDismiss={() => setSaveState('idle')}
            style={styles.notice}
          />
        ) : null}

        <View style={[styles.actions, isCompact && styles.actionsCompact]}>
          <Pressable
            onPress={save}
            disabled={busy || rating < 1 || (Boolean(existing) && !dirty)}
            style={({ pressed }) => [
              styles.primary,
              (busy || rating < 1 || (Boolean(existing) && !dirty)) && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{
              disabled: busy || rating < 1 || (Boolean(existing) && !dirty),
              busy: saving,
            }}
          >
            {saving ? (
              <ActivityIndicator color={PALETTE.white} />
            ) : (
              <Check size={17} color={PALETTE.white} />
            )}
            <Text style={styles.primaryText}>
              {saving ? 'SAVING...' : existing ? 'SAVE CHANGES' : 'SAVE REVIEW'}
            </Text>
          </Pressable>

          {existing ? null : (
            <Pressable
              onPress={() => goBack('/reading')}
              disabled={busy}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>SKIP FOR NOW</Text>
            </Pressable>
          )}
        </View>
      </>
    );
  };

  const renderForm = () => {
    if (!details) return null;

    if (!details.canReview) {
      return (
        <View style={styles.formCard}>
          <Notice
            tone="info"
            title="Finish the book first"
            message="Reviews are for books you have finished. Mark it as finished, or reach its last page, and you can rate it here."
          />
          <Pressable
            onPress={() => router.dismissTo('/reading')}
            style={({ pressed }) => [styles.primary, styles.singleAction, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <BookOpen size={17} color={PALETTE.white} />
            <Text style={styles.primaryText}>BACK TO MY READING</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.formCard}>
        <Text style={styles.label}>YOUR RATING</Text>
        <StarRating
          value={rating}
          onChange={editRating}
          size={isCompact ? 34 : 38}
          disabled={busy}
        />
        <Text style={[styles.ratingLabel, rating < 1 && styles.ratingHint]}>
          {rating > 0 ? RATING_LABELS[rating] : 'Tap a star to rate it'}
        </Text>

        <Text style={styles.label}>YOUR THOUGHTS (OPTIONAL)</Text>
        <TextInput
          style={styles.textArea}
          value={body}
          onChangeText={editBody}
          placeholder="What did you love? What stayed with you? Would you recommend it?"
          placeholderTextColor={PALETTE.purple}
          multiline
          maxLength={REVIEW_MAX_LENGTH}
          editable={!busy}
          accessibilityLabel="Your thoughts about the book, optional"
        />
        <View style={styles.formFooter}>
          <Text style={styles.sharedNote}>Your friends can see your rating and review.</Text>
          <Text style={styles.counter}>
            {body.length}/{REVIEW_MAX_LENGTH}
          </Text>
        </View>

        {renderActions()}

        {existing ? (
          <Pressable
            onPress={remove}
            disabled={busy}
            style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ busy: deleting }}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={PALETTE.danger} />
            ) : (
              <Trash2 size={14} color={PALETTE.danger} />
            )}
            <Text style={styles.deleteText}>{deleting ? 'Deleting...' : 'Delete review'}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderContent = () => {
    if (load.status === 'loading') {
      return <StateCard loading loadingText="Opening your book..." />;
    }

    if (load.status === 'error') {
      if (load.notFound) {
        return (
          <View style={styles.formCard}>
            <Notice
              tone="error"
              title="Book not found"
              message="This book isn't on your bookshelf anymore."
            />
            <Pressable
              onPress={() => router.dismissTo('/reading/review')}
              style={({ pressed }) => [styles.primary, styles.singleAction, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <NotebookPen size={17} color={PALETTE.white} />
              <Text style={styles.primaryText}>ALL MY REVIEWS</Text>
            </Pressable>
          </View>
        );
      }

      return <StateCard error={load.message} onRetry={retry} />;
    }

    return (
      <View style={styles.content}>
        {renderBook()}
        {renderForm()}
      </View>
    );
  };

  const celebrating = justFinished && !existing && saveState !== 'saved';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container, isCompact && styles.containerCompact]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => goBack('/reading/review')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={18} color={PALETTE.text} />
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

        <View style={styles.header}>
          {celebrating ? (
            <View style={styles.headerIcon}>
              <PartyPopper size={26} color={PALETTE.darkPink} />
            </View>
          ) : null}
          <Text style={styles.eyebrow}>
            {celebrating ? 'YOU FINISHED A BOOK' : 'YOUR BOOK REVIEW'}
          </Text>
          <Text style={[styles.title, isCompact && styles.titleCompact]}>
            {celebrating ? 'How was it?' : existing ? 'Your review' : 'Write a review'}
          </Text>
          <Text style={styles.subtitle}>
            {celebrating
              ? 'Congratulations! Leave a rating while the story is still fresh.'
              : 'A few stars and a few words, for future you.'}
          </Text>
        </View>

        {renderContent()}
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
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 30,
    paddingTop: 25,
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
    backgroundColor: PALETTE.white,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  backText: {
    color: PALETTE.text,
    fontSize: 10,
    fontFamily: FONT.bodyExtraBold,
    letterSpacing: 1,
  },
  header: {
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 20,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: PALETTE.lightPink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  eyebrow: {
    color: PALETTE.purple,
    fontSize: 10,
    fontFamily: FONT.bodyExtraBold,
    letterSpacing: 3,
  },
  title: {
    color: PALETTE.text,
    fontSize: 31,
    fontFamily: FONT.heading,
    textAlign: 'center',
    marginTop: 8,
  },
  titleCompact: {
    fontSize: 27,
  },
  subtitle: {
    color: PALETTE.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.bodyMedium,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 440,
  },
  content: {
    gap: 14,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: PALETTE.white,
    borderRadius: 25,
    padding: 20,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  bookCardCompact: {
    gap: 14,
    padding: 16,
  },
  cover: {
    width: 92,
    height: 136,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverCompact: {
    width: 74,
    height: 110,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  bookInfo: {
    flex: 1,
  },
  finishedPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PALETTE.successSoft,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  finishedPillText: {
    color: PALETTE.success,
    fontSize: 9,
    letterSpacing: 1.4,
    fontFamily: FONT.bodyExtraBold,
  },
  readingPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PALETTE.lavender,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  readingPillText: {
    color: PALETTE.purple,
    fontSize: 9,
    letterSpacing: 1.4,
    fontFamily: FONT.bodyExtraBold,
  },
  bookTitle: {
    color: PALETTE.text,
    fontSize: 20,
    lineHeight: 27,
    fontFamily: FONT.heading,
  },
  bookTitleCompact: {
    fontSize: 17,
    lineHeight: 23,
  },
  bookAuthor: {
    color: PALETTE.muted,
    fontSize: 12,
    fontFamily: FONT.bodyMedium,
    marginTop: 5,
  },
  bookMeta: {
    color: PALETTE.purple,
    fontSize: 10,
    fontFamily: FONT.bodyMedium,
    marginTop: 10,
  },
  formCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 25,
    padding: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  label: {
    color: PALETTE.purple,
    fontSize: 10,
    letterSpacing: 1.5,
    fontFamily: FONT.bodyExtraBold,
    marginTop: 6,
    marginBottom: 10,
  },
  ratingLabel: {
    color: PALETTE.text,
    fontSize: 14,
    fontFamily: FONT.bodyExtraBold,
    marginTop: 8,
    marginBottom: 18,
  },
  ratingHint: {
    color: PALETTE.muted,
    fontFamily: FONT.bodyMedium,
  },
  textArea: {
    minHeight: 150,
    backgroundColor: PALETTE.lavender,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 13,
    color: PALETTE.text,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONT.bodyMedium,
    textAlignVertical: 'top',
    outlineStyle: 'none',
  } as any,
  formFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  sharedNote: {
    flex: 1,
    color: PALETTE.purple,
    fontSize: 10,
    fontFamily: FONT.bodyMedium,
  },
  counter: {
    color: PALETTE.purple,
    fontSize: 10,
    fontFamily: FONT.bodyMedium,
  },
  notice: {
    marginTop: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  actionsCompact: {
    flexDirection: 'column',
  },
  primary: {
    flexGrow: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 15,
    paddingHorizontal: 18,
    backgroundColor: PALETTE.text,
  },
  singleAction: {
    marginTop: 16,
  },
  primaryText: {
    color: PALETTE.white,
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: FONT.bodyExtraBold,
  },
  secondary: {
    flexGrow: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 15,
    paddingHorizontal: 18,
    backgroundColor: PALETTE.lavender,
  },
  secondaryText: {
    color: PALETTE.text,
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: FONT.bodyExtraBold,
  },
  disabled: {
    opacity: 0.5,
  },
  deleteLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deleteText: {
    color: PALETTE.danger,
    fontSize: 12,
    fontFamily: FONT.bodyExtraBold,
  },
  pressed: {
    opacity: 0.8,
  },
});
