import { router } from 'expo-router';
import { Check, CheckCircle2, PencilLine, RotateCcw, Star, Timer, X } from 'lucide-react-native';
import { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage, useApi } from '@/lib/api';
import { confirmAction } from '@/lib/feedback';
import {
    isBookFinished,
    updateReadingBook,
    type BookProgressChange,
    type ReadingBook,
} from '@/lib/readingApi';

type Props = {
  book: ReadingBook;
  /** Called with the saved book so the screen can refresh its lists. */
  onUpdated: (book: ReadingBook) => void;
};

/**
 * Actions under a book card: update the current page, mark it finished,
 * start a session with it, or move a finished book back to "reading".
 */
export function BookProgressControls({ book, onUpdated }: Props) {
  const { getAccessToken } = useApi();
  const finished = isBookFinished(book);

  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(String(book.currentPage));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (changes: BookProgressChange) => {
    try {
      setSaving(true);
      setError('');

      const updated = await updateReadingBook(
        book.id,
        changes,
        await getAccessToken()
      );

      setEditing(false);
      onUpdated(updated);

      // Marking it finished (or saving the last page) asks for a review.
      if (!finished && isBookFinished(updated)) {
        router.push({
          pathname: '/reading/review/[bookId]',
          params: { bookId: updated.id, justFinished: '1' },
        });
      }
    } catch (err) {
      console.error('Book update error:', err);
      setError(getErrorMessage(err, "We couldn't update this book."));
    } finally {
      setSaving(false);
    }
  };

  const savePage = () => {
    const value = Number(page);

    if (!page.trim() || !Number.isInteger(value) || value < 0) {
      setError('Enter the page you are on, as a whole number.');
      return;
    }

    if (value > book.pages) {
      setError(`This book has ${book.pages} pages.`);
      return;
    }

    save({ currentPage: value });
  };

  const markFinished = async () => {
    const ok = await confirmAction({
      title: `Finished "${book.title}"?`,
      message: 'It moves to your finished books and counts toward your reading goal.',
      confirmText: 'Mark as finished',
    });

    if (ok) save({ status: 'finished' });
  };

  if (finished) {
    return (
      <View style={styles.wrap}>
        <View style={styles.row}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/reading/review/[bookId]',
                params: { bookId: book.id },
              })
            }
            disabled={saving}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Review ${book.title}`}
          >
            <Star size={14} color={PALETTE.white} />
            <Text style={styles.primaryText}>Review</Text>
          </Pressable>

          <Pressable
            onPress={() => save({ status: 'reading' })}
            disabled={saving}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Move ${book.title} back to currently reading`}
          >
            {saving ? (
              <ActivityIndicator size="small" color={PALETTE.text} />
            ) : (
              <RotateCcw size={14} color={PALETTE.text} />
            )}
            <Text style={styles.secondaryText}>Read again</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {editing ? (
        <View style={styles.editor}>
          <Text style={styles.editorLabel}>I AM ON PAGE</Text>

          <View style={styles.editorRow}>
            <TextInput
              style={styles.input}
              value={page}
              onChangeText={(value) => {
                setPage(value.replace(/[^0-9]/g, ''));
                setError('');
              }}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              onSubmitEditing={savePage}
              accessibilityLabel={`Current page of ${book.title}`}
            />
            <Text style={styles.ofPages}>of {book.pages}</Text>

            <Pressable
              onPress={savePage}
              disabled={saving}
              style={({ pressed }) => [styles.iconButton, styles.saveButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Save page"
            >
              {saving ? (
                <ActivityIndicator size="small" color={PALETTE.white} />
              ) : (
                <Check size={16} color={PALETTE.white} />
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setEditing(false);
                setPage(String(book.currentPage));
                setError('');
              }}
              disabled={saving}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <X size={16} color={PALETTE.text} />
            </Pressable>
          </View>

          <Text style={styles.hint}>
            Entering the last page ({book.pages}) marks the book as finished.
          </Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/reading/session',
                params: { bookId: book.id },
              })
            }
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Start a reading session with ${book.title}`}
          >
            <Timer size={14} color={PALETTE.white} />
            <Text style={styles.primaryText}>Read now</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setPage(String(book.currentPage));
              setEditing(true);
            }}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Update the page of ${book.title}`}
          >
            <PencilLine size={14} color={PALETTE.text} />
            <Text style={styles.secondaryText}>Update page</Text>
          </Pressable>

          <Pressable
            onPress={markFinished}
            disabled={saving}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${book.title} as finished`}
          >
            {saving ? (
              <ActivityIndicator size="small" color={PALETTE.success} />
            ) : (
              <CheckCircle2 size={14} color={PALETTE.success} />
            )}
            <Text style={[styles.secondaryText, { color: PALETTE.success }]}>
              Finished
            </Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: PALETTE.text,
  },
  primaryText: {
    color: PALETTE.white,
    fontSize: 12,
    fontFamily: FONT.bodyExtraBold,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: PALETTE.lavender,
  },
  secondaryText: {
    color: PALETTE.text,
    fontSize: 12,
    fontFamily: FONT.bodyExtraBold,
  },
  editor: {
    gap: 8,
  },
  editorLabel: {
    color: PALETTE.purple,
    fontSize: 9,
    letterSpacing: 1.4,
    fontFamily: FONT.bodyExtraBold,
  },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    width: 90,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: PALETTE.lavender,
    color: PALETTE.text,
    fontSize: 15,
    fontFamily: FONT.bodyExtraBold,
    outlineStyle: 'none',
  } as any,
  ofPages: {
    color: PALETTE.muted,
    fontSize: 13,
    fontFamily: FONT.bodyBold,
    marginRight: 'auto',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.lavender,
  },
  saveButton: {
    backgroundColor: PALETTE.text,
  },
  hint: {
    color: PALETTE.muted,
    fontSize: 10,
    fontFamily: FONT.body,
  },
  error: {
    color: PALETTE.danger,
    fontSize: 11,
    fontFamily: FONT.bodyBold,
    marginTop: 8,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
