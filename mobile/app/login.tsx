// mobile/app/login.tsx
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, H1, Input, Muted, colors } from "@/components/ui";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(await signIn(email, password));
    setLoading(false);
    // On success, onAuthStateChange updates the session and Stack.Protected shows the tabs.
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: colors.bg }}>
      <View style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}>
        <H1>Marketer Pay</H1>
        <Muted>Sign in with the account created in Supabase.</Muted>
        <Card style={{ marginTop: 16 }}>
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} />
          {error && <Text style={{ color: colors.danger, marginBottom: 10 }}>{error}</Text>}
          <Button title="Sign in" onPress={submit} loading={loading} disabled={!email || !password} />
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}