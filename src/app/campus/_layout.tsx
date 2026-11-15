import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { CampusAccessGate } from '@/components/campus/CampusAccessGate';
import { StateCard } from '@/components/ui/feedback';
import { PALETTE } from '@/constants/palette';
import { useProfile } from '@/lib/profile';

/**
 * Every Campus screen sits under this layout, so typing a Campus URL by hand
 * still lands on the access check. The backend enforces the same rule on
 * every Campus endpoint; this only decides what to show.
 */
export default function CampusLayout() {
  const profile = useProfile();
  const { refresh } = profile;

  // Pick up changes made outside the app (e.g. Auth0 email verification).
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (profile.status === 'loading' || (profile.status === 'ready' && profile.user?.needsUsername)) {
    return (
      <SafeAreaView style={styles.center}>
        <StateCard loading loadingText="Opening the campus library..." />
      </SafeAreaView>
    );
  }

  if (profile.status !== 'ready') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.inner}>
          <StateCard
            error={
              profile.status === 'not-synced'
                ? "Your account isn't set up yet. Please log in again."
                : profile.error || "We couldn't check your Campus access."
            }
            onRetry={profile.status === 'not-synced' ? () => router.replace('/login') : refresh}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile.campus?.access) {
    return <CampusAccessGate />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: PALETTE.background },
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: PALETTE.background,
    justifyContent: 'center',
    padding: 24,
  },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center' },
});
