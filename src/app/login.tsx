
import { router } from "expo-router";
import { ArrowLeft, LogOut, RefreshCw } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { useAuth0 } from "react-native-auth0";

import { Notice } from "@/components/ui/feedback";
import { COMPACT_BREAKPOINT } from "@/constants/palette";
import { API_AUDIENCE, AUTH_SCOPE, apiRequest, getErrorMessage } from "@/lib/api";
import {
    CUSTOM_SCHEME,
    LOGIN_TIME_KEY,
    clearLoginTime,
    markLoginStarted,
} from "@/lib/authSession";
import { goBack } from "@/lib/navigation";
import { AnimatedMascot } from "../components/AnimatedMascot";

const SESSION_DURATION = 4 * 60 * 60 * 1000;

// Auth0 reports a user closing the login window as a cancellation. That is
// not an error worth showing in red.
function isCancellation(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("cancel") ||
    message.includes("closed") ||
    message.includes("dismiss")
  );
}

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT + 120;

  const {
    authorize,
    user,
    isLoading,
    clearSession,
    getCredentials,
  } = useAuth0();

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Getting your paws ready...");
  const [errorMessage, setErrorMessage] = useState("");
  const [syncFailed, setSyncFailed] = useState(false);
  const [syncAttempt, setSyncAttempt] = useState(0);

  const syncedUserRef = useRef<string | null>(null);

  // =========================================================
  // SYNC AUTH0 USER WITH TIGERDATA
  // =========================================================

  useEffect(() => {
    if (isLoading || !user) {
      return;
    }

    const auth0Id = user.sub;

    // Do not sync again if this user was already saved.
    if (auth0Id && syncedUserRef.current === auth0Id) {
      return;
    }

    let cancelled = false;
    let sessionTimer: ReturnType<typeof setTimeout> | undefined;

    const syncUserWithDatabase = async () => {
      try {
        if (!auth0Id) {
          throw new Error(
            "We couldn't identify your account. Please log in again."
          );
        }

        // ---------------------------------------------
        // WEB SESSION LIMIT (4 HOURS)
        // ---------------------------------------------

        if (Platform.OS === "web") {
          let savedLoginTime = localStorage.getItem(LOGIN_TIME_KEY);

          if (!savedLoginTime) {
            savedLoginTime = Date.now().toString();
            localStorage.setItem(LOGIN_TIME_KEY, savedLoginTime);
          }

          const elapsed = Date.now() - Number(savedLoginTime);

          if (elapsed >= SESSION_DURATION) {
            clearLoginTime();
            syncedUserRef.current = null;

            await clearSession();

            return;
          }

          sessionTimer = setTimeout(() => {
            clearLoginTime();
            syncedUserRef.current = null;

            clearSession();
          }, SESSION_DURATION - elapsed);
        }

        if (cancelled) return;

        setLoading(true);
        setLoadingText("Setting up your little world...");
        setErrorMessage("");
        setSyncFailed(false);

        // 1. Auth0 access token for the API
        const credentials = await getCredentials(AUTH_SCOPE, 0, {
          audience: API_AUDIENCE,
        });

        if (!credentials.accessToken) {
          throw new Error("Auth0 did not return an access token.");
        }

        if (cancelled) return;

        // 2. Save / update the user and their wallet in the backend
        await apiRequest("/api/auth/sync", credentials.accessToken, {
          method: "POST",
          body: JSON.stringify({
            email: user.email || null,
            name: user.name || user.nickname || null,
          }),
        });

        syncedUserRef.current = auth0Id;

        if (!cancelled) {
          router.replace("/home");
        }
      } catch (error) {
        console.error("Account sync error:", error);

        syncedUserRef.current = null;

        if (!cancelled) {
          setSyncFailed(true);
          setErrorMessage(
            getErrorMessage(
              error,
              "We couldn't finish setting up your account."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    syncUserWithDatabase();

    return () => {
      cancelled = true;

      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sub, isLoading, syncAttempt]);

  // =========================================================
  // LOGIN / SIGN UP
  // =========================================================

  const startAuth = async (mode: "login" | "signup") => {
    if (loading) return;

    try {
      setLoading(true);
      setLoadingText(
        mode === "signup" ? "Opening sign up..." : "Opening login..."
      );
      setErrorMessage("");
      setSyncFailed(false);

      syncedUserRef.current = null;

      const parameters = {
        scope: AUTH_SCOPE,
        audience: API_AUDIENCE,
        ...(mode === "signup"
          ? { additionalParameters: { screen_hint: "signup" } }
          : {}),
      };

      if (Platform.OS === "web") {
        // Auth0 returns to "/" after login; index.tsx uses this flag
        // to send the user back here to finish setting up the account.
        markLoginStarted();
        await authorize(parameters);
      } else {
        await authorize(parameters, {
          customScheme: CUSTOM_SCHEME,
        });
      }
    } catch (error) {
      console.error(`${mode} error:`, error);

      if (!isCancellation(error)) {
        setErrorMessage(
          getErrorMessage(
            error,
            mode === "signup"
              ? "Account creation could not be completed."
              : "Login could not be completed."
          )
        );
      }

      setLoading(false);
    }
  };

  const handleRetrySync = () => {
    syncedUserRef.current = null;
    setSyncAttempt((attempt) => attempt + 1);
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      setLoadingText("Logging you out...");
      clearLoginTime();
      syncedUserRef.current = null;

      await clearSession(
        {},
        Platform.OS === "web" ? undefined : { customScheme: CUSTOM_SCHEME }
      );

      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
      setErrorMessage("We couldn't log you out. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (isLoading || loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D69BA5" />

        <Text style={styles.loadingText}>{loadingText}</Text>
      </SafeAreaView>
    );
  }

  // =========================================================
  // SIGNED IN BUT ACCOUNT SETUP FAILED
  // =========================================================

  if (user && syncFailed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.container, styles.centered]}>
          <View style={styles.syncCard}>
            <AnimatedMascot animation="sleepy" size={170} />

            <Text style={styles.syncTitle}>Laica couldn’t open your world</Text>

            <Text style={styles.syncText}>
              You’re signed in, but we couldn’t finish setting up your account.
            </Text>

            <Notice
              tone="error"
              message={errorMessage}
              style={styles.syncNotice}
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRetrySync}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <RefreshCw size={17} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Try again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleLogout}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <LogOut size={16} color="#806A70" />
              <Text style={styles.secondaryButtonText}>
                Log out and use another account
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // =========================================================
  // LOGIN SCREEN
  // =========================================================

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.container, isCompact && styles.containerCompact]}>
          {/* BACK BUTTON */}
          <TouchableOpacity
            onPress={() => goBack("/")}
            style={[styles.backButton, isCompact && styles.backButtonCompact]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to the welcome page"
          >
            <ArrowLeft size={16} color="#806A70" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* HEADER */}
          <View style={[styles.header, isCompact && styles.headerCompact]}>
            <Text style={styles.logo}>PAWS & PAGES</Text>

            <Text style={styles.subtitle}>
              Your little corner of reading and learning ♡
            </Text>
          </View>

          {/* MAIN CONTENT */}
          <View
            style={[styles.mainContent, isCompact && styles.mainContentCompact]}
          >
            {isCompact && (
              <View style={styles.mascotContainerCompact}>
                <AnimatedMascot animation="original" size={210} />
              </View>
            )}

            {/* LOGIN BUTTON */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.loginButton,
                isCompact && styles.actionButtonCompact,
              ]}
              onPress={() => startAuth("login")}
              activeOpacity={0.85}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Log in"
              accessibilityHint="Opens the secure Auth0 login page"
            >
              <Text style={styles.buttonIcon}>♡</Text>
              <Text style={styles.buttonTitle}>Log in</Text>
              <Text style={styles.buttonDescription}>Welcome back!</Text>
              <Text style={styles.buttonArrow}>→</Text>
            </TouchableOpacity>

            {/* LAICA - CENTER */}
            {!isCompact && (
              <View style={styles.mascotContainer}>
                <AnimatedMascot animation="original" />
              </View>
            )}

            {/* SIGNUP BUTTON */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.signupButton,
                isCompact && styles.actionButtonCompact,
              ]}
              onPress={() => startAuth("signup")}
              activeOpacity={0.85}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Create an account"
              accessibilityHint="Opens the secure Auth0 sign up page"
            >
              <Text style={styles.buttonIcon}>✧</Text>
              <Text style={styles.buttonTitle}>Create an account</Text>
              <Text style={styles.buttonDescription}>
                Join our little world!
              </Text>
              <Text style={styles.buttonArrow}>→</Text>
            </TouchableOpacity>
          </View>

          {/* ERROR */}
          {errorMessage !== "" && (
            <Notice
              tone="error"
              message={errorMessage}
              onDismiss={() => setErrorMessage("")}
              style={styles.errorNotice}
            />
          )}

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerPaw}>🐾</Text>

            <Text style={styles.footerText}>
              Secure sign in with Auth0. A safe little space for big adventures ♡
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFF8F1",
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    paddingVertical: 20,
  },

  containerCompact: {
    paddingHorizontal: 20,
    justifyContent: "flex-start",
  },

  centered: {
    justifyContent: "center",
  },

  backButton: {
    position: "absolute",
    top: 20,
    left: 30,
    zIndex: 5,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
  },

  backButtonCompact: {
    position: "relative",
    top: 0,
    left: 0,
    alignSelf: "flex-start",
  },

  backText: {
    color: "#806A70",
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
  },

  header: {
    alignItems: "center",
    marginTop: 12,
  },

  headerCompact: {
    marginTop: 4,
  },

  logo: {
    color: "#735E64",
    fontSize: 19,
    fontFamily: "PlayfairDisplay_700Bold",
    letterSpacing: 5,
  },

  subtitle: {
    color: "#A78B9A",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },

  mainContent: {
    width: "100%",
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },

  mainContentCompact: {
    flex: 0,
    flexDirection: "column",
    gap: 14,
    marginVertical: 18,
    maxWidth: 420,
  },

  mascotContainer: {
    width: "36%",
    height: 250,
    alignItems: "center",
    justifyContent: "center",
  },

  mascotContainerCompact: {
    alignItems: "center",
    justifyContent: "center",
    height: 200,
  },

  actionButton: {
    flex: 1,
    maxWidth: 260,
    minHeight: 210,
    borderRadius: 28,
    padding: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#735E64",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },

  actionButtonCompact: {
    flex: 0,
    width: "100%",
    maxWidth: "100%",
    minHeight: 0,
    paddingVertical: 20,
  },

  loginButton: {
    backgroundColor: "#D69BA5",
  },

  signupButton: {
    backgroundColor: "#C9B8E8",
  },

  buttonIcon: {
    color: "#FFFFFF",
    fontSize: 34,
    marginBottom: 15,
  },

  buttonTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontFamily: "Nunito_800ExtraBold",
    textAlign: "center",
  },

  buttonDescription: {
    color: "#FFFFFF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 18,
  },

  buttonArrow: {
    color: "#FFFFFF",
    fontSize: 24,
    fontFamily: "Nunito_700Bold",
    marginTop: 15,
  },

  errorNotice: {
    width: "100%",
    maxWidth: 560,
    marginBottom: 12,
  },

  footer: {
    alignItems: "center",
    marginBottom: 8,
  },

  footerPaw: {
    fontSize: 20,
    marginBottom: 5,
  },

  footerText: {
    color: "#A78B9A",
    fontSize: 11,
    textAlign: "center",
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#FFF8F1",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: "#A78B9A",
    marginTop: 15,
    fontSize: 13,
  },

  syncCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1E3DA",
    shadowColor: "#735E64",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  syncTitle: {
    color: "#493653",
    fontSize: 21,
    fontFamily: "PlayfairDisplay_700Bold",
    textAlign: "center",
    marginTop: 6,
  },

  syncText: {
    color: "#806B87",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },

  syncNotice: {
    alignSelf: "stretch",
    marginTop: 16,
  },

  primaryButton: {
    alignSelf: "stretch",
    minHeight: 50,
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#D69BA5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Nunito_800ExtraBold",
  },

  secondaryButton: {
    alignSelf: "stretch",
    minHeight: 46,
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: "#FFF8F1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  secondaryButtonText: {
    color: "#806A70",
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
  },
});
