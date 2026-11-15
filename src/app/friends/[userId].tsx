import { router, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    BookOpen,
    BookOpenCheck,
    Clock,
    NotebookPen,
    Star,
    UserMinus,
    UsersRound,
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
    useWindowDimensions,
    View,
} from 'react-native';

import { FriendAvatar } from '@/components/friends/FriendAvatar';
import { StarRating } from '@/components/reading/StarRating';
import { Notice, StateCard } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { ApiError, getErrorMessage, useApi } from '@/lib/api';
import { confirmAction } from '@/lib/feedback';
import {
    formatMinutes,
    getFriendProfile,
    removeFriend,
    type FriendProfile,
} from '@/lib/friendsApi';
import { goBack } from '@/lib/navigation';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; notFriends: boolean }
  | { status: 'ready'; profile: FriendProfile };

function Cover({ uri, width, height }: { uri: string | null; width: number; height: number }) {
  return (
    <View style={[styles.cover, { width, height }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.coverImage} resizeMode="cover" />
      ) : (
        <BookOpen size={Math.round(width / 3)} color={PALETTE.purple} />
      )}
    </View>
  );
}

/** A friend's reading profile: stats, current books, finished books, reviews. */
export default function FriendProfileScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const { getAccessToken } = useApi();
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = String(params.userId ?? '');

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const profile = await getFriendProfile(userId, await getAccessToken());
        if (active) setLoad({ status: 'ready', profile });
      } catch (error) {
        console.error('Friend profile error:', error);
        if (!active) return;

        setLoad({
          status: 'error',
          notFriends: error instanceof ApiError && error.status === 404,
          message: getErrorMessage(error, "We couldn't open this profile."),
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, reloadKey, getAccessToken]);

  const retry = () => {
    setLoad({ status: 'loading' });
    setReloadKey((key) => key + 1);
  };

  const unfriend = async (profile: FriendProfile) => {
    const ok = await confirmAction({
      title: `Remove @${profile.user.username}?`,
      message:
        'You will stop seeing each other’s reading activity and reviews. You can send a new request later.',
      confirmText: 'Remove friend',
      destructive: true,
    });

    if (!ok) return;

    try {
      setRemoving(true);
      setRemoveError('');

      await removeFriend(profile.user.id, await getAccessToken());

      router.dismissTo('/friends');
    } catch (error) {
      console.error('Remove friend error:', error);
      setRemoving(false);
      setRemoveError(getErrorMessage(error, "We couldn't remove this friend."));
    }
  };

  const renderProfile = (profile: FriendProfile) => {
    const { stats } = profile;
    const since = new Date(profile.since).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const statItems = [
      { label: 'Books finished', value: String(stats.booksFinished), Icon: BookOpenCheck },
      { label: 'Finished this year', value: String(stats.finishedThisYear), Icon: Star },
      { label: 'Read this week', value: formatMinutes(stats.minutesThisWeek), Icon: Clock },
      {
        label: stats.reviewCount === 1 ? 'Review' : 'Reviews',
        value:
          stats.reviewCount > 0 && stats.averageRating
            ? `${stats.reviewCount} · ${stats.averageRating.toFixed(1)}★`
            : String(stats.reviewCount),
        Icon: NotebookPen,
      },
    ];

    return (
      <View style={styles.sections}>
        <View style={[styles.hero, isCompact && styles.heroCompact]}>
          <FriendAvatar username={profile.user.username} size={isCompact ? 64 : 78} />
          <View style={styles.heroText}>
            <Text style={[styles.username, isCompact && styles.usernameCompact]} numberOfLines={1}>
              @{profile.user.username}
            </Text>
            <View style={styles.sincePill}>
              <UsersRound size={12} color={PALETTE.sageDark} />
              <Text style={styles.sinceText}>Friends since {since}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {statItems.map(({ label, value, Icon }) => (
            <View key={label} style={[styles.stat, isCompact && styles.statCompact]}>
              <Icon size={16} color={PALETTE.purple} />
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* CURRENTLY READING */}
        <View>
          <Text style={styles.sectionTitle}>Currently reading</Text>
          {profile.currentlyReading.length === 0 ? (
            <Text style={styles.emptyText}>No book in progress right now.</Text>
          ) : (
            <View style={styles.list}>
              {profile.currentlyReading.map((book) => {
                const progress = book.pages
                  ? Math.min(Math.max(book.currentPage / book.pages, 0), 1)
                  : 0;

                return (
                  <View
                    key={book.id}
                    style={styles.bookRow}
                    accessible
                    accessibilityLabel={`${book.title} by ${book.author}, page ${book.currentPage} of ${book.pages}`}
                  >
                    <Cover uri={book.coverUrl} width={52} height={76} />
                    <View style={styles.bookText}>
                      <Text style={styles.bookTitle} numberOfLines={2}>
                        {book.title}
                      </Text>
                      <Text style={styles.bookMeta} numberOfLines={1}>
                        {book.author}
                      </Text>
                      <View style={styles.progressBar}>
                        <View
                          style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        Page {book.currentPage} of {book.pages} · {Math.round(progress * 100)}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* RECENTLY FINISHED */}
        <View>
          <Text style={styles.sectionTitle}>Recently finished</Text>
          {profile.recentlyFinished.length === 0 ? (
            <Text style={styles.emptyText}>No finished books yet.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.finishedRow}
            >
              {profile.recentlyFinished.map((book) => (
                <View
                  key={book.id}
                  style={styles.finishedItem}
                  accessible
                  accessibilityLabel={`${book.title} by ${book.author}${
                    book.rating ? `, rated ${book.rating} out of 5` : ''
                  }`}
                >
                  <Cover uri={book.coverUrl} width={96} height={140} />
                  <Text style={styles.finishedTitle} numberOfLines={2}>
                    {book.title}
                  </Text>
                  {book.rating ? (
                    <StarRating value={book.rating} size={12} style={styles.finishedStars} />
                  ) : (
                    <Text style={styles.bookMeta} numberOfLines={1}>
                      {book.author}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* REVIEWS */}
        <View>
          <Text style={styles.sectionTitle}>Reviews</Text>
          {profile.reviews.length === 0 ? (
            <Text style={styles.emptyText}>
              @{profile.user.username} hasn’t reviewed a book yet.
            </Text>
          ) : (
            <View style={styles.list}>
              {profile.reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>
                  <View style={styles.reviewHead}>
                    <Cover uri={review.book.coverUrl} width={40} height={58} />
                    <View style={styles.bookText}>
                      <Text style={styles.bookTitle} numberOfLines={2}>
                        {review.book.title}
                      </Text>
                      <Text style={styles.bookMeta} numberOfLines={1}>
                        {review.book.author}
                      </Text>
                      <StarRating value={review.rating} size={14} style={styles.finishedStars} />
                    </View>
                  </View>
                  {review.body ? <Text style={styles.reviewBody}>{review.body}</Text> : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {removeError ? <Notice tone="error" message={removeError} /> : null}

        <Pressable
          onPress={() => unfriend(profile)}
          disabled={removing}
          style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ busy: removing }}
        >
          {removing ? (
            <ActivityIndicator size="small" color={PALETTE.danger} />
          ) : (
            <UserMinus size={15} color={PALETTE.danger} />
          )}
          <Text style={styles.removeText}>{removing ? 'Removing...' : 'Remove friend'}</Text>
        </Pressable>
      </View>
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
          onPress={() => goBack('/friends')}
          accessibilityRole="button"
          accessibilityLabel="Back to friends"
        >
          <ArrowLeft size={18} color={PALETTE.text} />
          <Text style={styles.backText}>FRIENDS</Text>
        </Pressable>

        {load.status === 'loading' ? (
          <StateCard loading loadingText="Opening their bookshelf..." />
        ) : load.status === 'error' ? (
          load.notFriends ? (
            <View style={styles.sections}>
              <Notice
                tone="info"
                title="Not on your friends list"
                message="You can only see the profiles of your friends. Send them a request from the Friends screen."
              />
              <Pressable
                onPress={() => router.dismissTo('/friends')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <UsersRound size={16} color={PALETTE.white} />
                <Text style={styles.primaryButtonText}>GO TO FRIENDS</Text>
              </Pressable>
            </View>
          ) : (
            <StateCard error={load.message} onRetry={retry} />
          )
        ) : (
          renderProfile(load.profile)
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
    maxWidth: 860,
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
  sections: {
    gap: 24,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    backgroundColor: PALETTE.white,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  heroCompact: {
    gap: 14,
    padding: 18,
  },
  heroText: {
    flex: 1,
  },
  username: {
    color: PALETTE.text,
    fontSize: 28,
    fontFamily: FONT.heading,
  },
  usernameCompact: {
    fontSize: 23,
  },
  sincePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PALETTE.sage,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  sinceText: {
    color: PALETTE.sageDark,
    fontSize: 11,
    fontFamily: FONT.bodyBold,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 120,
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  statCompact: {
    flexBasis: '45%',
    minWidth: 0,
  },
  statValue: {
    color: PALETTE.text,
    fontSize: 20,
    fontFamily: FONT.bodyExtraBold,
    marginTop: 4,
  },
  statLabel: {
    color: PALETTE.muted,
    fontSize: 11,
    fontFamily: FONT.bodyMedium,
  },
  sectionTitle: {
    color: PALETTE.text,
    fontSize: 21,
    fontFamily: FONT.heading,
    marginBottom: 12,
  },
  emptyText: {
    color: PALETTE.muted,
    fontSize: 12,
    fontFamily: FONT.body,
  },
  list: {
    gap: 10,
  },
  cover: {
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 13,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  bookText: {
    flex: 1,
  },
  bookTitle: {
    color: PALETTE.text,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT.heading,
  },
  bookMeta: {
    color: PALETTE.muted,
    fontSize: 11,
    fontFamily: FONT.bodyMedium,
    marginTop: 3,
  },
  progressBar: {
    height: 7,
    borderRadius: 10,
    backgroundColor: '#EAE1EF',
    overflow: 'hidden',
    marginTop: 9,
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#C8B5E5',
  },
  progressText: {
    color: PALETTE.purple,
    fontSize: 10,
    fontFamily: FONT.bodyBold,
    marginTop: 5,
  },
  finishedRow: {
    gap: 14,
    paddingRight: 8,
  },
  finishedItem: {
    width: 96,
  },
  finishedTitle: {
    color: PALETTE.text,
    fontSize: 12,
    fontFamily: FONT.bodyExtraBold,
    marginTop: 8,
  },
  finishedStars: {
    marginTop: 5,
  },
  reviewCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 20,
    padding: 15,
    gap: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewBody: {
    color: PALETTE.text,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.body,
  },
  removeButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  removeText: {
    color: PALETTE.danger,
    fontSize: 12,
    fontFamily: FONT.bodyExtraBold,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PALETTE.text,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: PALETTE.white,
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: FONT.bodyExtraBold,
  },
  pressed: {
    opacity: 0.85,
  },
});
