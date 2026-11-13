import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth0 } from "react-native-auth0";

const CUSTOM_SCHEME = "pawsandpages";

export default function LoginScreen() {
  const { authorize, user, isLoading, error } = useAuth0();

  useEffect(() => {
    console.log("AUTH0 DEBUG:", {
      isLoading,
      user,
      error: error?.message,
    });
  }, [isLoading, user, error]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (user) {
      router.replace("/home");
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      if (Platform.OS === "web") {
        await authorize({
          scope: "openid profile email",
        });
      } else {
        await authorize(
          {
            scope: "openid profile email",
          },
          {
            customScheme: CUSTOM_SCHEME,
          },
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage("Login could not be completed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const parameters = {
        scope: "openid profile email",
        additionalParameters: {
          screen_hint: "signup",
        },
      };

      if (Platform.OS === "web") {
        await authorize(parameters);
      } else {
        await authorize(parameters, {
          customScheme: CUSTOM_SCHEME,
        });
      }
    } catch (error) {
      console.error("Signup error:", error);
      setErrorMessage(
        "Account creation could not be completed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#B77D88" />
        <Text style={styles.loadingText}>Getting your paws ready...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.mascotContainer}>
          <Text style={styles.mascot}>🐶</Text>
          <Text style={styles.paw}>🐾</Text>
        </View>

        <Text style={styles.logo}>PAWS & PAGES</Text>

        <Text style={styles.title}>Your little corner awaits.</Text>

        <Text style={styles.subtitle}>
          Sign in to keep your reading adventures, study sessions and friends
          close.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back! ♡</Text>

          <Text style={styles.cardDescription}>
            Ready to learn, read and grow with Laica?
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.loginButtonText}>Log in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signupButton}
            onPress={handleSignup}
            activeOpacity={0.85}
          >
            <Text style={styles.signupButtonText}>Create an account</Text>
          </TouchableOpacity>

          {errorMessage !== "" && (
            <Text style={styles.error}>{errorMessage}</Text>
          )}
        </View>

        <Text style={styles.footer}>
          A safe little space for big adventures ♡
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFF8F1",
  },
  container: {
    flexGrow: 1,
    padding: 25,
    justifyContent: "center",
  },
  backButton: {
    position: "absolute",
    top: 15,
    left: 25,
    zIndex: 1,
  },
  backText: {
    color: "#9B8588",
    fontSize: 14,
  },
  mascotContainer: {
    alignItems: "center",
    marginTop: 45,
    marginBottom: 12,
  },
  mascot: {
    fontSize: 95,
  },
  paw: {
    fontSize: 25,
    marginTop: -12,
    marginLeft: 90,
  },
  logo: {
    color: "#806A70",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
    marginTop: 10,
  },
  title: {
    color: "#59484C",
    fontSize: 29,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 22,
  },
  subtitle: {
    color: "#9B8588",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 23,
    shadowColor: "#806A70",
    shadowOpacity: 0.07,
    shadowRadius: 15,
    elevation: 3,
  },
  cardTitle: {
    color: "#59484C",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  cardDescription: {
    color: "#9B8588",
    fontSize: 12,
    textAlign: "center",
    marginTop: 9,
    marginBottom: 25,
  },
  loginButton: {
    backgroundColor: "#DDA6AD",
    padding: 18,
    borderRadius: 17,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  signupButton: {
    backgroundColor: "#F4E8ED",
    padding: 18,
    borderRadius: 17,
    marginTop: 12,
  },
  signupButtonText: {
    color: "#9B6874",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  error: {
    color: "#B44B58",
    fontSize: 12,
    textAlign: "center",
    marginTop: 15,
  },
  footer: {
    color: "#B7A5A7",
    fontSize: 11,
    textAlign: "center",
    marginTop: 30,
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#FFF8F1",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#9B8588",
    marginTop: 15,
    fontSize: 13,
  },
});
