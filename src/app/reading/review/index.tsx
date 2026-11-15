import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  NotebookPen,
  PencilLine,
  Star,
} from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { StarRating } from '@/components/reading/StarRating';
import { StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage, useApi } from '@/lib/api';
import { goBack } from '@/lib/navigation';
import { getReviews, type ReviewedBook, type ReviewsOverview } from '@/lib/readingApi';

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const openReview = (bookId: string) =>
  router.push({ pathname: '/reading/review/[bookId]', params: { bookId } });

function Cover({ book, size }: { book: ReviewedBook; size: 'small' | 'large' }) {
  return (
    <View style={[styles.cover, size === 'small' ? styles.coverSmall : styles.coverLarge]}>
      {book.coverUrl ? (
        <Image source={{ uri: book.coverUrl }} style={styles.coverImage} resizeMode="cover" />
      ) : (
        <BookOpen size={size === 'small' ? 18 : 24} color={PALETTE.purple} />
      )}
    </View>
  );
}

/** All of the user's book reviews, plus finished books still waiting for one. */
export default function ReviewsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const { getAccessToken } = useApi();

  const [data, setData] = useState<ReviewsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;

    try {
      setLoading(true);
      setError(null);

      const result = await getReviews(await getAccessToken());

      if (id === requestId.current) setData(result);
    } catch (err) {
      console.error('Reviews load error:', err);

      if (id === requestId.current) {
        setError(getErrorMessage(err, "We couldn't load your reviews."));
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [getAccessToken]);

  // Reload when coming back from the editor.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const reviews = data?.reviews ?? [];
  const awaiting = data?.awaiting ?? [];

  const average =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  const renderAwaiting = () => {
    if (awaiting.length === 0) return null;

    return (
      <>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Waiting for your review</Text>
            <Text style={styles.sectionSubtitle}>
              Books you finished but haven’t rated yet.
            </Text>
          </View>
          <PencilLine size={22} color={PALETTE.darkPink} strokeWidth={1.7} />
        </View>

        <View style={styles.list}>
          {awaiting.map((book) => (
            <Pressable
              key={book.id}
              onPress={() => openReview(book.id)}
              style={({ pressed }) => [styles.awaitingRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Write a review of ${book.title} by ${book.author}`}
            >
              <Cover book={book} size="small" />

              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {book.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {book.author}
                  {formatDate(book.finishedAt) ? ` · finished ${formatDate(book.finishedAt)}` : ''}
                </Text>
              </View>

              <View style={styles.reviewChip}>
                <Star size={13} color={PALETTE.white} />
                {isCompact ? null : <Text style={styles.reviewChipText}>Review</Text>}
              </View>
            </Pressable>
          ))}
        </View>
      </>
    );
  };

  const renderReviews = () => {
    if (reviews.length === 0) {
      if (awaiting.length > 0) return null;

      return (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <NotebookPen size={28} color={PALETTE.purple} />
          </View>
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptyText}>
            When you finish a book, we’ll ask how you liked it. Your ratings and
            thoughts will be collected here.
          </Text>
          <Pressable
            onPress={() => router.dismissTo('/reading')}
            style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <BookOpen size={16} color={PALETTE.white} />
            <Text style={styles.emptyButtonText}>GO TO MY READING</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <View style={[styles.sectionHeader, awaiting.length > 0 && styles.sectionSpacing]}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Your reviews</Text>
            <Text style={styles.sectionSubtitle}>Tap a review to change it.</Text>
          </View>
          <NotebookPen size={22} color={PALETTE.purple} strokeWidth={1.7} />
        </View>

        <View style={styles.list}>
          {reviews.map((review) => {
            const date = formatDate(review.updatedAt);

            return (
              <Pressable
                key={review.id}
                onPress={() => openReview(review.bookId)}
                style={({ pressed }) => [styles.reviewCard, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${review.book.title}, ${review.rating} out of 5 stars. Edit review.`}
              >
                <Cover book={review.book} size="large" />

                <View style={styles.rowText}>
                  <Text style={styles.reviewTitle} numberOfLines={2}>
                    {review.book.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {review.book.author}
                  </Text>

                  <StarRating value={review.rating} size={16} style={styles.stars} />

                  {review.body ? (
                    <Text style={styles.reviewBody} numberOfLines={4}>
                      {review.body}
                    </Text>
                  ) : (
                    <Text style={styles.reviewNoBody}>Just a rating, no words this time.</Text>
                  )}

                  {date ? <Text style={styles.reviewDate}>Reviewed {date}</Text> : null}
                </View>

                {isCompact ? null : <ArrowRight size={17} color={PALETTE.text} />}
              </Pressable>
            );
          })}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container, isCompact && styles.containerCompact]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => goBack('/reading')}
          accessibilityRole="button"
          accessibilityLabel="Back to reading"
        >
          <ArrowLeft size={18} color={PALETTE.text} />
          <Text style={styles.backText}>BACK TO READING</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>YOUR BOOK THOUGHTS</Text>
            <Text style={[styles.title, isCompact && styles.titleCompact]}>Book reviews</Text>
            <Text style={styles.subtitle}>
              {data
                ? reviews.length > 0
                  ? `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'} · ${average.toFixed(1)} stars on average`
                  : 'Every book leaves a little something behind.'
                : 'Every book leaves a little something behind.'}
            </Text>
          </View>

          {isCompact ? null : (
            <View style={styles.headerIcon}>
              <NotebookPen size={28} color={PALETTE.purple} strokeWidth={1.6} />
            </View>
          )}
        </View>

        {!data ? (
          <StateCard
            loading={loading}
            loadingText="Gathering your reviews..."
            error={error}
            onRetry={refresh}
          />
        ) : (
          <>
            {renderAwaiting()}
            {renderReviews()}
          </>
        )}
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
    paddingHorizontal: 40,
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
    backgroundColor: PALETTE.white,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  backText: {
    color: PALETTE.text,
    fontSize: 10,
    fontFamily: FONT.bodyExtraBold,
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 26,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: PALETTE.purple,
    fontSize: 10,
    fontFamily: FONT.bodyExtraBold,
    letterSpacing: 2,
    marginBottom: 9,
  },
  title: {
    color: PALETTE.text,
    fontSize: 32,
    fontFamily: FONT.heading,
    letterSpacing: -0.5,
  },
  titleCompact: {
    fontSize: 27,
  },
  subtitle: {
    color: PALETTE.muted,
    fontSize: 13,
    fontFamily: FONT.bodyMedium,
    marginTop: 7,
  },
  headerIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  sectionSpacing: {
    marginTop: 32,
  },
  sectionHeading: {
    flex: 1,
  },
  sectionTitle: {
    color: PALETTE.text,
    fontSize: 22,
    fontFamily: FONT.heading,
  },
  sectionSubtitle: {
    color: PALETTE.muted,
    fontSize: 12,
    fontFamily: FONT.body,
    marginTop: 5,
  },
  list: {
    gap: 12,
  },
  cover: {
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverSmall: {
    width: 46,
    height: 68,
  },
  coverLarge: {
    width: 72,
    height: 106,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  awaitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: PALETTE.lightPink,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: PALETTE.pink,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: PALETTE.text,
    fontSize: 14,
    fontFamily: FONT.bodyExtraBold,
  },
  rowMeta: {
    color: PALETTE.muted,
    fontSize: 11,
    fontFamily: FONT.bodyMedium,
    marginTop: 3,
  },
  reviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: PALETTE.darkPink,
  },
  reviewChipText: {
    color: PALETTE.white,
    fontSize: 12,
    fontFamily: FONT.bodyExtraBold,
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  reviewTitle: {
    color: PALETTE.text,
    fontSize: 17,
    lineHeight: 23,
    fontFamily: FONT.heading,
  },
  stars: {
    marginTop: 8,
  },
  reviewBody: {
    color: PALETTE.text,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: FONT.body,
    marginTop: 8,
  },
  reviewNoBody: {
    color: PALETTE.purple,
    fontSize: 11,
    fontStyle: 'italic',
    fontFamily: FONT.body,
    marginTop: 8,
  },
  reviewDate: {
    color: PALETTE.purple,
    fontSize: 10,
    fontFamily: FONT.bodyMedium,
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 25,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: PALETTE.text,
    fontSize: 19,
    fontFamily: FONT.heading,
    textAlign: 'center',
  },
  emptyText: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: FONT.body,
    textAlign: 'center',
    marginTop: 7,
    maxWidth: 380,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    backgroundColor: PALETTE.text,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  emptyButtonText: {
    color: PALETTE.white,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: FONT.bodyExtraBold,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
