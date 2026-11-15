import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
    ArrowLeft,
    BookOpen,
    Brain,
    CheckCircle2,
    ClipboardList,
    FileImage,
    FileText,
    FileUp,
    Lightbulb,
    PawPrint,
    Sparkles,
    X,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

import { Notice } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT } from '@/constants/palette';
import { getErrorMessage, useApi } from '@/lib/api';
import { goBack } from '@/lib/navigation';

const FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/*',
];

function getMimeType(filename: string) {
  const extension = filename.toLowerCase().split('.').pop();

  const types: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    avif: 'image/avif',
  };

  return types[extension || ''] || 'application/octet-stream';
}

export default function UploadScreen() {
  const { request } = useApi();
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;

  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guards against a second upload starting before state updates land.
  const busyRef = useRef(false);

  async function selectFile() {
    if (busyRef.current) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: FILE_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      setSelectedFile(file);

      await uploadFile(file);
    } catch (err) {
      console.error('Selection error:', err);

      setError(getErrorMessage(err, "We couldn't open that file."));
    }
  }

  async function uploadFile(file: DocumentPicker.DocumentPickerAsset) {
    if (busyRef.current) return;
    busyRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        if (!file.file) {
          throw new Error(
            "The browser didn't provide the file. Please choose it again."
          );
        }

        formData.append('file', file.file, file.name);
      } else {
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || getMimeType(file.name),
        } as any);
      }

      // apiFetch leaves Content-Type unset for FormData so the multipart
      // boundary is added automatically on web and native.
      const data = await request('/api/study/generate', {
        method: 'POST',
        body: formData,
      });

      router.push({
        pathname: '/study/summary',
        params: {
          result: JSON.stringify(data),
        },
      });
    } catch (err) {
      console.error('Upload error:', err);

      setError(
        getErrorMessage(
          err,
          'Something went wrong while uploading your material.'
        )
      );
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  const clearSelection = () => {
    setSelectedFile(null);
    setError(null);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isCompact && styles.containerCompact,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => goBack('/study')}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={21} color="#655274" strokeWidth={2} />
          </Pressable>

          <View style={styles.headerBrand}>
            <PawPrint size={15} color="#A78BB9" />
            <Text style={styles.eyebrow}>PAWS & PAGES</Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.intro}>
          <View style={styles.tag}>
            <Sparkles size={13} color="#9877AD" />
            <Text style={styles.tagText}>YOUR STUDY SPACE</Text>
          </View>

          <Text style={[styles.title, isCompact && styles.titleCompact]}>
            Let&apos;s make
            {'\n'}
            studying <Text style={styles.titleAccent}>easier.</Text>
          </Text>

          <Text style={styles.description}>
            Bring your notes, courses and presentations.
            Laica will help you turn them into something
            easier to understand.
          </Text>
        </View>

        <View style={styles.uploadCard}>
          <View style={styles.uploadCardTop}>
            <View style={styles.uploadIcon}>
              <FileUp size={27} color="#9677AC" strokeWidth={1.8} />
            </View>

            <View style={styles.uploadLabel}>
              <Text style={styles.uploadOverline}>STEP 01</Text>
              <Text style={styles.uploadHeading}>Add your material</Text>
            </View>

            <View style={styles.sparkle}>
              <Sparkles size={17} color="#D39BAF" />
            </View>
          </View>

          <Pressable
            style={[
              styles.dropArea,
              loading && styles.dropAreaDisabled,
            ]}
            onPress={selectFile}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Choose a file to upload"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <View style={styles.fileIconRow}>
              <View
                style={[
                  styles.fileTypeIcon,
                  { backgroundColor: '#F8E8EF' },
                ]}
              >
                <FileText size={19} color="#C184A0" />
              </View>

              <View
                style={[
                  styles.fileTypeIcon,
                  { backgroundColor: '#EEE8F6' },
                ]}
              >
                <BookOpen size={19} color="#9677AC" />
              </View>

              <View
                style={[
                  styles.fileTypeIcon,
                  { backgroundColor: '#E8F0E9' },
                ]}
              >
                <FileImage size={19} color="#83A28C" />
              </View>
            </View>

            {loading ? (
              <>
                <ActivityIndicator
                  size="large"
                  color="#9877AD"
                  style={styles.loader}
                />

                <Text style={styles.dropTitle}>
                  Working on it...
                </Text>

                <Text style={styles.dropDescription}>
                  Laica is preparing your summary and quiz. This can take up
                  to a minute.
                </Text>
              </>
            ) : (
              <>
                {/* Drag & drop is not implemented, so the copy only
                    promises what the button does. */}
                <Text style={styles.dropTitle}>
                  Pick a file to get started
                </Text>

                <Text style={styles.dropDescription}>
                  Browse your device to choose a file
                </Text>

                <View style={styles.chooseButton}>
                  <FileUp size={17} color="#FFFFFF" />

                  <Text style={styles.chooseButtonText}>
                    Choose a file
                  </Text>
                </View>
              </>
            )}
          </Pressable>

          {!!selectedFile && (
            <View style={styles.selectedFile}>
              <View style={styles.selectedFileIcon}>
                <CheckCircle2 size={18} color="#789B83" />
              </View>

              <View style={styles.selectedFileInfo}>
                <Text style={styles.selectedFileLabel}>
                  SELECTED FILE
                </Text>

                <Text
                  style={styles.filename}
                  numberOfLines={1}
                >
                  {selectedFile.name}
                </Text>
              </View>

              {!loading && (
                <Pressable
                  onPress={clearSelection}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Remove selected file"
                  style={styles.clearButton}
                >
                  <X size={18} color="#A18DAA" />
                </Pressable>
              )}
            </View>
          )}

          {!!error && (
            <Notice
              tone="error"
              title="We couldn't generate your material"
              message={error}
              actionLabel={selectedFile && !loading ? 'Try again' : undefined}
              onAction={
                selectedFile ? () => uploadFile(selectedFile) : undefined
              }
              onDismiss={() => setError(null)}
              style={styles.errorNotice}
            />
          )}

          <Text style={styles.supportedFormats}>
            PDF · DOCX · PPTX · JPG · PNG · WEBP
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEyebrow}>
            THE GOOD STUFF
          </Text>

          <Text style={styles.sectionTitle}>
            What you&apos;ll get
          </Text>
        </View>

        <View style={styles.featuresGrid}>
          <View
            style={[
              styles.featureCard,
              isCompact && styles.featureCardCompact,
              styles.featurePink,
            ]}
          >
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: '#F6DCE7' },
              ]}
            >
              <BookOpen size={21} color="#B77D99" />
            </View>

            <Text style={styles.featureTitle}>
              Smart summaries
            </Text>

            <Text style={styles.featureDescription}>
              Clear and structured notes from your material.
            </Text>
          </View>

          <View
            style={[
              styles.featureCard,
              isCompact && styles.featureCardCompact,
              styles.featurePurple,
            ]}
          >
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: '#E6DDF1' },
              ]}
            >
              <Brain size={21} color="#9275AA" />
            </View>

            <Text style={styles.featureTitle}>
              Key concepts
            </Text>

            <Text style={styles.featureDescription}>
              Important ideas highlighted for quick revision.
            </Text>
          </View>

          <View
            style={[
              styles.featureCard,
              isCompact && styles.featureCardCompact,
              styles.featureGreen,
            ]}
          >
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: '#DCEBDD' },
              ]}
            >
              <ClipboardList size={21} color="#789A81" />
            </View>

            <Text style={styles.featureTitle}>
              Practice quiz
            </Text>

            <Text style={styles.featureDescription}>
              Five questions to test what you&apos;ve learned.
            </Text>
          </View>

          <View
            style={[
              styles.featureCard,
              isCompact && styles.featureCardCompact,
              styles.featurePeach,
            ]}
          >
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: '#F8E5D5' },
              ]}
            >
              <Lightbulb size={21} color="#C18D66" />
            </View>

            <Text style={styles.featureTitle}>
              Explanations
            </Text>

            <Text style={styles.featureDescription}>
              Helpful explanations for the quiz answers.
            </Text>
          </View>
        </View>

        <View style={styles.bottomNote}>
          <View style={styles.noteIcon}>
            <PawPrint size={19} color="#9877AD" />
          </View>

          <View style={styles.noteContent}>
            <Text style={styles.noteTitle}>
              A little reminder from Laica
            </Text>

            <Text style={styles.noteText}>
              One page at a time. You&apos;re doing better than you think!
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          MADE WITH LOVE & A LITTLE PAW MAGIC
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5EFF8',
  },

  container: {
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 35,
  },

  containerCompact: {
    paddingHorizontal: 20,
    paddingTop: 36,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 34,
  },

  backButton: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDE3F0',
  },

  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  eyebrow: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
    letterSpacing: 2,
    color: '#8D789C',
  },

  headerSpacer: {
    width: 43,
  },

  intro: {
    marginBottom: 27,
  },

  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAE0F1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 16,
  },

  tagText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 10,
    letterSpacing: 1.3,
    color: '#9277A5',
  },

  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 38,
    lineHeight: 47,
    color: '#594B68',
  },

  titleCompact: {
    fontSize: 32,
    lineHeight: 40,
  },

  titleAccent: {
    color: '#B27F9D',
    fontStyle: 'italic',
  },

  description: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    lineHeight: 23,
    color: '#887D91',
    marginTop: 13,
    maxWidth: 330,
  },

  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 27,
    padding: 19,
    borderWidth: 1,
    borderColor: '#EDE3F0',
    shadowColor: '#8D739B',
    shadowOpacity: 0.07,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  uploadCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 19,
  },

  uploadIcon: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: '#F0E8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  uploadLabel: {
    marginLeft: 12,
    flex: 1,
  },

  uploadOverline: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#B19BBE',
  },

  uploadHeading: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
    color: '#62536F',
    marginTop: 2,
  },

  sparkle: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#FBEEF3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dropArea: {
    backgroundColor: '#FAF7FC',
    borderWidth: 1.5,
    borderColor: '#DCCCE7',
    borderStyle: 'dashed',
    borderRadius: 21,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  dropAreaDisabled: {
    opacity: 0.75,
  },

  fileIconRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 17,
  },

  fileTypeIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dropTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 17,
    color: '#655574',
    marginBottom: 5,
    textAlign: 'center',
  },

  dropDescription: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: '#A092AA',
    textAlign: 'center',
  },

  chooseButton: {
    marginTop: 18,
    backgroundColor: '#A88AB9',
    borderRadius: 14,
    paddingHorizontal: 23,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  chooseButtonText: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 13,
    color: '#FFFFFF',
  },

  loader: {
    marginBottom: 13,
  },

  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F5EF',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },

  selectedFileIcon: {
    marginRight: 10,
  },

  selectedFileInfo: {
    flex: 1,
  },

  selectedFileLabel: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9,
    letterSpacing: 1,
    color: '#8BA18C',
  },

  filename: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 12,
    color: '#667D68',
    marginTop: 2,
  },

  clearButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -8,
    marginRight: -8,
  },

  errorNotice: {
    marginTop: 14,
  },

  supportedFormats: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9,
    letterSpacing: 1,
    color: '#B4A7BB',
    textAlign: 'center',
    marginTop: 16,
  },

  sectionHeading: {
    marginTop: 34,
    marginBottom: 15,
  },

  sectionEyebrow: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9,
    letterSpacing: 1.8,
    color: '#AD96B9',
  },

  sectionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 25,
    color: '#62536F',
    marginTop: 3,
  },

  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },

  featureCard: {
    width: '48%',
    minHeight: 155,
    borderRadius: 21,
    padding: 15,
  },

  featureCardCompact: {
    width: '100%',
    minHeight: 0,
  },

  featurePink: {
    backgroundColor: '#F9EAF0',
  },

  featurePurple: {
    backgroundColor: '#EEE8F5',
  },

  featureGreen: {
    backgroundColor: '#EAF1E9',
  },

  featurePeach: {
    backgroundColor: '#F9EEE4',
  },

  featureIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  featureTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 13,
    color: '#665771',
    marginBottom: 5,
  },

  featureDescription: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: '#93869A',
  },

  bottomNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAE2F0',
    borderRadius: 19,
    padding: 16,
    marginTop: 25,
  },

  noteIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: '#F7F1FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  noteContent: {
    flex: 1,
  },

  noteTitle: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 12,
    color: '#756282',
    marginBottom: 3,
  },

  noteText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: '#92849B',
  },

  footer: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#B5A5BD',
    textAlign: 'center',
    marginTop: 25,
  },
});
