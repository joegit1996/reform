import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../../lib/supabase";
import { theme } from "../../theme/theme";

WebBrowser.maybeCompleteAuthSession();

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "sign-up") {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      const message = (err as Error).message || "Authentication failed.";
      if (/email rate limit exceeded/i.test(message)) {
        setError("Too many signup attempts right now. Please wait a few minutes, then try again or use Google sign-in.");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      const redirectTo = Linking.createURL("auth/callback");
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true
        }
      });
      if (oauthError) throw oauthError;
      if (!data?.url) throw new Error("Google auth URL not received.");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success" || !result.url) {
        if (result.type === "cancel" || result.type === "dismiss") return;
        throw new Error("Google sign-in did not complete.");
      }

      const parsed = Linking.parse(result.url);
      const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeErr) throw exchangeErr;
        return;
      }

      const hashPart = result.url.includes("#") ? result.url.split("#")[1] : "";
      const hashParams = new URLSearchParams(hashPart);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (!accessToken || !refreshToken) {
        throw new Error("Could not read Google auth tokens from callback.");
      }
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (sessionErr) throw sessionErr;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + theme.spacing.md, paddingBottom: Math.max(insets.bottom, theme.spacing.md) }]}>
      <Text style={styles.title}>Reform</Text>
      <Text style={styles.subtitle}>Sign in to sync your plan progress.</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.button} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator /> : <Text style={styles.buttonText}>{mode === "sign-up" ? "Create Account" : "Sign In"}</Text>}
        </Pressable>
        <Pressable style={styles.googleButton} onPress={() => void signInWithGoogle()} disabled={googleLoading}>
          {googleLoading ? (
            <ActivityIndicator color="#1F1F1F" />
          ) : (
            <View style={styles.googleButtonContent}>
              <FontAwesome5 name="google" size={16} color="#DB4437" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => setMode((m) => (m === "sign-up" ? "sign-in" : "sign-up"))}>
          <Text style={styles.switchText}>
            {mode === "sign-up" ? "Already have an account? Sign in" : "New here? Create an account"}
          </Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    padding: theme.spacing.md
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title1,
    fontWeight: "800"
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm
  },
  input: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12
  },
  button: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    alignItems: "center",
    paddingVertical: 12
  },
  buttonText: {
    color: "#2B1700",
    fontWeight: "700"
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DADCE0",
    borderWidth: 1,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14
  },
  googleButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  googleButtonText: {
    color: "#1F1F1F",
    fontWeight: "700"
  },
  switchText: {
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: theme.spacing.xs
  },
  error: {
    color: "#FF7F7F",
    marginTop: theme.spacing.xs
  }
});
