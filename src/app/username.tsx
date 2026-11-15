import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, AtSign, Check, PawPrint, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { AnimatedMascot } from '@/components/AnimatedMascot';
import { Notice, StateCard } from '@/components/ui/feedback';
import { FONT, PALETTE } from '@/constants/palette';
import { ApiError, getErrorMessage, useApi } from '@/lib/api';
import { goBack } from '@/lib/navigation';
import { USERNAME_HINT, checkUsernameLocally, useProfile } from '@/lib/profile';

// `for` is the value that was checked, so a result is never shown for a
// username the user has since changed.
type Availability =
  | { state: 'idle'; for?: string }
  | { state: 'checking'; for: string }
  | { state: 'available'; for: string }
  | { state: 'taken'; for: string; message: string };

/**
 * Choose or change the username. New accounts land here right after Auth0
 * sign-up; existing accounts without a username are redirected here once.
 */
export default function UsernameScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const profile = useProfile();
  const { request } = useApi();

  const isEdit = mode === 'edit' && Boolean(profile.user?.username);
  const [value, setValue] = useState(profile.user?.username ?? '');
  const [availability, setAvailability] = useState<Availability>({ state: 'idle' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const checkId = useRef(0);

  const localError = value.trim() ? checkUsernameLocally(value) : null;
  const unchanged = isEdit && value.trim() === profile.user?.username;

  // Live availability check, debounced.
  useEffect(() => {
    const trimmed = value.trim();
    const id = ++checkId.current;

    if (!trimmed || checkUsernameLocally(trimmed) || unchanged) {
      return;
    }

    const timer = setTimeout(async () => {
      if (id !== checkId.current) return;
      setAvailability({ state: 'checking', for: trimmed });

      try {
        const data = await request<{ available: boolean; error: string | null }>(
          `/api/me/username-availability?username=${encodeURIComponent(trimmed)}`
        );

        if (id !== checkId.current) return;

        setAvailability(
          data.available
            ? { state: 'available', for: trimmed }
            : {
                state: 'taken',
                for: trimmed,
                message: data.error || 'That username is already taken.',
              }
        );
      } catch {
        // The save request validates again, so a failed check isn't fatal.
        if (id === checkId.current) setAvailability({ state: 'idle' });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [request, unchanged, value]);

  const shownAvailability: Availability =
    !value.trim() || localError || unchanged || availability.for !== value.trim()
      ? { state: 'idle' }
      : availability;

  const canSave =
    !saving && !localError && Boolean(value.trim()) && !unchanged && shownAvailability.state !== 'taken';

  const save = async () => {
    const problem = checkUsernameLocally(value);

    if (problem) {
      setError(problem);
      return;
    }

    if (!canSave) return;

    try {
      setSaving(true);
      setError('');

      const data = await request('/api/me/username', {
        method: 'PUT',
        body: JSON.stringify({ username: value.trim() }),
      });

      profile.apply(data);

      if (isEdit) {
        goBack('/account');
      } else {
        router.replace('/home');
      }
    } catch (err) {
      if (err instanceof ApiError && err.data?.code === 'USERNAME_TAKEN') {
        setAvailability({ state: 'taken', for: value.trim(), message: err.message });
      }

      setError(getErrorMessage(err, "We couldn't save your username. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (profile.status === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <StateCard loading loadingText="Getting your profile..." />
        </View>
      </SafeAreaView>
    );
  }

  if (profile.status === 'error' || profile.status === 'not-synced') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <StateCard
            error={
              profile.status === 'not-synced'
                ? "Your account isn't set up yet. Please log in again."
                : profile.error
            }
            onRetry={profile.status === 'not-synced' ? () => router.replace('/login') : profile.refresh}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.blobTop} pointerEvents="none" />

          {isEdit && (
            <Pressable
              onPress={() => goBack('/account')}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Back to my account"
            >
              <ArrowLeft size={18} color={PALETTE.text} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          )}

          <View style={styles.mascot}>
            <AnimatedMascot animation="original" size={190} />
          </View>

          <View style={styles.card}>
            <View style={styles.eyebrowRow}>
              <Sparkles size={14} color={PALETTE.darkPink} />
              <Text style={styles.eyebrow}>
                {isEdit ? 'YOUR NAME IN LAICA’S WORLD' : 'ONE LAST LITTLE STEP'}
              </Text>
            </View>

            <Text style={styles.title}>
              {isEdit ? 'Change your username' : 'What should Laica call you?'}
            </Text>
            <Text style={styles.subtitle}>
              Your username is how other readers and students see you. Your
              email address stays private.
            </Text>

            <Text style={styles.label}>USERNAME</Text>
            <View
              style={[
                styles.inputRow,
                (localError || shownAvailability.state === 'taken') && styles.inputRowError,
                shownAvailability.state === 'available' && styles.inputRowOk,
              ]}
            >
              <AtSign size={17} color={PALETTE.muted} />
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={(text) => {
                  setValue(text.replace(/\s/g, ''));
                  setError('');
                }}
                placeholder="e.g. laica_reader"
                placeholderTextColor="#A99AAF"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={save}
                editable={!saving}
                accessibilityLabel="Username"
              />
              {shownAvailability.state === 'checking' && (
                <ActivityIndicator size="small" color={PALETTE.purple} />
              )}
              {shownAvailability.state === 'available' && <Check size={18} color={PALETTE.success} />}
            </View>

            <Text
              style={[
                styles.helper,
                (localError || shownAvailability.state === 'taken') && styles.helperError,
                shownAvailability.state === 'available' && styles.helperOk,
              ]}
              accessibilityLiveRegion="polite"
            >
              {localError ||
                (shownAvailability.state === 'taken'
                  ? shownAvailability.message
                  : shownAvailability.state === 'available'
                    ? 'Lovely, this username is free!'
                    : unchanged
                      ? 'This is your current username.'
                      : USERNAME_HINT)}
            </Text>

            {error && error !== localError ? (
              <Notice tone="error" message={error} style={styles.notice} />
            ) : null}

            <Pressable
              onPress={save}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveButton,
                !canSave && styles.saveButtonDisabled,
                pressed && canSave && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave, busy: saving }}
            >
              {saving ? (
                <ActivityIndicator color={PALETTE.white} />
              ) : (
                <PawPrint size={18} color={PALETTE.white} />
              )}
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : isEdit ? 'Save username' : 'Continue to my world'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  container: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  blobTop: {
    position: 'absolute',
    top: -120,
    right: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: PALETTE.pink,
    opacity: 0.45,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  backText: { color: PALETTE.text, fontSize: 13, fontFamily: FONT.bodyExtraBold },
  mascot: { alignItems: 'center', marginBottom: -26, zIndex: 2 },
  card: {
    backgroundColor: PALETTE.white,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: PALETTE.border,
    shadowColor: PALETTE.text,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: {
    color: PALETTE.darkPink,
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: FONT.bodyExtraBold,
  },
  title: { color: PALETTE.text, fontSize: 26, fontFamily: FONT.heading, marginTop: 10 },
  subtitle: {
    color: PALETTE.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.body,
    marginTop: 8,
  },
  label: {
    color: PALETTE.muted,
    fontSize: 10,
    letterSpacing: 1.5,
    fontFamily: FONT.bodyExtraBold,
    marginTop: 22,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PALETTE.lavender,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputRowError: { borderColor: '#D98A97', backgroundColor: '#FFF5F6' },
  inputRowOk: { borderColor: '#B9D2B4' },
  input: {
    flex: 1,
    color: PALETTE.text,
    fontSize: 16,
    fontFamily: FONT.bodyBold,
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,
  helper: {
    color: PALETTE.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.bodyMedium,
    marginTop: 8,
  },
  helperError: { color: PALETTE.danger },
  helperOk: { color: PALETTE.success },
  notice: { marginTop: 14 },
  saveButton: {
    marginTop: 22,
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: PALETTE.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveText: { color: PALETTE.white, fontSize: 14, fontFamily: FONT.bodyExtraBold },
  pressed: { opacity: 0.82 },
});
