import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../../theme/theme";
import { supabase } from "../../lib/supabase";
import { useCurrentFocus } from "../focus/useCurrentFocus";
import { buildChatPayload } from "../focus/focusScope";

type Message = { id: string; role: "user" | "assistant"; text: string };

export function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { currentFocus, currentFocusId } = useCurrentFocus();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      text: "Ask me anything about your selected focus plan, nutrition, gear, or recovery."
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [typingFrame, setTypingFrame] = useState(0);
  const [focusError, setFocusError] = useState<string | null>(null);
  const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  useEffect(() => {
    setFocusError(currentFocusId ? null : "No focus selected. Open Profile to select a focus.");
  }, [currentFocusId]);

  useEffect(() => {
    if (!loading) {
      setTypingFrame(0);
      return;
    }
    const timer = setInterval(() => {
      setTypingFrame((prev) => (prev + 1) % 6);
    }, 180);
    return () => clearInterval(timer);
  }, [loading]);

  async function send() {
    if (!input.trim() || loading) return;
    if (!currentFocusId) {
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "assistant", text: "Select a focus from Profile before chatting." }
      ]);
      return;
    }
    const message = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { id: makeId(), role: "user", text: message }]);
    setLoading(true);
    try {
      const {
        data: { session: initialSession }
      } = await supabase.auth.getSession();
      let session = initialSession;
      if (!session || (session.expires_at ?? 0) * 1000 < Date.now() + 30_000) {
        const { data, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) throw refreshErr;
        session = data.session;
      }
      if (!session?.access_token) {
        throw new Error("No active session. Please sign in again.");
      }
      const {
        data: { user },
        error: userErr
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        await supabase.auth.signOut();
        throw new Error("Session expired. Please sign in again from Profile.");
      }

      const { data, error } = await supabase.functions.invoke("chat", {
        body: buildChatPayload(message, currentFocusId),
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      if (error) {
        throw new Error(error.message || "Chat failed.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          text: (data as { reply?: string } | null)?.reply ?? "No response received."
        }
      ]);
    } catch (err) {
      const errorMessage = (err as Error).message || "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          text: `Chat error: ${errorMessage}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {focusError ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{focusError}</Text>
        </View>
      ) : null}
      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        <Text style={styles.focusPill}>Focus: {currentFocus?.name ?? "Unselected"}</Text>
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubble, m.role === "user" ? styles.user : styles.assistant]}>
            <Text style={styles.bubbleText}>{m.text}</Text>
          </View>
        ))}
        {loading ? (
          <View style={[styles.bubble, styles.assistant]}>
            <View style={styles.morphRow}>
              {[0, 1, 2].map((idx) => {
                const phase = (typingFrame + idx * 2) % 6;
                const isSmall = phase === 0 || phase === 3;
                const isSquare = phase === 1 || phase === 4;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.morphIcon,
                      isSmall ? styles.morphSmall : styles.morphLarge,
                      isSquare ? styles.morphSquare : styles.morphCircle
                    ]}
                  />
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, theme.spacing.md) }]}>
        <TextInput
          placeholder="Ask about your training..."
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          value={input}
          onChangeText={setInput}
        />
        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={send}>
          <Text style={styles.buttonText}>{loading ? "..." : "Send"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  messages: { flex: 1 },
  notice: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceElevated
  },
  noticeText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption
  },
  messagesContent: { padding: theme.spacing.md, gap: theme.spacing.sm, paddingTop: theme.spacing.xl },
  focusPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700"
  },
  bubble: {
    maxWidth: "90%",
    padding: theme.spacing.md,
    borderRadius: theme.radius.md
  },
  assistant: { alignSelf: "flex-start", backgroundColor: theme.colors.surfaceElevated },
  user: { alignSelf: "flex-end", backgroundColor: "#3A2510" },
  bubbleText: { color: theme.colors.textPrimary },
  morphRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 16
  },
  morphIcon: {
    backgroundColor: theme.colors.accent
  },
  morphSmall: {
    width: 8,
    height: 8
  },
  morphLarge: {
    width: 12,
    height: 12
  },
  morphSquare: {
    borderRadius: 3
  },
  morphCircle: {
    borderRadius: 999
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    color: theme.colors.textPrimary,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12
  },
  button: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: "#1D1200",
    fontWeight: "700"
  }
});
