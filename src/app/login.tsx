
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth0 } from "react-native-auth0";
import { AnimatedMascot } from "../components/AnimatedMascot";
import { markLoginStarted } from "@/lib/authSession";

const CUSTOM_SCHEME = "pawsandpages";

const API_URL = "http://localhost:3001";
const API_AUDIENCE = "https://paws-and-pages-api";

const AUTH_SCOPE = "openid profile email offline_access";

const SESSION_DURATION = 4 * 60 * 60 * 1000;
const LOGIN_TIME_KEY = "paws_pages_login_time";

export default function LoginScreen() {
  const {
    authorize,
    user,
    isLoading,
    clearSession,
    getCredentials,
  } = useAuth0();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const syncedUserRef = useRef<string | null>(null);

  // =========================================================
  // SINCRONIZARE AUTH0 CU TIGERDATA
  // =========================================================

  useEffect(() => {
    if (isLoading || !user) {
      return;
      console.log("AUTH EFFECT:", {
  isLoading,
  user: user?.sub,
});
    }
    

    const auth0Id = user.sub;

    if (!auth0Id) {
      setErrorMessage("Could not identify your account.");
      return;
    }

    // Nu sincronizăm din nou dacă utilizatorul a fost deja salvat.
    if (syncedUserRef.current === auth0Id) {
      return;
    }

    let cancelled = false;
    let sessionTimer: ReturnType<typeof setTimeout> | undefined;

    const syncUserWithDatabase = async () => {
      let currentStep = "Inițializare";

      try {
        // ---------------------------------------------
        // VERIFICARE SESIUNE WEB
        // ---------------------------------------------

        if (Platform.OS === "web") {
          let savedLoginTime = localStorage.getItem(LOGIN_TIME_KEY);

          if (!savedLoginTime) {
            savedLoginTime = Date.now().toString();

            localStorage.setItem(
              LOGIN_TIME_KEY,
              savedLoginTime
            );
          }

          const loginTime = Number(savedLoginTime);
          const elapsed = Date.now() - loginTime;

          if (elapsed >= SESSION_DURATION) {
            localStorage.removeItem(LOGIN_TIME_KEY);
            syncedUserRef.current = null;

            await clearSession({
              openUrl: true,
            });

            return;
          }

          const remainingTime = SESSION_DURATION - elapsed;

          sessionTimer = setTimeout(() => {
            localStorage.removeItem(LOGIN_TIME_KEY);
            syncedUserRef.current = null;

            clearSession({
              openUrl: true,
            });
          }, remainingTime);
        }

        if (cancelled) return;

        setLoading(true);
        setErrorMessage("");

        // ---------------------------------------------
        // PASUL 1: OBȚINERE TOKEN AUTH0
        // ---------------------------------------------

        currentStep = "Obținere token Auth0";

        console.log("PASUL 1: Solicit token de la Auth0...");

        const credentials = await getCredentials(
          AUTH_SCOPE,
          0,
          {
            audience: API_AUDIENCE,
          }
        );

        if (!credentials.accessToken) {
          throw new Error(
            "Auth0 nu a returnat un access token."
          );
        }

        console.log("PASUL 2: Token Auth0 primit.");

        if (cancelled) return;

        // ---------------------------------------------
        // PASUL 2: CONECTARE LA BACKEND
        // ---------------------------------------------

        currentStep = "Conectare la backend";

        console.log(
          "PASUL 3: Trimit utilizatorul către:",
          `${API_URL}/api/auth/sync`
        );

        const response = await fetch(
          `${API_URL}/api/auth/sync`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${credentials.accessToken}`,
            },
            body: JSON.stringify({
              email: user.email || null,
              name: user.name || user.nickname || null,
            }),
          }
        );

        console.log(
          "PASUL 4: Backend status:",
          response.status
        );

        if (cancelled) return;

        // ---------------------------------------------
        // PASUL 3: CITIRE RĂSPUNS BACKEND
        // ---------------------------------------------

        currentStep = "Citire răspuns backend";

        const responseText = await response.text();

        let data: any;

        try {
          data = responseText
            ? JSON.parse(responseText)
            : {};
        } catch {
          throw new Error(
            `Backend-ul a returnat un răspuns invalid: ${responseText.slice(0, 200)}`
          );
        }

        console.log("PASUL 5: Răspuns backend:", data);

        if (!response.ok) {
          throw new Error(
            data.error || `Backend error: ${response.status}`
          );
        }

        if (!data.success) {
          throw new Error(
            "TigerData nu a confirmat salvarea utilizatorului."
          );
        }

        // ---------------------------------------------
        // SINCRONIZARE REUȘITĂ
        // ---------------------------------------------

        console.log(
          "Utilizator sincronizat cu TigerData:",
          data.user
        );

        syncedUserRef.current = auth0Id;

        if (!cancelled) {
  console.log("ÎNAINTE DE NAVIGARE:", window.location.href);

  router.replace("/home");

  setTimeout(() => {
    console.log("DUPĂ NAVIGARE:", window.location.href);
  }, 1000);
}
      } catch (error) {
        console.error(
          `Eroare la pasul: ${currentStep}`,
          error
        );

        syncedUserRef.current = null;

        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? `${currentStep}: ${error.message}`
              : "Nu am putut conecta contul la baza de date."
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
  }, [user?.sub, isLoading]);

  // =========================================================
  // LOGIN
  // =========================================================

  const handleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      syncedUserRef.current = null;

      const parameters = {
        scope: AUTH_SCOPE,
        audience: API_AUDIENCE,
      };

      if (Platform.OS === "web") {
        // Auth0 returns to "/" after login; index.tsx uses this flag
        // to send the user back here instead of logging them out.
        markLoginStarted();
        await authorize(parameters);
      } else {
        await authorize(parameters, {
          customScheme: CUSTOM_SCHEME,
        });
      }

    } catch (error) {
      console.error("Login error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Login could not be completed."
      );

      setLoading(false);
    }
  };

  // =========================================================
  // SIGN UP
  // =========================================================

  const handleSignup = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      syncedUserRef.current = null;

      const parameters = {
        scope: AUTH_SCOPE,
        audience: API_AUDIENCE,
        additionalParameters: {
          screen_hint: "signup",
        },
      };

      if (Platform.OS === "web") {
        // Auth0 returns to "/" after login; index.tsx uses this flag
        // to send the user back here instead of logging them out.
        markLoginStarted();
        await authorize(parameters);
      } else {
        await authorize(parameters, {
          customScheme: CUSTOM_SCHEME,
        });
      }

    } catch (error) {
      console.error("Signup error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Account creation could not be completed."
      );

      setLoading(false);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (isLoading || loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#D69BA5"
        />

        <Text style={styles.loadingText}>
          Getting your paws ready...
        </Text>
      </SafeAreaView>
    );
  }

  // =========================================================
  // LOGIN SCREEN
  // =========================================================

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* BACK BUTTON */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>
            ← Back
          </Text>
        </TouchableOpacity>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.logo}>
            PAWS & PAGES
          </Text>

          <Text style={styles.subtitle}>
            Your little corner of reading and learning ♡
          </Text>
        </View>

        {/* MAIN CONTENT */}
        <View style={styles.mainContent}>

          {/* LOGIN BUTTON - LEFT */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.loginButton,
            ]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.buttonIcon}>
              ♡
            </Text>

            <Text style={styles.buttonTitle}>
              Log in
            </Text>

            <Text style={styles.buttonDescription}>
              Welcome back!
            </Text>

            <Text style={styles.buttonArrow}>
              →
            </Text>
          </TouchableOpacity>

          {/* LAICA - CENTER */}
          <View style={styles.mascotContainer}>
            <AnimatedMascot animation="original" />
          </View>

          {/* SIGNUP BUTTON - RIGHT */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.signupButton,
            ]}
            onPress={handleSignup}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.buttonIcon}>
              ✧
            </Text>

            <Text style={styles.buttonTitle}>
              Create an account
            </Text>

            <Text style={styles.buttonDescription}>
              Join our little world!
            </Text>

            <Text style={styles.buttonArrow}>
              →
            </Text>
          </TouchableOpacity>

        </View>

        {/* ERROR */}
        {errorMessage !== "" && (
          <Text style={styles.error}>
            {errorMessage}
          </Text>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerPaw}>
            🐾
          </Text>

          <Text style={styles.footerText}>
            A safe little space for big adventures ♡
          </Text>
        </View>

      </View>
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

  container: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    paddingVertical: 20,
  },

  backButton: {
    position: "absolute",
    top: 20,
    left: 30,
    zIndex: 5,
    padding: 8,
  },

  backText: {
    color: "#806A70",
    fontSize: 14,
    fontWeight: "700",
  },

  header: {
    alignItems: "center",
    marginTop: 12,
  },

  logo: {
    color: "#735E64",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 5,
  },

  subtitle: {
    color: "#A78B9A",
    fontSize: 12,
    marginTop: 8,
  },

  mainContent: {
    width: "100%",
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },

  mascotContainer: {
    width: "36%",
    height: 250,
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "900",
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
    fontWeight: "700",
    marginTop: 15,
  },

  error: {
    color: "#B44B58",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
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
});
