import { Stack } from "expo-router";
import { Platform } from "react-native";
import { Auth0Provider } from "react-native-auth0";

const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN!;

const auth0ClientId =
  Platform.OS === "web"
    ? process.env.EXPO_PUBLIC_AUTH0_WEB_CLIENT_ID!
    : process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID!;

export default function RootLayout() {
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
