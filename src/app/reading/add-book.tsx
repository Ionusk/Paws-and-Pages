import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import {
    ArrowLeft,
    BookOpen,
    BookPlus,
    CheckCircle2,
    ImagePlus,
    PencilLine,
    Search,
    X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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

import { Notice } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT } from '@/constants/palette';
import { getErrorMessage, useApi } from '@/lib/api';
import { goBack } from '@/lib/navigation';
import {
    addReadingBook,
    isBookFinished,
    searchOpenLibrary,
    type BookStatus,
    type CoverUpload,
    type OpenLibraryBook,
} from '@/lib/readingApi';

const COLORS = {
  background: '#E9DDF2',
  primary: '#C8B5E5',
  card: '#F5ECFA',
  white: '#FFFFFF',
  dark: '#493653',
  text: '#806B87',
  accent: '#927BA0',
  muted: '#A99AAF',
  border: '#DED0E8',
  done: '#5F7F5B',
  doneSoft: '#E6F0E3',
};

type Mode = 'search' | 'manual';

type FieldErrors = {
  title?: string;
  pages?: string;
  currentPage?: string;
};

export default function AddBookScreen() {
  const { getAccessToken } = useApi();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const [mode, setMode] = useState<Mode>(
    params.mode === 'manual' ? 'manual' : 'search'
  );

  // Search (Open Library)
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenLibraryBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchedFor, setSearchedFor] = useState('');
  const [picked, setPicked] = useState<OpenLibraryBook | null>(null);
  const searchId = useRef(0);

  // Book details (shared by both modes)
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [status, setStatus] = useState<BookStatus>('reading');
  const [currentPage, setCurrentPage] = useState('0');
  const [cover, setCover] = useState<CoverUpload | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // ------------------------------------------------
  // OPEN LIBRARY SEARCH (as you type)
  // ------------------------------------------------

  useEffect(() => {
    if (mode !== 'search' || picked) return;

    const text = query.trim();

    if (text.length < 2) {
      // Cancel any search in flight; the results are hidden below 2 letters.
      searchId.current++;
      return;
    }

    const id = ++searchId.current;
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setSearchError('');

        const found = await searchOpenLibrary(text, await getAccessToken());

        if (id === searchId.current) {
          setResults(found);
          setSearchedFor(text);
        }
      } catch (error) {
        console.error('Open Library search error:', error);
        if (id === searchId.current) {
          setSearchError(
            getErrorMessage(error, "We couldn't search Open Library right now.")
          );
        }
      } finally {
        if (id === searchId.current) setSearching(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [query, mode, picked, getAccessToken]);

  const pickBook = (book: OpenLibraryBook) => {
    setPicked(book);
    setTitle(book.title);
    setAuthor(book.author);
    setTotalPages(book.pages ? String(book.pages) : '');
    setStatus('reading');
    setCurrentPage('0');
    setErrors({});
    setFormError('');
  };

  const clearPick = () => {
    setPicked(null);
    setErrors({});
    setFormError('');
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;

    setMode(next);
    setPicked(null);
    setErrors({});
    setFormError('');

    if (next === 'manual') {
      // Carry the typed search over as the title, it's usually what they meant.
      setTitle(query.trim());
      setAuthor('');
      setTotalPages('');
      setStatus('reading');
      setCurrentPage('0');
    }
  };

  // ------------------------------------------------
  // COVER FROM GALLERY (manual mode)
  // ------------------------------------------------

  const pickCover = async () => {
    try {
      setFormError('');

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setFormError(
          'Please allow access to your photo gallery to select a book cover.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [2, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const selectedImage = result.assets[0];

        setCover({
          uri: selectedImage.uri,
          fileName: selectedImage.fileName,
          mimeType: selectedImage.mimeType,
        });
      }
    } catch (error) {
      console.error('IMAGE PICKER ERROR:', error);

      setFormError("We couldn't open your photo gallery. Please try again.");
    }
  };

  // ------------------------------------------------
  // SAVE
  // ------------------------------------------------

  const saveBook = async () => {
    if (saving) return;

    const trimmedTitle = title.trim();
    const pages = Number(totalPages.trim());
    const current =
      status === 'finished' ? pages : Number(currentPage.trim() || '0');

    const nextErrors: FieldErrors = {};

    if (!trimmedTitle) {
      nextErrors.title = 'Please enter the book title.';
    }

    if (!totalPages.trim() || !Number.isInteger(pages) || pages <= 0) {
      nextErrors.pages = picked
        ? "Open Library doesn't know the page count. Enter it from your copy."
        : 'Enter the total number of pages (a whole number above 0).';
    }

    if (status === 'reading') {
      if (!Number.isInteger(current) || current < 0) {
        nextErrors.currentPage = "Enter a whole number, or 0 if you haven't started.";
      } else if (!nextErrors.pages && current > pages) {
        nextErrors.currentPage = `The current page can't be higher than ${pages}.`;
      }
    }

    setErrors(nextErrors);
    setFormError('');

    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSaving(true);

      const added = await addReadingBook(
        {
          title: trimmedTitle,
          author: author.trim() || 'Unknown author',
          pages,
          currentPage: current,
          status,
          coverUrl: picked?.coverUrl ?? null,
          openLibraryKey: picked?.openLibraryKey ?? null,
        },
        await getAccessToken(),
        mode === 'manual' ? cover : null
      );

      if (added && isBookFinished(added)) {
        // An already-finished book: ask how it was right away.
        router.replace({
          pathname: '/reading/review/[bookId]',
          params: { bookId: added.id, justFinished: '1' },
        });
        return;
      }

      // The reading screen reloads its books when it regains focus.
      goBack('/reading');
    } catch (error) {
      console.error('Error saving book:', error);

      setFormError(
        getErrorMessage(error, 'Something went wrong. Please try again.')
      );
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------
  // PIECES
  // ------------------------------------------------

  const renderPagesAndStatus = () => (
    <>
      <Text style={styles.inputLabel}>TOTAL NUMBER OF PAGES *</Text>
      <TextInput
        style={[styles.input, errors.pages && styles.inputError]}
        value={totalPages}
        onChangeText={(value) => {
          setTotalPages(value.replace(/[^0-9]/g, ''));
          if (errors.pages) setErrors((e) => ({ ...e, pages: undefined }));
        }}
        placeholder="e.g. 640"
        placeholderTextColor={COLORS.muted}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={6}
        accessibilityLabel="Total number of pages, required"
      />
      {errors.pages ? (
        <Text style={styles.fieldError}>{errors.pages}</Text>
      ) : picked?.pages ? (
        <Text style={styles.helperText}>
          From Open Library. Change it if your edition is different.
        </Text>
      ) : null}

      <Text style={styles.inputLabel}>WHERE ARE YOU WITH IT?</Text>
      <View style={styles.statusRow} accessibilityRole="radiogroup">
        {(
          [
            { id: 'reading', label: 'Currently reading', Icon: BookOpen },
            { id: 'finished', label: 'Already finished', Icon: CheckCircle2 },
          ] as const
        ).map(({ id, label, Icon }) => {
          const selected = status === id;

          return (
            <Pressable
              key={id}
              onPress={() => {
                setStatus(id);
                setErrors((e) => ({ ...e, currentPage: undefined }));
              }}
              style={[styles.statusChip, selected && styles.statusChipActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Icon size={16} color={selected ? COLORS.white : COLORS.accent} />
              <Text
                style={[styles.statusChipText, selected && styles.statusChipTextActive]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {status === 'reading' ? (
        <>
          <Text style={styles.inputLabel}>PAGE YOU ARE ON</Text>
          <TextInput
            style={[styles.input, errors.currentPage && styles.inputError]}
            value={currentPage}
            onChangeText={(value) => {
              setCurrentPage(value.replace(/[^0-9]/g, ''));
              if (errors.currentPage) {
                setErrors((e) => ({ ...e, currentPage: undefined }));
              }
            }}
            placeholder="0"
            placeholderTextColor={COLORS.muted}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={6}
            accessibilityLabel="Page you are on"
          />
          {errors.currentPage ? (
            <Text style={styles.fieldError}>{errors.currentPage}</Text>
          ) : (
            <Text style={styles.helperText}>
              Leave it at 0 if you haven’t started. You can update it any time
              from your reading page or at the end of a session.
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.helperText}>
          It goes straight to your finished books and counts toward your
          reading goal.
        </Text>
      )}

      {formError ? (
        <Notice
          tone="error"
          message={formError}
          onDismiss={() => setFormError('')}
          style={styles.formNotice}
        />
      ) : null}

      <TouchableOpacity
        style={[styles.addButton, saving && styles.disabledButton]}
        onPress={saveBook}
        disabled={saving}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving, busy: saving }}
      >
        {saving ? (
          <>
            <ActivityIndicator color={COLORS.white} />
            <Text style={styles.addButtonText}>SAVING YOUR BOOK...</Text>
          </>
        ) : (
          <>
            <BookPlus size={19} color={COLORS.white} />
            <Text style={styles.addButtonText}>ADD TO MY BOOKS</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );

  const renderSearch = () => {
    if (picked) {
      return (
        <View style={styles.formCard}>
          <View style={styles.pickedRow}>
            <View style={styles.pickedCover}>
              {picked.coverUrl ? (
                <Image
                  source={{ uri: picked.coverUrl }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              ) : (
                <BookOpen size={30} color={COLORS.accent} />
              )}
            </View>

            <View style={styles.pickedInfo}>
              <Text style={styles.pickedEyebrow}>FROM OPEN LIBRARY</Text>
              <Text style={styles.pickedTitle} numberOfLines={3}>
                {picked.title}
              </Text>
              <Text style={styles.resultMeta} numberOfLines={2}>
                {picked.author}
                {picked.year ? ` · ${picked.year}` : ''}
              </Text>

              <Pressable
                onPress={clearPick}
                style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Search size={13} color={COLORS.dark} />
                <Text style={styles.linkButtonText}>Choose another book</Text>
              </Pressable>
            </View>
          </View>

          {renderPagesAndStatus()}
        </View>
      );
    }

    const text = query.trim();

    return (
      <View style={styles.formCard}>
        <View style={styles.searchBox}>
          <Search size={18} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Type a book title, e.g. The Hobbit"
            placeholderTextColor={COLORS.muted}
            autoFocus
            returnKeyType="search"
            accessibilityLabel="Search for a book by title"
          />
          {searching && text.length >= 2 ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : query !== '' ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={16} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>

        {searchError && text.length >= 2 ? (
          <Notice tone="error" message={searchError} style={styles.formNotice} />
        ) : null}

        {text.length < 2 ? (
          <Text style={styles.searchHint}>
            Start typing and pick your book from the list. We fill in the
            author, cover and page count for you.
          </Text>
        ) : results.length > 0 ? (
          <View style={styles.results}>
            {results.map((book) => (
              <Pressable
                key={book.openLibraryKey}
                onPress={() => pickBook(book)}
                style={({ pressed }) => [styles.resultRow, pressed && styles.resultPressed]}
                accessibilityRole="button"
                accessibilityLabel={`${book.title} by ${book.author}${
                  book.year ? `, ${book.year}` : ''
                }`}
              >
                <View style={styles.resultCover}>
                  {book.coverUrl ? (
                    <Image
                      source={{ uri: book.coverUrl.replace('-M.jpg', '-S.jpg') }}
                      style={styles.coverImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <BookOpen size={18} color={COLORS.accent} />
                  )}
                </View>

                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {book.title}
                  </Text>
                  <Text style={styles.resultMeta} numberOfLines={1}>
                    {book.author}
                    {book.year ? ` · ${book.year}` : ''}
                  </Text>
                  <Text style={styles.resultPages}>
                    {book.pages ? `${book.pages} pages` : 'Page count unknown'}
                  </Text>
                </View>

                <BookPlus size={18} color={COLORS.accent} />
              </Pressable>
            ))}
          </View>
        ) : !searching && searchedFor === text && !searchError ? (
          <Text style={styles.searchHint}>
            No books found for “{text}”. Check the spelling, or add it manually.
          </Text>
        ) : null}

        <Pressable
          onPress={() => switchMode('manual')}
          style={({ pressed }) => [styles.manualLink, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <PencilLine size={15} color={COLORS.dark} />
          <Text style={styles.manualLinkText}>
            Can’t find it? Add it manually
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderManual = () => (
    <View style={styles.formCard}>
      <Text style={styles.inputLabel}>BOOK COVER (OPTIONAL)</Text>

      <TouchableOpacity
        style={styles.coverPicker}
        onPress={pickCover}
        activeOpacity={0.8}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={cover ? 'Change book cover' : 'Upload book cover (optional)'}
      >
        {cover ? (
          <View style={styles.coverPreviewContainer}>
            <Image
              source={{ uri: cover.uri }}
              style={styles.coverImage}
              resizeMode="cover"
            />

            <View style={styles.changeCover}>
              <ImagePlus size={16} color={COLORS.white} />
              <Text style={styles.changeCoverText}>CHANGE COVER</Text>
            </View>
          </View>
        ) : (
          <View style={styles.coverPlaceholder}>
            <View style={styles.imageIconCircle}>
              <ImagePlus size={27} color={COLORS.accent} />
            </View>
            <Text style={styles.coverTitle}>Upload book cover</Text>
            <Text style={styles.coverSubtitle}>Choose a photo from your gallery</Text>
          </View>
        )}
      </TouchableOpacity>

      {cover && (
        <TouchableOpacity style={styles.removeCoverButton} onPress={() => setCover(null)}>
          <X size={14} color={COLORS.text} />
          <Text style={styles.removeCoverText}>Remove cover</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.inputLabel}>BOOK TITLE *</Text>
      <TextInput
        style={[styles.input, errors.title && styles.inputError]}
        value={title}
        onChangeText={(value) => {
          setTitle(value);
          if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
        }}
        placeholder="e.g. A Court of Mist and Fury"
        placeholderTextColor={COLORS.muted}
        maxLength={200}
        accessibilityLabel="Book title, required"
      />
      {errors.title ? <Text style={styles.fieldError}>{errors.title}</Text> : null}

      <Text style={styles.inputLabel}>AUTHOR</Text>
      <TextInput
        style={styles.input}
        value={author}
        onChangeText={setAuthor}
        placeholder="e.g. Sarah J. Maas"
        placeholderTextColor={COLORS.muted}
        maxLength={200}
      />

      {renderPagesAndStatus()}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container, isCompact && styles.containerCompact]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBack('/reading')}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Back to reading"
        >
          <ArrowLeft size={19} color={COLORS.dark} />
          <Text style={styles.backText}>BACK TO READING</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR BOOKSHELF</Text>
          <Text style={styles.title}>Add a new story</Text>
          <Text style={styles.subtitle}>
            Find your book on Open Library, or type its details yourself.
          </Text>
        </View>

        <View style={styles.tabs} accessibilityRole="tablist">
          {(
            [
              { id: 'search', label: 'Search by title', Icon: Search },
              { id: 'manual', label: 'Add manually', Icon: PencilLine },
            ] as const
          ).map(({ id, label, Icon }) => {
            const selected = mode === id;

            return (
              <Pressable
                key={id}
                onPress={() => switchMode(id)}
                disabled={saving}
                style={[styles.tab, selected && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Icon size={15} color={selected ? COLORS.white : COLORS.dark} />
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'search' ? renderSearch() : renderManual()}

        <View style={styles.footer}>
          <BookOpen size={17} color={COLORS.accent} />
          <Text style={styles.footerText}>
            Book data from Open Library (openlibrary.org)
          </Text>
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
    width: '100%',
    maxWidth: 950,
    alignSelf: 'center',
    paddingHorizontal: 30,
    paddingTop: 25,
    paddingBottom: 45,
  },
  containerCompact: {
    paddingHorizontal: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.white,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  backText: {
    color: COLORS.dark,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  header: {
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 20,
  },
  eyebrow: {
    color: COLORS.accent,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 3,
  },
  title: {
    color: COLORS.dark,
    fontSize: 31,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 420,
    lineHeight: 20,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.white,
    padding: 6,
    borderRadius: 18,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 42,
    borderRadius: 13,
  },
  tabActive: {
    backgroundColor: COLORS.dark,
  },
  tabText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
  },
  tabTextActive: {
    color: COLORS.white,
  },
  formCard: {
    backgroundColor: COLORS.white,
    padding: 22,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 15,
    paddingHorizontal: 15,
    minHeight: 52,
  },
  searchInput: {
    flex: 1,
    color: COLORS.dark,
    fontSize: 15,
    fontFamily: 'Nunito_600SemiBold',
    paddingVertical: 13,
    outlineStyle: 'none',
  } as any,
  searchHint: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 4,
  },
  results: {
    marginTop: 14,
    gap: 6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 9,
    borderRadius: 15,
  },
  resultPressed: {
    backgroundColor: COLORS.card,
  },
  resultCover: {
    width: 46,
    height: 68,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    color: COLORS.dark,
    fontSize: 14,
    fontFamily: 'Nunito_800ExtraBold',
  },
  resultMeta: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 3,
  },
  resultPages: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    marginTop: 3,
  },
  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 13,
    backgroundColor: COLORS.card,
  },
  manualLinkText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
  },
  pickedRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  pickedCover: {
    width: 92,
    height: 136,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickedInfo: {
    flex: 1,
  },
  pickedEyebrow: {
    color: COLORS.accent,
    fontSize: 9,
    letterSpacing: 1.4,
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 5,
  },
  pickedTitle: {
    color: COLORS.dark,
    fontSize: 19,
    lineHeight: 25,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  linkButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 11,
    backgroundColor: COLORS.card,
  },
  linkButtonText: {
    color: COLORS.dark,
    fontSize: 11,
    fontFamily: 'Nunito_800ExtraBold',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: COLORS.card,
  },
  statusChipActive: {
    backgroundColor: COLORS.accent,
  },
  statusChipText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
  },
  statusChipTextActive: {
    color: COLORS.white,
  },
  inputLabel: {
    color: COLORS.accent,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 9,
  },
  coverPicker: {
    width: '100%',
    minHeight: 190,
    backgroundColor: COLORS.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  imageIconCircle: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  coverTitle: {
    color: COLORS.dark,
    fontSize: 14,
    fontFamily: 'Nunito_800ExtraBold',
  },
  coverSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    fontFamily: 'Nunito_400Regular',
    marginTop: 5,
  },
  coverPreviewContainer: {
    width: '100%',
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  changeCover: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.dark,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  changeCoverText: {
    color: COLORS.white,
    fontSize: 9,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 0.7,
  },
  removeCoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-end',
    marginTop: 9,
  },
  removeCoverText: {
    color: COLORS.text,
    fontSize: 10,
    fontFamily: 'Nunito_600SemiBold',
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.dark,
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
    outlineStyle: 'none',
  } as any,
  inputError: {
    borderWidth: 1,
    borderColor: '#D98A97',
    backgroundColor: '#FFF5F6',
  },
  fieldError: {
    color: '#B44B58',
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    marginTop: 6,
  },
  helperText: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'Nunito_400Regular',
    marginTop: 7,
  },
  formNotice: {
    marginTop: 16,
  },
  addButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 25,
  },
  disabledButton: {
    opacity: 0.7,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
  },
  footerText: {
    color: COLORS.text,
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
  },
});
