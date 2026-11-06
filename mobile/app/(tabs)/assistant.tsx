// mobile/app/(tabs)/assistant.tsx
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation } from "@apollo/client/react";
import { ASK_ASSISTANT } from "@/lib/graphql";
import type { ChatMessage } from "@/lib/types";
import { useFilter } from "@/context/FilterContext";
import { FilterBar } from "@/components/FilterBar";
import { HtmlView } from "@/components/HtmlView";
import { Button, Chip, Muted, colors } from "@/components/ui";

const SUGGESTIONS = [
  "What's the sales trend over the last 3 months?",
  "Which marketers are performing best? Show a chart.",
  "Compare revenue per business this month.",
  "How much have we paid in bonuses so far?",
];

export default function Assistant() {
  const { businessId, businesses } = useFilter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const [ask, { loading }] = useMutation<{ askAssistant: { text: string; html: string | null } }>(ASK_ASSISTANT);
  const scopeName = businesses.find((b) => b.id === businessId)?.name ?? "all businesses";

  async function send(question?: string) {
    const content = (question ?? text).trim();
    if (!content || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setText("");
    try {
      const { data } = await ask({
        variables: {
          input: { businessId, messages: next.map(({ role, content }) => ({ role, content })) }, // html not sent back
        },
      });
      const reply = data!.askAssistant;
      setMessages((m) => [...m, { role: "assistant", content: reply.text, html: reply.html }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View style={{ width: "100%", maxWidth: 900, alignSelf: "center" }}>
          <FilterBar showPeriod={false} />
          <Muted>Asking about: {scopeName}</Muted>
          {messages.length === 0 && (
            <View style={{ gap: 8, marginTop: 12 }}>
              {SUGGESTIONS.map((s) => <Chip key={s} label={s} onPress={() => send(s)} />)}
            </View>
          )}
          {messages.map((m, i) => (
            <View key={i} style={[st.bubble, m.role === "user" ? st.user : st.bot]}>
              <Text style={{ color: m.role === "user" ? "#fff" : colors.text, fontSize: 15, lineHeight: 21 }}>{m.content}</Text>
              {m.html ? <View style={{ marginTop: 10 }}><HtmlView html={m.html} /></View> : null}
            </View>
          ))}
          {loading && <Muted>Thinking…</Muted>}
        </View>
      </ScrollView>
      <View style={st.inputBar}>
        <TextInput style={st.input} value={text} onChangeText={setText} placeholder="Ask about your sales…"
          placeholderTextColor={colors.muted} onSubmitEditing={() => send()} />
        <Button title="Send" onPress={() => send()} loading={loading} disabled={!text.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  bubble: { borderRadius: 14, padding: 12, marginTop: 10, maxWidth: "100%" },
  user: { backgroundColor: colors.primary, alignSelf: "flex-end", maxWidth: "85%" },
  bot: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, alignSelf: "stretch" },
  inputBar: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, color: colors.text },
});