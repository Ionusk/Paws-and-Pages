import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Check,
  Clock,
  GraduationCap,
  Lock,
  NotebookPen,
  Search,
  Sparkles,
  Star,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
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

import { FriendAvatar } from '@/components/friends/FriendAvatar';
import { StarRating } from '@/components/reading/StarRating';
import { Notice, StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage, useApi } from '@/lib/api';
import {
  acceptFriendRequest,
  dismissFriendRequest,
  formatMinutes,
  formatRelativeTime,
  getFriendActivity,
  getFriendReviews,
  getFriends,
  searchPeople,
  sendFriendRequest,
  type ActivityItem,
  type FeedBook,
  type FriendSearchResult,
  type FriendsOverview,
  type FriendUser,
  type Relationship,
  type SharedReview,
} from '@/lib/friendsApi';
import { goBack } from '@/lib/navigation';

type Tab = 'activity' | 'friends' | 'reviews';

const openProfile = (user: FriendUser) =>
  router.push({ pathname: '/friends/[userId]', params: { userId: String(user.id) } });

function BookThumb({ book }: { book: FeedBook }) {
  return (
    <View style={styles.thumb}>
      {book.coverUrl ? (
        <Image source={{ uri: book.coverUrl }} style={styles.thumbImage} resizeMode="cover" />
      ) : (
        <BookOpen size={16} color={PALETTE.purple} />
      )}
    </View>
  );
}

export default function FriendsScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const { getAccessToken } = useApi();

  // ------------------------------------------------
  // DATA (reloaded whenever the screen is focused)
  // ------------------------------------------------

  const [overview, setOverview] = useState<FriendsOverview | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [reviews, setReviews] = useState<SharedReview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const [friends, feed, shared] = await Promise.allSettled([
        getFriends(token),
        getFriendActivity(token),
        getFriendReviews(token),
      ]);

      if (id !== requestId.current) return;

      setLoadedAt(Date.now());

      if (friends.status === 'fulfilled') setOverview(friends.value);
      else setError(getErrorMessage(friends.reason, "We couldn't load your friends."));

      if (feed.status === 'fulfilled') {
        setActivity(feed.value);
        setFeedError(null);
      } else {
        setFeedError(getErrorMessage(feed.reason, "We couldn't load your friends' activity."));
      }

      if (shared.status === 'fulfilled') {
        setReviews(shared.value);
        setReviewsError(null);
      } else {
        setReviewsError(getErrorMessage(shared.reason, "We couldn't load your friends' reviews."));
      }
    } catch (err) {
      console.error('Friends load error:', err);
      if (id === requestId.current) {
        setError(getErrorMessage(err, "We couldn't load your friends."));
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [getAccessToken]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const friends = overview?.friends ?? [];
  const incoming = overview?.incoming ?? [];
  const outgoing = overview?.outgoing ?? [];

  const [tab, setTab] = useState<Tab>('activity');

  // ------------------------------------------------
  // SEARCH (as you type)
  // ------------------------------------------------

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchedFor, setSearchedFor] = useState('');
  const searchId = useRef(0);

  const text = query.trim().replace(/^@/, '');

  useEffect(() => {
    if (text.length < 2) {
      // Results are hidden below 2 letters; drop any search in flight.
      searchId.current++;
      return;
    }

    const id = ++searchId.current;
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setSearchError('');

        const found = await searchPeople(text, await getAccessToken());

        if (id === searchId.current) {
          setResults(found);
          setSearchedFor(text);
        }
      } catch (err) {
        console.error('Friend search error:', err);
        if (id === searchId.current) {
          setSearchError(getErrorMessage(err, "We couldn't search right now."));
        }
      } finally {
        if (id === searchId.current) setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [text, getAccessToken]);

  // ------------------------------------------------
  // ACTIONS
  // ------------------------------------------------

  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null
  );

  const setRelationship = (userId: number, relationship: Relationship) =>
    setResults((current) =>
      current.map((result) =>
        result.user.id === userId ? { ...result, relationship } : result
      )
    );

  const runAction = async (
    user: FriendUser,
    action: (token: string) => Promise<Relationship>,
    success: (relationship: Relationship) => string
  ) => {
    if (busyId !== null) return;

    try {
      setBusyId(user.id);
      setNotice(null);

      const relationship = await action(await getAccessToken());

      setRelationship(user.id, relationship);
      setNotice({ tone: 'success', message: success(relationship) });
      refresh();
    } catch (err) {
      console.error('Friend action error:', err);
      setNotice({
        tone: 'error',
        message: getErrorMessage(err, 'Something went wrong. Please try again.'),
      });
    } finally {
      setBusyId(null);
    }
  };

  const addFriend = (user: FriendUser) =>
    runAction(
      user,
      (token) => sendFriendRequest(user.username, token),
      (relationship) =>
        relationship === 'friends'
          ? `You and @${user.username} are now friends!`
          : `Friend request sent to @${user.username}.`
    );

  const accept = (user: FriendUser) =>
    runAction(
      user,
      async (token) => {
        await acceptFriendRequest(user.id, token);
        return 'friends';
      },
      () => `You and @${user.username} are now friends!`
    );

  const dismiss = (user: FriendUser, kind: 'decline' | 'cancel') =>
    runAction(
      user,
      async (token) => {
        await dismissFriendRequest(user.id, token);
        return 'none';
      },
      () =>
        kind === 'decline'
          ? `Request from @${user.username} declined.`
          : `Request to @${user.username} cancelled.`
    );

  // ------------------------------------------------
  // PIECES
  // ------------------------------------------------

  const renderSearchAction = ({ user, relationship }: FriendSearchResult) => {
    const busy = busyId === user.id;

    if (relationship === 'friends') {
      return (
        <Pressable
          onPress={() => openProfile(user)}
          style={({ pressed }) => [styles.chip, styles.chipDone, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`@${user.username} is your friend. Open profile.`}
        >
          <Check size={14} color={PALETTE.success} />
          <Text style={[styles.chipText, { color: PALETTE.success }]}>Friends</Text>
        </Pressable>
      );
    }

    if (relationship === 'outgoing') {
      return (
        <Pressable
          onPress={() => dismiss(user, 'cancel')}
          disabled={busyId !== null}
          style={({ pressed }) => [styles.chip, styles.chipSoft, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Request sent to @${user.username}. Cancel request.`}
        >
          {busy ? (
            <ActivityIndicator size="small" color={PALETTE.text} />
          ) : (
            <Clock size={14} color={PALETTE.text} />
          )}
          <Text style={styles.chipText}>Requested</Text>
        </Pressable>
      );
    }

    const isIncoming = relationship === 'incoming';

    return (
      <Pressable
        onPress={() => (isIncoming ? accept(user) : addFriend(user))}
        disabled={busyId !== null}
        style={({ pressed }) => [styles.chip, styles.chipPrimary, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={
          isIncoming
            ? `Accept the friend request from @${user.username}`
            : `Send a friend request to @${user.username}`
        }
      >
        {busy ? (
          <ActivityIndicator size="small" color={PALETTE.white} />
        ) : isIncoming ? (
          <Check size={14} color={PALETTE.white} />
        ) : (
          <UserPlus size={14} color={PALETTE.white} />
        )}
        <Text style={[styles.chipText, { color: PALETTE.white }]}>
          {isIncoming ? 'Accept' : 'Add'}
        </Text>
      </Pressable>
    );
  };

  const renderFind = () => (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <UserPlus size={20} color={PALETTE.purple} />
        <Text style={styles.cardTitle}>Find friends</Text>
      </View>

      <View style={styles.searchBox}>
        <Search size={17} color={PALETTE.purple} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username, e.g. @laica_reads"
          placeholderTextColor={PALETTE.purple}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          maxLength={21}
          accessibilityLabel="Search people by username"
        />
        {searching && text.length >= 2 ? (
          <ActivityIndicator size="small" color={PALETTE.purple} />
        ) : query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={16} color={PALETTE.muted} />
          </Pressable>
        ) : null}
      </View>

      {text.length < 2 ? (
        <Text style={styles.hint}>
          Ask your friends for their Paws & Pages username and type it here.
        </Text>
      ) : searchError ? (
        <Notice tone="error" message={searchError} style={styles.innerNotice} />
      ) : results.length > 0 && searchedFor === text ? (
        <View style={styles.results}>
          {results.map((result) => (
            <View key={result.user.id} style={styles.personRow}>
              <FriendAvatar username={result.user.username} size={38} />
              <Text style={styles.personName} numberOfLines={1}>
                @{result.user.username}
              </Text>
              {renderSearchAction(result)}
            </View>
          ))}
        </View>
      ) : !searching && searchedFor === text ? (
        <Text style={styles.hint}>Nobody with a username starting with “{text}”.</Text>
      ) : null}
    </View>
  );

  const renderIncoming = () => {
    if (incoming.length === 0) return null;

    return (
      <View style={[styles.card, styles.requestsCard]}>
        <View style={styles.cardHeading}>
          <Sparkles size={20} color={PALETTE.darkPink} />
          <Text style={styles.cardTitle}>
            {incoming.length === 1 ? 'A friend request' : `${incoming.length} friend requests`}
          </Text>
        </View>

        {incoming.map(({ user, sentAt }) => {
          const busy = busyId === user.id;

          return (
            <View key={user.id} style={styles.personRow}>
              <FriendAvatar username={user.username} size={40} />
              <View style={styles.personText}>
                <Text style={styles.personName} numberOfLines={1}>
                  @{user.username}
                </Text>
                <Text style={styles.personMeta}>
                  wants to be friends · {formatRelativeTime(sentAt, loadedAt)}
                </Text>
              </View>

              <Pressable
                onPress={() => accept(user)}
                disabled={busyId !== null}
                style={({ pressed }) => [styles.chip, styles.chipPrimary, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Accept the friend request from @${user.username}`}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={PALETTE.white} />
                ) : (
                  <Check size={14} color={PALETTE.white} />
                )}
                {isCompact ? null : (
                  <Text style={[styles.chipText, { color: PALETTE.white }]}>Accept</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => dismiss(user, 'decline')}
                disabled={busyId !== null}
                style={({ pressed }) => [styles.chip, styles.chipSoft, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Decline the friend request from @${user.username}`}
              >
                <X size={14} color={PALETTE.text} />
                {isCompact ? null : <Text style={styles.chipText}>Decline</Text>}
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  };

  const renderTabs = () => {
    const tabs: { id: Tab; label: string; Icon: typeof Sparkles }[] = [
      { id: 'activity', label: 'Activity', Icon: Sparkles },
      { id: 'friends', label: friends.length ? `Friends (${friends.length})` : 'Friends', Icon: UsersRound },
      { id: 'reviews', label: 'Reviews', Icon: NotebookPen },
    ];

    return (
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map(({ id, label, Icon }) => {
          const selected = tab === id;

          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.tab, selected && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Icon size={15} color={selected ? PALETTE.white : PALETTE.text} />
              <Text style={[styles.tabText, selected && styles.tabTextActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderEmpty = (title: string, message: string) => (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <UsersRound size={26} color={PALETTE.sageDark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  const describeActivity = (item: ActivityItem) => {
    const title = item.book?.title;

    switch (item.type) {
      case 'finished':
        return { Icon: BookOpenCheck, color: PALETTE.success, text: `finished “${title}”` };
      case 'started':
        return { Icon: BookOpen, color: PALETTE.purple, text: `started reading “${title}”` };
      case 'review':
        return { Icon: Star, color: '#C99A4E', text: `reviewed “${title}”` };
      case 'reading': {
        const where = title
          ? ` of “${title}”`
          : (item.bookCount ?? 0) > 1
            ? ` across ${item.bookCount} books`
            : '';
        return {
          Icon: Clock,
          color: PALETTE.darkPink,
          text: `read for ${formatMinutes(item.minutes ?? 0)}${where}`,
        };
      }
      case 'quiz': {
        const score = item.bestTotal ? `${item.bestScore}/${item.bestTotal}` : '';
        return {
          Icon: GraduationCap,
          color: PALETTE.sageDark,
          text:
            (item.quizCount ?? 1) === 1
              ? `finished a practice quiz${score ? ` · ${score}` : ''}`
              : `finished ${item.quizCount} practice quizzes${score ? ` · best ${score}` : ''}`,
        };
      }
    }
  };

  const renderActivity = () => {
    if (friends.length === 0) {
      return renderEmpty(
        'Your feed is waiting for friends',
        'Add friends above to see the books they start, finish and review, and how their studying goes.'
      );
    }

    if (!activity) {
      return <StateCard loading={loading} error={feedError} onRetry={refresh} />;
    }

    if (activity.length === 0) {
      return renderEmpty(
        'All quiet for now',
        'Nothing new from your friends in the last 30 days. Maybe start a reading session and inspire them?'
      );
    }

    return (
      <View style={styles.list}>
        {feedError ? <Notice tone="error" message={feedError} /> : null}

        {activity.map((item) => {
          const { Icon, color, text: summary } = describeActivity(item);

          return (
            <Pressable
              key={item.id}
              onPress={() => openProfile(item.user)}
              style={({ pressed }) => [styles.feedItem, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`@${item.user.username} ${summary}, ${formatRelativeTime(item.at, loadedAt)}`}
            >
              <View>
                <FriendAvatar username={item.user.username} size={42} />
                <View style={[styles.feedBadge, { backgroundColor: color }]}>
                  <Icon size={11} color={PALETTE.white} />
                </View>
              </View>

              <View style={styles.feedText}>
                <Text style={styles.feedSentence}>
                  <Text style={styles.feedUser}>@{item.user.username}</Text> {summary}
                </Text>

                {item.type === 'review' && item.rating ? (
                  <StarRating value={item.rating} size={14} style={styles.feedStars} />
                ) : null}

                {item.type === 'review' && item.excerpt ? (
                  <Text style={styles.feedExcerpt} numberOfLines={3}>
                    “{item.excerpt}”
                  </Text>
                ) : null}

                <Text style={styles.feedTime}>{formatRelativeTime(item.at, loadedAt)}</Text>
              </View>

              {item.book && item.type !== 'reading' ? <BookThumb book={item.book} /> : null}
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderFriends = () => (
    <View style={styles.list}>
      {friends.length === 0
        ? renderEmpty(
            'No friends yet',
            'Search for a username above. When they accept, they show up here.'
          )
        : friends.map(({ user, since, currentlyReading }) => (
            <Pressable
              key={user.id}
              onPress={() => openProfile(user)}
              style={({ pressed }) => [styles.friendRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`@${user.username}. Open profile.`}
            >
              <FriendAvatar username={user.username} size={46} />
              <View style={styles.personText}>
                <Text style={styles.personName} numberOfLines={1}>
                  @{user.username}
                </Text>
                <Text style={styles.personMeta} numberOfLines={1}>
                  {currentlyReading
                    ? `Reading “${currentlyReading.title}”`
                    : `Friends since ${new Date(since).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                      })}`}
                </Text>
              </View>
              <ArrowRight size={17} color={PALETTE.text} />
            </Pressable>
          ))}

      {outgoing.length > 0 ? (
        <>
          <Text style={styles.subheading}>WAITING FOR AN ANSWER</Text>
          {outgoing.map(({ user, sentAt }) => (
            <View key={user.id} style={[styles.friendRow, styles.pendingRow]}>
              <FriendAvatar username={user.username} size={38} />
              <View style={styles.personText}>
                <Text style={styles.personName} numberOfLines={1}>
                  @{user.username}
                </Text>
                <Text style={styles.personMeta}>
                  Request sent {formatRelativeTime(sentAt, loadedAt)}
                </Text>
              </View>
              <Pressable
                onPress={() => dismiss(user, 'cancel')}
                disabled={busyId !== null}
                style={({ pressed }) => [styles.chip, styles.chipSoft, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Cancel the friend request to @${user.username}`}
              >
                {busyId === user.id ? (
                  <ActivityIndicator size="small" color={PALETTE.text} />
                ) : (
                  <X size={14} color={PALETTE.text} />
                )}
                <Text style={styles.chipText}>Cancel</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );

  const renderReviews = () => {
    if (!reviews) {
      return <StateCard loading={loading} error={reviewsError} onRetry={refresh} />;
    }

    if (reviews.length === 0) {
      return renderEmpty(
        'No reviews from friends yet',
        friends.length === 0
          ? 'Add friends to read what they think about their books.'
          : 'When your friends rate a book they finished, their review appears here.'
      );
    }

    return (
      <View style={styles.list}>
        {reviewsError ? <Notice tone="error" message={reviewsError} /> : null}

        {reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <Pressable
                onPress={() => openProfile(review.user)}
                style={({ pressed }) => [styles.reviewAuthor, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Open @${review.user.username}'s profile`}
              >
                <FriendAvatar username={review.user.username} size={30} />
                <Text style={styles.reviewUser} numberOfLines={1}>
                  @{review.user.username}
                </Text>
              </Pressable>
              <Text style={styles.feedTime}>{formatRelativeTime(review.updatedAt, loadedAt)}</Text>
            </View>

            <View style={styles.reviewBook}>
              <BookThumb book={review.book} />
              <View style={styles.personText}>
                <Text style={styles.reviewTitle} numberOfLines={2}>
                  {review.book.title}
                </Text>
                <Text style={styles.personMeta} numberOfLines={1}>
                  {review.book.author}
                </Text>
                <StarRating value={review.rating} size={15} style={styles.feedStars} />
              </View>
            </View>

            {review.body ? (
              <Text style={styles.reviewBody} numberOfLines={8}>
                {review.body}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    );
  };

  // ------------------------------------------------
  // SCREEN
  // ------------------------------------------------

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container, isCompact && styles.containerCompact]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => goBack('/home')}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <ArrowLeft size={18} color={PALETTE.text} />
          <Text style={styles.backText}>HOME</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>YOUR LITTLE COMMUNITY</Text>
            <Text style={[styles.title, isCompact && styles.titleCompact]}>Friends & pages</Text>
            <Text style={styles.subtitle}>
              {overview
                ? friends.length > 0
                  ? `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'} · celebrate each other’s progress`
                  : 'Share your reading adventures with the people you like.'
                : 'Share your reading adventures and celebrate each other’s progress.'}
            </Text>
          </View>

          {isCompact ? null : (
            <View style={styles.headerIcon}>
              <UsersRound size={28} color={PALETTE.sageDark} strokeWidth={1.6} />
            </View>
          )}
        </View>

        {!overview ? (
          <StateCard
            loading={loading}
            loadingText="Finding your friends..."
            error={error}
            onRetry={refresh}
          />
        ) : (
          <View style={styles.sections}>
            {notice ? (
              <Notice
                tone={notice.tone}
                message={notice.message}
                onDismiss={() => setNotice(null)}
              />
            ) : null}

            {error ? <Notice tone="error" message={error} actionLabel="Retry" onAction={refresh} /> : null}

            {!overview.hasUsername ? (
              <Notice
                tone="info"
                message="Choose a username so friends can find you and you can send requests."
                actionLabel="Choose"
                onAction={() => router.push({ pathname: '/username', params: { mode: 'edit' } })}
              />
            ) : null}

            {renderIncoming()}
            {renderFind()}
            {renderTabs()}

            {tab === 'activity' ? renderActivity() : tab === 'friends' ? renderFriends() : renderReviews()}

            <View style={styles.privacy}>
              <Lock size={14} color={PALETTE.purple} />
              <Text style={styles.privacyText}>
                Friends can see your books, reading time, reviews and quiz scores. Your
                session notes, study files and quiz topics stay private.
              </Text>
            </View>
          </View>
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
    marginBottom: 22,
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
    backgroundColor: PALETTE.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sections: {
    gap: 16,
  },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 12,
  },
  requestsCard: {
    backgroundColor: PALETTE.lightPink,
    borderColor: PALETTE.pink,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  cardTitle: {
    color: PALETTE.text,
    fontSize: 18,
    fontFamily: FONT.heading,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PALETTE.lavender,
    borderRadius: 15,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  searchInput: {
    flex: 1,
    color: PALETTE.text,
    fontSize: 14,
    fontFamily: FONT.bodyMedium,
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,
  hint: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.body,
  },
  innerNotice: {
    marginTop: 2,
  },
  results: {
    gap: 4,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  personText: {
    flex: 1,
  },
  personName: {
    flexShrink: 1,
    flexGrow: 1,
    color: PALETTE.text,
    fontSize: 14,
    fontFamily: FONT.bodyExtraBold,
  },
  personMeta: {
    color: PALETTE.muted,
    fontSize: 11,
    fontFamily: FONT.bodyMedium,
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  chipPrimary: {
    backgroundColor: PALETTE.text,
  },
  chipSoft: {
    backgroundColor: PALETTE.lavender,
  },
  chipDone: {
    backgroundColor: PALETTE.successSoft,
  },
  chipText: {
    color: PALETTE.text,
    fontSize: 12,
    fontFamily: FONT.bodyExtraBold,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: PALETTE.white,
    padding: 5,
    borderRadius: 17,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 42,
    borderRadius: 13,
    paddingHorizontal: 6,
  },
  tabActive: {
    backgroundColor: PALETTE.text,
  },
  tabText: {
    color: PALETTE.text,
    fontSize: 12,
    fontFamily: FONT.bodyExtraBold,
  },
  tabTextActive: {
    color: PALETTE.white,
  },
  list: {
    gap: 10,
  },
  empty: {
    backgroundColor: PALETTE.white,
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: PALETTE.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: PALETTE.text,
    fontSize: 18,
    fontFamily: FONT.heading,
    textAlign: 'center',
  },
  emptyText: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: FONT.body,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 380,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  feedBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedText: {
    flex: 1,
  },
  feedSentence: {
    color: PALETTE.text,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.bodyMedium,
  },
  feedUser: {
    fontFamily: FONT.bodyExtraBold,
  },
  feedStars: {
    marginTop: 6,
  },
  feedExcerpt: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    fontFamily: FONT.body,
    marginTop: 6,
  },
  feedTime: {
    color: PALETTE.purple,
    fontSize: 10,
    fontFamily: FONT.bodyMedium,
    marginTop: 6,
  },
  thumb: {
    width: 40,
    height: 58,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 13,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  pendingRow: {
    backgroundColor: PALETTE.lavender,
    borderColor: PALETTE.lavender,
  },
  subheading: {
    color: PALETTE.purple,
    fontSize: 10,
    letterSpacing: 1.5,
    fontFamily: FONT.bodyExtraBold,
    marginTop: 10,
  },
  reviewCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    gap: 12,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  reviewUser: {
    color: PALETTE.text,
    fontSize: 13,
    fontFamily: FONT.bodyExtraBold,
  },
  reviewBook: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewTitle: {
    color: PALETTE.text,
    fontSize: 16,
    lineHeight: 21,
    fontFamily: FONT.heading,
  },
  reviewBody: {
    color: PALETTE.text,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.body,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 6,
  },
  privacyText: {
    flex: 1,
    color: PALETTE.purple,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: FONT.body,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
