import * as ImagePicker from 'expo-image-picker';
import {
    ArrowLeft,
    BookOpen,
    BookPlus,
    ImagePlus,
    X,
} from 'lucide-react-native';
import { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';

import { Notice } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT } from '@/constants/palette';
import { getErrorMessage, useApi } from '@/lib/api';
import { goBack } from '@/lib/navigation';
import { addReadingBook, type CoverUpload } from '@/lib/readingApi';

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
};


type FieldErrors = {
  title?: string;
  pages?: string;
  currentPage?: string;
};

export default function AddBookScreen() {
  const { getAccessToken } = useApi();
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [currentPage, setCurrentPage] = useState('0');
  const [cover, setCover] = useState<CoverUpload | null>(null);
  const [saving, setSaving] = useState(false);

  // SELECT COVER FROM GALLERY
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

  // SAVE BOOK AND COVER TO TIGERDATA
  const saveBook = async () => {
    if (saving) return;

    const trimmedTitle = title.trim();
    const trimmedAuthor = author.trim();
    const pages = Number(totalPages.trim());
    const current = Number(currentPage.trim() || '0');

    const nextErrors: FieldErrors = {};

    if (!trimmedTitle) {
      nextErrors.title = 'Please enter the book title.';
    }

    if (!totalPages.trim() || !Number.isInteger(pages) || pages <= 0) {
      nextErrors.pages = 'Enter the total number of pages (a whole number above 0).';
    }

    if (!Number.isInteger(current) || current < 0) {
      nextErrors.currentPage = 'Enter a whole number, or 0 if you haven\'t started.';
    } else if (!nextErrors.pages && current > pages) {
      nextErrors.currentPage = `The current page can't be higher than ${pages}.`;
    }

    setErrors(nextErrors);
    setFormError('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setSaving(true);

      const accessToken = await getAccessToken();

      const newBook = {
        title: trimmedTitle,
        author: trimmedAuthor || 'Unknown author',
        pages,
        currentPage: current,
        coverUrl: null,
      };

      await addReadingBook(newBook, accessToken, cover);

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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isCompact && styles.containerCompact,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BACK BUTTON */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBack('/reading')}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Back to reading"
        >
          <ArrowLeft size={19} color={COLORS.dark} />

          <Text style={styles.backText}>
            BACK TO READING
          </Text>
        </TouchableOpacity>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            YOUR BOOKSHELF
          </Text>

          <Text style={styles.title}>
            Add a new story
          </Text>

          <Text style={styles.subtitle}>
            Fill in your book details and make it part of your reading journey.
          </Text>
        </View>

        {/* BOOK FORM */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            Book details
          </Text>

          {/* COVER IMAGE */}
          <Text style={styles.inputLabel}>
            BOOK COVER
          </Text>

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
                  style={styles.coverPreview}
                  resizeMode="cover"
                />

                <View style={styles.changeCover}>
                  <ImagePlus
                    size={16}
                    color={COLORS.white}
                  />

                  <Text style={styles.changeCoverText}>
                    CHANGE COVER
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.coverPlaceholder}>
                <View style={styles.imageIconCircle}>
                  <ImagePlus
                    size={27}
                    color={COLORS.accent}
                  />
                </View>

                <Text style={styles.coverTitle}>
                  Upload book cover
                </Text>

                <Text style={styles.coverSubtitle}>
                  Choose a photo from your gallery
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {cover && (
            <TouchableOpacity
              style={styles.removeCoverButton}
              onPress={() => setCover(null)}
            >
              <X size={14} color={COLORS.text} />

              <Text style={styles.removeCoverText}>
                Remove cover
              </Text>
            </TouchableOpacity>
          )}

          {/* BOOK TITLE */}
          <Text style={styles.inputLabel}>
            BOOK TITLE *
          </Text>

          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
            }}
            placeholder="e.g. A Court of Mist and Fury"
            placeholderTextColor={COLORS.muted}
            maxLength={100}
            accessibilityLabel="Book title, required"
          />
          {errors.title ? (
            <Text style={styles.fieldError}>{errors.title}</Text>
          ) : null}

          {/* AUTHOR */}
          <Text style={styles.inputLabel}>
            AUTHOR
          </Text>

          <TextInput
            style={styles.input}
            value={author}
            onChangeText={setAuthor}
            placeholder="e.g. Sarah J. Maas"
            placeholderTextColor={COLORS.muted}
            maxLength={100}
          />

          {/* TOTAL PAGES */}
          <Text style={styles.inputLabel}>
            TOTAL NUMBER OF PAGES *
          </Text>

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
          ) : null}

          {/* CURRENT PAGE */}
          <Text style={styles.inputLabel}>
            CURRENT PAGE
          </Text>

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
            accessibilityLabel="Current page"
          />
          {errors.currentPage ? (
            <Text style={styles.fieldError}>{errors.currentPage}</Text>
          ) : null}

          <Text style={styles.helperText}>
            Leave it at 0 if you haven’t started yet. Set it to the last page
            if you’ve already finished the book. You can’t change it after
            saving yet, so double-check it.
          </Text>

          {formError ? (
            <Notice
              tone="error"
              message={formError}
              onDismiss={() => setFormError('')}
              style={styles.formNotice}
            />
          ) : null}

          {/* ADD BUTTON */}
          <TouchableOpacity
            style={[
              styles.addButton,
              saving && styles.disabledButton,
            ]}
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
                <BookPlus
                  size={19}
                  color={COLORS.white}
                />

                <Text style={styles.addButtonText}>
                  ADD TO MY BOOKS
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <BookOpen
            size={17}
            color={COLORS.accent}
          />

          <Text style={styles.footerText}>
            Every book has a story. Add yours.
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
    marginTop: 30,
    marginBottom: 25,
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
    maxWidth: 400,
    lineHeight: 20,
  },

  formCard: {
    backgroundColor: COLORS.white,
    padding: 22,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  sectionTitle: {
    color: COLORS.dark,
    fontSize: 21,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 20,
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

  coverPreview: {
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

  formNotice: {
    marginTop: 18,
  },

  containerCompact: {
    paddingHorizontal: 18,
  },

  helperText: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'Nunito_400Regular',
    marginTop: 7,
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