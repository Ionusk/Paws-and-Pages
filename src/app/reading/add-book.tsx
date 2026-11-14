import React, { useState } from 'react';
import { useAuth0 } from 'react-native-auth0';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  BookPlus,
  BookOpen,
  ImagePlus,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import { addReadingBook, CoverUpload } from './readingStorage';

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

const AUTH_SCOPE = 'openid profile email offline_access';
const API_AUDIENCE = 'https://paws-and-pages-api';

export default function AddBookScreen() {
  const { getCredentials } = useAuth0();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [currentPage, setCurrentPage] = useState('0');
  const [cover, setCover] = useState<CoverUpload | null>(null);
  const [saving, setSaving] = useState(false);

  // SELECT COVER FROM GALLERY
  const pickCover = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
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

      Alert.alert(
        'Error',
        'Could not open your photo gallery.'
      );
    }
  };

  // SAVE BOOK AND COVER TO TIGERDATA
  const saveBook = async () => {
    if (saving) return;

    const trimmedTitle = title.trim();
    const trimmedAuthor = author.trim();
    const pages = Number(totalPages);
    const current = Number(currentPage);

    if (!trimmedTitle) {
      Alert.alert('Missing title', 'Please enter the book title.');
      return;
    }

    if (!Number.isInteger(pages) || pages <= 0) {
      Alert.alert('Invalid pages', 'Please enter a valid number of pages.');
      return;
    }

    if (
      !Number.isInteger(current) ||
      current < 0 ||
      current > pages
    ) {
      Alert.alert('Invalid page', 'Please enter a valid current page.');
      return;
    }

    try {
      setSaving(true);

      const credentials = await getCredentials(
        AUTH_SCOPE,
        0,
        { audience: API_AUDIENCE }
      );

      if (!credentials.accessToken) {
        throw new Error('Could not obtain Auth0 access token.');
      }

      const newBook = {
        title: trimmedTitle,
        author: trimmedAuthor || 'Unknown author',
        pages,
        currentPage: current,
        coverUrl: null,
      };

      await addReadingBook(
        newBook,
        credentials.accessToken,
        cover
      );

      router.replace('/reading');
    } catch (error) {
      console.error('Error saving book:', error);

      Alert.alert(
        'Could not add book',
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* BACK BUTTON */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
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
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. A Court of Mist and Fury"
            placeholderTextColor={COLORS.muted}
            maxLength={100}
          />

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
            style={styles.input}
            value={totalPages}
            onChangeText={setTotalPages}
            placeholder="e.g. 640"
            placeholderTextColor={COLORS.muted}
            keyboardType="number-pad"
          />

          {/* CURRENT PAGE */}
          <Text style={styles.inputLabel}>
            CURRENT PAGE
          </Text>

          <TextInput
            style={styles.input}
            value={currentPage}
            onChangeText={setCurrentPage}
            placeholder="0"
            placeholderTextColor={COLORS.muted}
            keyboardType="number-pad"
          />

          <Text style={styles.helperText}>
            You can leave it at 0 if you haven't started reading yet.
          </Text>

          {/* ADD BUTTON */}
          <TouchableOpacity
            style={[
              styles.addButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveBook}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
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

  helperText: {
    color: COLORS.muted,
    fontSize: 10,
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