
import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useAuth0 } from 'react-native-auth0';

import {
  ArrowLeft,
  BookOpen,
  FileText,
  FileImage,
  FileUp,
  Sparkles,
  Brain,
  ClipboardList,
  Lightbulb,
  PawPrint,
  CheckCircle2,
  X,
} from 'lucide-react-native';

const API_URL =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3001'
    : 'http://localhost:3001';

const API_AUDIENCE = 'https://paws-and-pages-api';
const AUTH_SCOPE = 'openid profile email offline_access';

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

async function getResponseData(response: Response) {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText);
  } catch {
    return {
      error: responseText || 'Serverul a returnat un răspuns invalid.',
    };
  }
}

export default function UploadScreen() {
  const { getCredentials } = useAuth0();

  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState('');

  async function selectFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: FILE_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      setFilename(file.name);

      await uploadFile(file);
    } catch (error: any) {
      console.error('Selection error:', error);

      Alert.alert(
        'Ups!',
        error.message || 'Nu am putut selecta fișierul.'
      );
    }
  }

  async function uploadFile(
    file: DocumentPicker.DocumentPickerAsset
  ) {
    setLoading(true);

    try {
      console.log('Uploading:', file.name);
      console.log('Platform:', Platform.OS);

      const formData = new FormData();

      if (Platform.OS === 'web') {
        if (!file.file) {
          throw new Error(
            'Browserul nu a furnizat fișierul. Încearcă să îl selectezi din nou.'
          );
        }

        formData.append('file', file.file, file.name);
      } else {
        formData.append(
          'file',
          {
            uri: file.uri,
            name: file.name,
            type: file.mimeType || getMimeType(file.name),
          } as any
        );
      }

      // Obținem tokenul Auth0 pentru API-ul Paws & Pages.
      console.log('PASUL 1: Obținere token Auth0...');

      const credentials = await getCredentials(
        AUTH_SCOPE,
        0,
        {
          audience: API_AUDIENCE,
        }
      );

      if (!credentials?.accessToken) {
        throw new Error(
          'Sesiunea ta a expirat. Te rugăm să te autentifici din nou.'
        );
      }

      console.log('PASUL 2: Token Auth0 obținut cu succes.');

      // Trimitem fișierul către backend.
      console.log('PASUL 3: Trimitere fișier către backend...');

      const response = await fetch(
        `${API_URL}/api/study/generate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
          },
          body: formData,
        }
      );

      const data = await getResponseData(response);

      if (!response.ok) {
        throw new Error(
          data.error || 'Nu am putut procesa materialul.'
        );
      }

      console.log('PASUL 4: Material procesat cu succes!');
      console.log('Gemini response:', data);

      router.push({
        pathname: '/study/summary',
        params: {
          result: JSON.stringify(data),
        },
      } as any);

    } catch (error: any) {
      console.error('Upload error:', error);

      let message =
        error.message ||
        'A apărut o eroare la încărcarea materialului.';

      if (
        error instanceof TypeError ||
        message.toLowerCase().includes('failed to fetch')
      ) {
        message =
          'Nu am putut contacta serverul Paws & Pages. Verifică dacă backend-ul este pornit și încearcă din nou.';
      }

      Alert.alert(
        'Nu am putut genera materialul',
        message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
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

          <Text style={styles.title}>
            Let's make
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
                  Laica is preparing your study material.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.dropTitle}>
                  Drop your files here
                </Text>

                <Text style={styles.dropDescription}>
                  or browse your device to choose a file
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

          {!!filename && (
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
                  {filename}
                </Text>
              </View>

              {!loading && (
                <Pressable
                  onPress={() => setFilename('')}
                  hitSlop={10}
                >
                  <X size={18} color="#A18DAA" />
                </Pressable>
              )}
            </View>
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
            What you'll get
          </Text>
        </View>

        <View style={styles.featuresGrid}>
          <View style={[styles.featureCard, styles.featurePink]}>
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

          <View style={[styles.featureCard, styles.featurePurple]}>
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

          <View style={[styles.featureCard, styles.featureGreen]}>
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
              Five questions to test what you've learned.
            </Text>
          </View>

          <View style={[styles.featureCard, styles.featurePeach]}>
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
              One page at a time. You're doing better than you think!
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
