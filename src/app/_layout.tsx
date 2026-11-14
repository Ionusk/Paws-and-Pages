
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { Platform, Text } from "react-native";
import { Auth0Provider } from "react-native-auth0";
import * as SplashScreen from "expo-splash-screen";

import {
  useFonts,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_700Bold,
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FFF8F1" },
          animation: "fade",
        }}
      />
    </Auth0Provider>
  );
}
