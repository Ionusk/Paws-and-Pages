import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { BookUp, ImagePlus, Save, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CampusShell } from '@/components/campus/CampusShell';
import { Notice, StateCard } from '@/components/ui/feedback';
import { FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage } from '@/lib/api';
import { CAMPUS_CATEGORIES, useCampusApi, type CoverFile } from '@/lib/campusApi';
import { goBack } from '@/lib/navigation';

type Errors = { title?: string; author?: string };

const LIMITS = { title: 200, author: 120, description: 2000, notes: 1000 };

export default function PublishBookScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id && /^[1-9][0-9]*$/.test(id) ? Number(id) : null;
  const campus = useCampusApi();

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [existingCover, setExistingCover] = useState<string | null>(null);
  const [cover, setCover] = useState<CoverFile | null>(null);
  const [removeCover, setRemoveCover] = useState(false);

  const [loading, setLoading] = useState(Boolean(editId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Prefill when editing. Only the owner gets a listing they can edit.
  useEffect(() => {
    if (!editId) return;
    let active = true;

    campus
      .getBook(editId)
      .then((book) => {
        if (!active) return;

        if (!book.isOwner) {
          setLoadError('Only the owner can edit this listing.');
          return;
        }

        setTitle(book.title);
        setAuthor(book.author);
        setDescription(book.description ?? '');
        setNotes(book.notes ?? '');
        setCategory(book.category);
        setExistingCover(book.coverUrl);
      })
      .catch((err) => {
        if (active) setLoadError(getErrorMessage(err, "We couldn't load this listing."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [campus, editId]);

  const pickCover = async () => {
    try {
      setFormError('');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setFormError('Please allow access to your photos to add a cover.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [2, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setCover({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType });
        setRemoveCover(false);
      }
    } catch (err) {
      console.error('Cover picker error:', err);
      setFormError("We couldn't open your photos. Please try again.");
    }
  };

  const submit = async () => {
    if (saving) return;

    const next: Errors = {};
    if (!title.trim()) next.title = 'Please enter the book title.';
    if (!author.trim()) next.author = 'Please enter the author.';
    setErrors(next);
    setFormError('');

    if (Object.keys(next).length > 0) return;

    const input = {
      title: title.trim(),
      author: author.trim(),
      description: description.trim(),
      notes: notes.trim(),
      category,
    };

    try {
      setSaving(true);

      const book = editId
        ? await campus.updateBook(editId, input, cover, removeCover && !cover)
        : await campus.createBook(input, cover);

      router.replace(`/campus/book/${book.id}`);
    } catch (err) {
      setFormError(getErrorMessage(err, "We couldn't save your book. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const shownCover = cover?.uri ?? (removeCover ? null : existingCover);
  const heading = editId ? 'Edit your listing' : 'Share a book';

  if (loading || loadError) {
    return (
      <CampusShell title={heading} showTabs={false} backFallback="/campus/mine" backLabel="Back">
        <StateCard loading={loading} loadingText="Opening your listing..." error={loadError} onRetry={() => goBack('/campus/mine')} />
      </CampusShell>
    );
  }

  const field = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    options: { placeholder: string; max: number; error?: string; multiline?: boolean; required?: boolean }
  ) => (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {options.required ? ' *' : ''}
        </Text>
        {options.multiline ? (
          <Text style={styles.counter}>
            {value.length}/{options.max}
          </Text>
        ) : null}
      </View>
      <TextInput
        style={[styles.input, options.multiline && styles.textArea, options.error && styles.inputError]}
        value={value}
        onChangeText={onChange}
        placeholder={options.placeholder}
        placeholderTextColor="#A99AAF"
        maxLength={options.max}
        multiline={options.multiline}
        textAlignVertical={options.multiline ? 'top' : 'center'}
        editable={!saving}
        accessibilityLabel={options.required ? `${label}, required` : label}
      />
      {options.error ? <Text style={styles.fieldError}>{options.error}</Text> : null}
    </View>
  );

  return (
    <CampusShell
      title={heading}
      subtitle={
        editId
          ? 'Update the details other students see.'
          : 'Lend a book to another UPT student. You decide who borrows it.'
      }
      showTabs={false}
      backFallback={editId ? `/campus/book/${editId}` : '/campus'}
      backLabel="Back"
    >
      <View style={styles.card}>
        <Text style={styles.label}>COVER (OPTIONAL)</Text>
        <View style={styles.coverRow}>
          <Pressable
            onPress={pickCover}
            disabled={saving}
            style={({ pressed }) => [styles.coverPicker, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={shownCover ? 'Change cover' : 'Add a cover photo'}
          >
            {shownCover ? (
              <Image source={{ uri: shownCover }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <ImagePlus size={26} color={PALETTE.purple} />
                <Text style={styles.coverHint}>Add a photo</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.coverText}>
            <Text style={styles.helper}>A photo of your copy helps others recognize it. JPG or PNG, up to 6 MB.</Text>
            {shownCover ? (
              <Pressable
                onPress={() => {
                  setCover(null);
                  setRemoveCover(true);
                }}
                disabled={saving}
                style={styles.removeCover}
                accessibilityRole="button"
              >
                <X size={14} color={PALETTE.muted} />
                <Text style={styles.removeCoverText}>Remove cover</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {field('TITLE', title, (text) => {
          setTitle(text);
          if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
        }, { placeholder: 'e.g. Introduction to Algorithms', max: LIMITS.title, error: errors.title, required: true })}

        {field('AUTHOR', author, (text) => {
          setAuthor(text);
          if (errors.author) setErrors((e) => ({ ...e, author: undefined }));
        }, { placeholder: 'e.g. Cormen, Leiserson, Rivest, Stein', max: LIMITS.author, error: errors.author, required: true })}

        <View style={styles.field}>
          <Text style={styles.label}>SUBJECT (OPTIONAL)</Text>
          <View style={styles.chips}>
            {CAMPUS_CATEGORIES.map((item) => {
              const selected = category === item;

              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(selected ? null : item)}
                  disabled={saving}
                  style={[styles.chip, selected && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {field('DESCRIPTION (OPTIONAL)', description, setDescription, {
          placeholder: 'Edition, condition, highlights...',
          max: LIMITS.description,
          multiline: true,
        })}

        {field('NOTES FOR BORROWERS (OPTIONAL)', notes, setNotes, {
          placeholder: 'e.g. Available after 4pm, prefer meeting near the library.',
          max: LIMITS.notes,
          multiline: true,
        })}

        <Text style={styles.helper}>
          Don’t add your phone number or email here. Once you accept a request,
          you and the borrower get a private chat to arrange the handover.
        </Text>

        {formError ? <Notice tone="error" message={formError} onDismiss={() => setFormError('')} style={styles.notice} /> : null}

        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => [styles.submit, saving && styles.disabled, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving, busy: saving }}
        >
          {saving ? (
            <ActivityIndicator color={PALETTE.white} />
          ) : editId ? (
            <Save size={18} color={PALETTE.white} />
          ) : (
            <BookUp size={18} color={PALETTE.white} />
          )}
          <Text style={styles.submitText}>
            {saving ? 'Saving...' : editId ? 'Save changes' : 'Publish my book'}
          </Text>
        </Pressable>
      </View>
    </CampusShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
    marginTop: 16,
    maxWidth: 760,
    width: '100%',
  },
  field: { marginTop: 18 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    color: PALETTE.muted,
    fontSize: 10,
    letterSpacing: 1.4,
    fontFamily: FONT.bodyExtraBold,
    marginBottom: 8,
  },
  counter: { color: '#A99AAF', fontSize: 10, fontFamily: FONT.bodyBold, marginBottom: 8 },
  input: {
    backgroundColor: PALETTE.lavender,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: PALETTE.text,
    fontSize: 14,
    fontFamily: FONT.bodyMedium,
    outlineStyle: 'none',
  } as any,
  textArea: { minHeight: 100 },
  inputError: { borderColor: '#D98A97', backgroundColor: '#FFF5F6' },
  fieldError: { color: PALETTE.danger, fontSize: 11, fontFamily: FONT.bodyBold, marginTop: 6 },
  coverRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  coverPicker: {
    width: 100,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: PALETTE.lavender,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderStyle: 'dashed',
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  coverHint: { color: PALETTE.purple, fontSize: 11, fontFamily: FONT.bodyExtraBold },
  coverText: { flex: 1 },
  helper: { color: PALETTE.muted, fontSize: 11, lineHeight: 17, fontFamily: FONT.body, marginTop: 14 },
  removeCover: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 6 },
  removeCoverText: { color: PALETTE.muted, fontSize: 12, fontFamily: FONT.bodyBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  chipActive: { backgroundColor: PALETTE.purple, borderColor: PALETTE.purple },
  chipText: { color: PALETTE.text, fontSize: 12, fontFamily: FONT.bodyBold },
  chipTextActive: { color: PALETTE.white },
  notice: { marginTop: 16 },
  submit: {
    marginTop: 20,
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: PALETTE.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitText: { color: PALETTE.white, fontSize: 14, fontFamily: FONT.bodyExtraBold },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.82 },
});
