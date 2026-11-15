
import { ConversationProvider } from "@elevenlabs/react-native";
import { Stack, useRouter, useSegments } from "expo-router";

import { ProfileProvider, useProfile } from "@/lib/profile";
import { SkinProvider } from "../components/SkinProvider";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { Auth0Provider, useAuth0 } from "react-native-auth0";

import {
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    useFonts,
} from "@expo-google-fonts/playfair-display";

import {
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";

const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN!;

const auth0ClientId =
  Platform.OS === "web"
    ? process.env.EXPO_PUBLIC_AUTH0_WEB_CLIENT_ID!
    : process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID!;

SplashScreen.preventAutoHideAsync();

// Fonturi disponibile în tot proiectul
export const FONTS = {
  heading: "PlayfairDisplay_700Bold",
  headingRegular: "PlayfairDisplay_400Regular",
  body: "Nunito_400Regular",
  bodyMedium: "Nunito_600SemiBold",
  bodyBold: "Nunito_700Bold",
  bodyExtraBold: "Nunito_800ExtraBold",
};

// Nunito devine fontul implicit pentru toate componentele Text.
const NativeText = Text as typeof Text & {
  defaultProps?: { style?: any };
};

NativeText.defaultProps = {
  ...NativeText.defaultProps,
  style: [
    { fontFamily: FONTS.body },
    NativeText.defaultProps?.style,
  ],
};

// Screens that require a logged-in user. The welcome screen ("index") and
// "login" stay public. If the user logs out (or was never logged in), Expo
// Router redirects any of these routes back to the welcome screen.
const PROTECTED_SCREENS = [
  "home",
  "account",
  "quests",
  "shop",
  "friends",
  "explore",
  "tabs",
  "username",
  // Campus has its own layout that also requires verified UPT student access.
  "campus",
  "reading/index",
  "reading/library",
  "reading/add-book",
  "reading/session",
  "reading/review",
  "study/index",
  "study/upload",
  "study/aisummary",
  "study/practice",
  "study/quiz",
  "study/summary",
  "study/voice",
  "study/audio",
  "study/tutor",
  "study/conversations",
  "study/conversation/[id]",
];

// Routes a signed-in user may stay on before they have picked a username.
const USERNAME_EXEMPT_ROUTES = new Set(["", "index", "login", "username"]);

function RootNavigator() {
  const { user, isLoading } = useAuth0();
  const profile = useProfile();
  const segments = useSegments();
  const router = useRouter();

  // Wait for the first Auth0 session check only. After that the navigator
  // stays mounted, so later loading flags never reset navigation state.
  const [authReady, setAuthReady] = useState(!isLoading);

  if (!authReady && !isLoading) {
    setAuthReady(true);
  }

  // Existing accounts without a username are asked to choose one before
  // using the rest of the app.
  const firstSegment = String(segments[0] ?? "");
  const mustChooseUsername =
    Boolean(user) &&
    profile.status === "ready" &&
    Boolean(profile.user?.needsUsername) &&
    !USERNAME_EXEMPT_ROUTES.has(firstSegment);

  useEffect(() => {
    if (mustChooseUsername) {
      router.replace("/username");
    }
  }, [mustChooseUsername, router]);

  if (!authReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#E9DDF2",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#927BA0" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFF8F1" },
        animation: "fade",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />

      <Stack.Protected guard={Boolean(user)}>
        {PROTECTED_SCREENS.map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Expo inlines EXPO_PUBLIC_* variables at bundle time from the project-root
  // .env. Without them Auth0 throws on startup, so explain what's wrong.
  if (!auth0Domain || !auth0ClientId) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#E9DDF2",
          alignItems: "center",
          justifyContent: "center",
          padding: 30,
        }}
      >
        <Text
          style={{
            color: "#493653",
            fontSize: 22,
            fontFamily: FONTS.heading,
            textAlign: "center",
          }}
        >
          Auth0 is not configured
        </Text>
        <Text
          style={{
            color: "#806B87",
            fontSize: 13,
            lineHeight: 20,
            textAlign: "center",
            marginTop: 10,
            maxWidth: 460,
          }}
        >
          Set EXPO_PUBLIC_AUTH0_DOMAIN and{" "}
          {Platform.OS === "web"
            ? "EXPO_PUBLIC_AUTH0_WEB_CLIENT_ID"
            : "EXPO_PUBLIC_AUTH0_CLIENT_ID"}{" "}
          in the .env file at the project root, then restart Expo with
          {" npx expo start -c"}.
        </Text>
      </View>
    );
  }

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      {...(Platform.OS === "web"
        ? {
            cacheLocation: "localstorage" as const,
            useRefreshTokens: true,
            useRefreshTokensFallback: true,
          }
        : {})}
    >
      <ProfileProvider>
        <SkinProvider>
          <ConversationProvider>
            <RootNavigator />
          </ConversationProvider>
        </SkinProvider>
      </ProfileProvider>
    </Auth0Provider>
  );
}
