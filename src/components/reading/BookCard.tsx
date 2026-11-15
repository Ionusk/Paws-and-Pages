import { BookOpen, CheckCircle2 } from 'lucide-react-native';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getBookProgress, isBookFinished, type ReadingBook } from '@/lib/readingApi';

const COLORS = {
  primary: '#C8B5E5',
  card: '#F5ECFA',
  white: '#FFFFFF',
  dark: '#493653',
  text: '#806B87',
  accent: '#927BA0',
  muted: '#A99AAF',
  track: '#EAE1EF',
  border: '#DED0E8',
  done: '#8BA486',
  doneText: '#5F7F5B',
};

type BookCardProps = {
  book: ReadingBook;
  compact?: boolean;
};

/** Book with cover, author and reading progress. Shared by Reading and Library. */
export function BookCard({ book, compact = false }: BookCardProps) {
  const finished = isBookFinished(book);
  const percentage = Math.round(getBookProgress(book) * 100);

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${book.title} by ${book.author}. ${
        finished
          ? 'Finished.'
          : `Page ${book.currentPage} of ${book.pages}, ${percentage}% read.`
      }`}
    >
      <View style={[styles.content, compact && styles.contentCompact]}>
        <View style={[styles.cover, compact && styles.coverCompact]}>
          {book.coverUrl ? (
            <Image
              source={{ uri: book.coverUrl }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <BookOpen size={compact ? 28 : 36} color={COLORS.accent} />
            </View>
          )}
        </View>

        <View style={styles.details}>
          <View style={[styles.statusPill, finished && styles.statusPillDone]}>
            {finished ? <CheckCircle2 size={11} color={COLORS.doneText} /> : null}
            <Text style={[styles.statusText, finished && styles.statusTextDone]}>
              {finished ? 'FINISHED' : 'CURRENTLY READING'}
            </Text>
          </View>

          <Text
            style={[styles.title, compact && styles.titleCompact]}
            numberOfLines={3}
          >
            {book.title}
          </Text>

          <Text style={styles.author} numberOfLines={2}>
            {book.author}
          </Text>

          <Text style={styles.pages}>
            {finished
              ? `${book.pages} pages`
              : `Page ${book.currentPage} of ${book.pages || '?'}`}
          </Text>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${percentage}%`,
                  backgroundColor: finished ? COLORS.done : COLORS.primary,
                },
              ]}
            />
          </View>

          <Text style={[styles.percentage, finished && styles.statusTextDone]}>
            {percentage}% completed
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
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
  content: {
    flexDirection: 'row',
    gap: 22,
    alignItems: 'center',
  },
  contentCompact: {
    gap: 16,
  },
  cover: {
    width: 115,
    height: 165,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  coverCompact: {
    width: 84,
    height: 120,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 9,
  },
  statusPillDone: {
    backgroundColor: '#E6F0E3',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    color: COLORS.accent,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1.5,
  },
  statusTextDone: {
    color: COLORS.doneText,
  },
  title: {
    color: COLORS.dark,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
    lineHeight: 27,
  },
  titleCompact: {
    fontSize: 17,
    lineHeight: 23,
  },
  author: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 6,
  },
  pages: {
    color: COLORS.muted,
    fontSize: 10,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 16,
  },
  progressBar: {
    width: '100%',
    height: 7,
    borderRadius: 10,
    backgroundColor: COLORS.track,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
  },
  percentage: {
    color: COLORS.accent,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    marginTop: 6,
  },
});
