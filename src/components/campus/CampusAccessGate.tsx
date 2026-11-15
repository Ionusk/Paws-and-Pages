import { router } from 'expo-router';
import {
    ArrowLeft,
    GraduationCap,
    KeyRound,
    Mail,
    RefreshCw,
    ShieldCheck,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';

import { AnimatedMascot } from '@/components/AnimatedMascot';
import { Notice } from '@/components/ui/feedback';
import { COMPACT_BREAKPOINT, FONT, PALETTE } from '@/constants/palette';
import { getErrorMessage, useApi } from '@/lib/api';
import { goBack } from '@/lib/navigation';
import { useProfile, type CampusStatus } from '@/lib/profile';

const STUDENT_DOMAIN = '@student.upt.ro';
const RESEND_SECONDS = 60;

function reasonMessage(campus: CampusStatus | null) {
  switch (campus?.reason) {
    case 'EMAIL_NOT_VERIFIED':
      return {
        tone: 'info' as const,
        text: 'Your account uses a UPT address, but Auth0 hasn’t confirmed it yet. Open the verification email Auth0 sent you, click the link, then tap “Check again”.',
      };
    case 'EMAIL_IN_USE':
      return {
        tone: 'error' as const,
        text: 'This UPT address is already linked to another Paws & Pages account. Each address can unlock Campus for one account.',
      };
    case 'VERIFICATION_EXPIRED':
      return {
        tone: 'info' as const,
        text: 'Your student verification is more than 6 months old. Please confirm your UPT address again.',
      };
    case 'RECHECK_REQUIRED':
      return {
        tone: 'info' as const,
        text: 'We need to re-check your account email with Auth0. Tap “Check again”.',
      };
    default:
      return null;
  }
}

function secondsUntilResend(codeSentAt: string | null, now: number) {
  if (!codeSentAt) return 0;
  const elapsed = (now - new Date(codeSentAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_SECONDS - elapsed));
}

/** Shown instead of Campus to users without verified UPT student access. */
export function CampusAccessGate() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const profile = useProfile();
  const { request } = useApi();
  const campus = profile.campus;

  const [email, setEmail] = useState(campus?.pendingStudentEmail ?? '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>(campus?.pendingStudentEmail ? 'code' : 'email');
  const [busy, setBusy] = useState<'send' | 'verify' | 'check' | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [sentAt, setSentAt] = useState<string | null>(campus?.codeSentAt ?? null);
  const [now, setNow] = useState(() => Date.now());

  const resendIn = secondsUntilResend(sentAt, now);

  // Tick once per second while the resend countdown is running.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendIn, now]);

  const reason = reasonMessage(campus);
  const emailValid = /^[a-z0-9._%+-]+@student\.upt\.ro$/.test(email.trim().toLowerCase());

  const sendCode = async () => {
    if (!emailValid || busy) {
      if (!emailValid) setError(`Enter your university address ending in ${STUDENT_DOMAIN}.`);
      return;
    }

    try {
      setBusy('send');
      setError('');
      setInfo('');

      const data = await request<{ pendingStudentEmail: string; codeSentAt: string }>(
        '/api/me/student-email/start',
        { method: 'POST', body: JSON.stringify({ email: email.trim() }) }
      );

      setEmail(data.pendingStudentEmail);
      setSentAt(data.codeSentAt);
      setNow(Date.now());
      setStep('code');
      setInfo(`Auth0 sent a code to ${data.pendingStudentEmail}. It can take a minute to arrive; check your spam folder too.`);
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't send the code. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const verifyCode = async () => {
    if (!/^[0-9]{4,10}$/.test(code.trim()) || busy) {
      if (!busy) setError('Enter the code from the email.');
      return;
    }

    try {
      setBusy('verify');
      setError('');

      const data = await request('/api/me/student-email/verify', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });

      // When access is granted, the Campus layout replaces this screen.
      profile.apply(data);
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't check the code. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const checkAgain = async () => {
    if (busy) return;

    try {
      setBusy('check');
      setError('');
      await profile.recheckCampus();
      setInfo('We checked your account again.');
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't check your account right now."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container, isCompact && styles.containerCompact]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.blobTop} pointerEvents="none" />

        <Pressable
          onPress={() => goBack('/home')}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={18} color={PALETTE.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.mascot}>
          <AnimatedMascot animation="sleepy" size={isCompact ? 180 : 210} />
        </View>

        <View style={styles.card}>
          <View style={styles.iconRow}>
            <View style={styles.icon}>
              <GraduationCap size={24} color={PALETTE.purple} />
            </View>
            <Text style={styles.eyebrow}>CAMPUS BOOKS · UPT STUDENTS ONLY</Text>
          </View>

          <Text style={styles.title}>A little library for UPT students</Text>
          <Text style={styles.body}>
            Campus lets students of Universitatea Politehnica Timișoara lend
            and borrow books from each other. To keep it a safe student
            community, it’s only open to accounts with a verified{' '}
            <Text style={styles.bold}>{STUDENT_DOMAIN}</Text> address.
          </Text>

          {reason ? <Notice tone={reason.tone} message={reason.text} style={styles.notice} /> : null}
          {info ? <Notice tone="success" message={info} onDismiss={() => setInfo('')} style={styles.notice} /> : null}
          {error ? <Notice tone="error" message={error} onDismiss={() => setError('')} style={styles.notice} /> : null}

          {campus?.verificationAvailable ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Verify your UPT email</Text>

              {step === 'email' ? (
                <>
                  <Text style={styles.sectionText}>
                    We’ll ask Auth0 to email you a one-time code. You keep using
                    this Paws & Pages account.
                  </Text>

                  <View style={styles.inputRow}>
                    <Mail size={17} color={PALETTE.muted} />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text.trim());
                        setError('');
                      }}
                      placeholder={`name.surname${STUDENT_DOMAIN}`}
                      placeholderTextColor="#A99AAF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      inputMode="email"
                      maxLength={254}
                      onSubmitEditing={sendCode}
                      editable={!busy}
                      accessibilityLabel="UPT student email"
                    />
                  </View>

                  <Pressable
                    onPress={sendCode}
                    disabled={!emailValid || Boolean(busy) || resendIn > 0}
                    style={({ pressed }) => [
                      styles.primary,
                      (!emailValid || busy || resendIn > 0) && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !emailValid || Boolean(busy) || resendIn > 0, busy: busy === 'send' }}
                  >
                    {busy === 'send' ? <ActivityIndicator color={PALETTE.white} /> : <Mail size={17} color={PALETTE.white} />}
                    <Text style={styles.primaryText}>
                      {busy === 'send' ? 'Sending...' : resendIn > 0 ? `Send code (${resendIn}s)` : 'Send me a code'}
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.sectionText}>
                    Enter the code sent to <Text style={styles.bold}>{email}</Text>.
                  </Text>

                  <View style={styles.inputRow}>
                    <KeyRound size={17} color={PALETTE.muted} />
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      value={code}
                      onChangeText={(text) => {
                        setCode(text.replace(/[^0-9]/g, ''));
                        setError('');
                      }}
                      placeholder="123456"
                      placeholderTextColor="#A99AAF"
                      keyboardType="number-pad"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      maxLength={10}
                      onSubmitEditing={verifyCode}
                      editable={!busy}
                      accessibilityLabel="Verification code"
                    />
                  </View>

                  <Pressable
                    onPress={verifyCode}
                    disabled={code.length < 4 || Boolean(busy)}
                    style={({ pressed }) => [
                      styles.primary,
                      (code.length < 4 || busy) && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: code.length < 4 || Boolean(busy), busy: busy === 'verify' }}
                  >
                    {busy === 'verify' ? (
                      <ActivityIndicator color={PALETTE.white} />
                    ) : (
                      <ShieldCheck size={17} color={PALETTE.white} />
                    )}
                    <Text style={styles.primaryText}>{busy === 'verify' ? 'Checking...' : 'Verify and open Campus'}</Text>
                  </Pressable>

                  <View style={styles.linkRow}>
                    <Pressable
                      onPress={() => {
                        setStep('email');
                        setCode('');
                        setError('');
                        setInfo('');
                      }}
                      disabled={Boolean(busy)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.link}>Use a different address</Text>
                    </Pressable>

                    <Pressable
                      onPress={sendCode}
                      disabled={Boolean(busy) || resendIn > 0}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.link, (busy || resendIn > 0) && styles.linkDisabled]}>
                        {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How to get access</Text>
              <Text style={styles.sectionText}>
                Sign in to Paws & Pages with your {STUDENT_DOMAIN} address and
                confirm it through the verification email from Auth0. Email
                code verification for other accounts isn’t switched on yet.
              </Text>
            </View>
          )}

          <Pressable
            onPress={checkAgain}
            disabled={Boolean(busy)}
            style={({ pressed }) => [styles.secondary, busy && styles.disabled, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(busy), busy: busy === 'check' }}
          >
            {busy === 'check' ? (
              <ActivityIndicator color={PALETTE.text} />
            ) : (
              <RefreshCw size={16} color={PALETTE.text} />
            )}
            <Text style={styles.secondaryText}>Check again</Text>
          </Pressable>

          <View style={styles.privacy}>
            <ShieldCheck size={15} color={PALETTE.sageDark} />
            <Text style={styles.privacyText}>
              We never ask for your UPT password. Other students only see your
              username, never your email.
            </Text>
          </View>
        </View>

        <Pressable onPress={() => router.replace('/home')} accessibilityRole="button" style={styles.homeLink}>
          <Text style={styles.link}>Back to my little world</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  container: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 30,
    paddingTop: 24,
    paddingBottom: 40,
    overflow: 'hidden',
  },
  containerCompact: { paddingHorizontal: 18 },
  blobTop: {
    position: 'absolute',
    top: -130,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: PALETTE.pink,
    opacity: 0.4,
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
  mascot: { alignItems: 'center', marginBottom: -24, zIndex: 2 },
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
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: PALETTE.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { color: PALETTE.darkPink, fontSize: 10, letterSpacing: 1.5, fontFamily: FONT.bodyExtraBold, flexShrink: 1 },
  title: { color: PALETTE.text, fontSize: 24, fontFamily: FONT.heading, marginTop: 14 },
  body: { color: PALETTE.muted, fontSize: 13, lineHeight: 20, fontFamily: FONT.body, marginTop: 8 },
  bold: { fontFamily: FONT.bodyExtraBold, color: PALETTE.text },
  notice: { marginTop: 14 },
  section: {
    marginTop: 20,
    backgroundColor: '#FBF8FC',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  sectionTitle: { color: PALETTE.text, fontSize: 17, fontFamily: FONT.heading },
  sectionText: { color: PALETTE.muted, fontSize: 12, lineHeight: 18, fontFamily: FONT.body, marginTop: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: PALETTE.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 14,
    minHeight: 50,
    marginTop: 14,
  },
  input: {
    flex: 1,
    color: PALETTE.text,
    fontSize: 15,
    fontFamily: FONT.bodyBold,
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,
  codeInput: { letterSpacing: 4 },
  primary: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: PALETTE.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
  },
  primaryText: { color: PALETTE.white, fontSize: 14, fontFamily: FONT.bodyExtraBold },
  secondary: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: PALETTE.lavender,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { color: PALETTE.text, fontSize: 13, fontFamily: FONT.bodyExtraBold },
  disabled: { opacity: 0.5 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  link: { color: PALETTE.darkPink, fontSize: 12, fontFamily: FONT.bodyExtraBold, paddingVertical: 6 },
  linkDisabled: { color: PALETTE.muted },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 18 },
  privacyText: { flex: 1, color: PALETTE.muted, fontSize: 11, lineHeight: 16, fontFamily: FONT.body },
  homeLink: { alignSelf: 'center', marginTop: 18 },
  pressed: { opacity: 0.82 },
});
