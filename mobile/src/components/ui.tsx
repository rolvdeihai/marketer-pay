// mobile/src/components/ui.tsx
import type { ReactNode } from "react";
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

export const colors = {
  bg: "#f5f6fa",
  card: "#ffffff",
  text: "#1f2330",
  muted: "#6b7280",
  border: "#e5e7eb",
  primary: "#4f46e5",
  primarySoft: "#eef2ff",
  danger: "#dc2626",
  success: "#16a34a",
  warning: "#d97706",
};

export function Screen({
  children, scroll = true, refreshing = false, onRefresh,
}: { children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void }) {
  if (!scroll) return <View style={[s.screen, s.pad]}><View style={s.max}>{children}</View></View>;
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.pad, { paddingBottom: 48 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      <View style={s.max}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={s.h1}>{children}</Text>;
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const Body = ({ children, bold }: { children: ReactNode; bold?: boolean }) => (
  <Text style={[s.body, bold && { fontWeight: "700" }]}>{children}</Text>
);
export const Muted = ({ children }: { children: ReactNode }) => <Text style={s.muted}>{children}</Text>;

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger" | "success";
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
};

export function Button({ title, onPress, variant = "primary", disabled, loading, small }: ButtonProps) {
  const bg = { primary: colors.primary, ghost: colors.primarySoft, danger: colors.danger, success: colors.success }[variant];
  const fg = variant === "ghost" ? colors.primary : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Input({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={s.input} {...props} />
    </View>
  );
}

export function Select({
  label, value, onChange, options, placeholder = "Select…",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.pickerWrap}>
        <Picker selectedValue={value} onValueChange={(v) => onChange(String(v))}>
          <Picker.Item label={placeholder} value="" />
          {options.map((o) => <Picker.Item key={o.value} label={o.label} value={o.value} />)}
        </Picker>
      </View>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, selected && s.chipOn]}>
      <Text style={[s.chipText, selected && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <Muted>{label}</Muted>
      <Text style={s.statValue}>{value}</Text>
    </Card>
  );
}

export function Badge({ text, tone = "muted" }: { text: string; tone?: "success" | "warning" | "muted" }) {
  const c = { success: colors.success, warning: colors.warning, muted: colors.muted }[tone];
  return <Text style={[s.badge, { color: c, borderColor: c }]}>{text}</Text>;
}

export const ErrorBox = ({ message }: { message: string }) => (
  <Card style={{ borderColor: colors.danger, borderWidth: 1 }}>
    <Text style={{ color: colors.danger }}>{message}</Text>
  </Card>
);

export const Empty = ({ text }: { text: string }) => <Text style={[s.muted, { textAlign: "center", marginVertical: 24 }]}>{text}</Text>;

export const Loading = () => <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 16 },
  max: { width: "100%", maxWidth: 900, alignSelf: "center" },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  h1: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 12 },
  h2: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 16, marginBottom: 8 },
  body: { fontSize: 15, color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 12 },
  btnText: { fontWeight: "700", fontSize: 15 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: colors.text },
  pickerWrap: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "600" },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 4 },
  badge: { fontSize: 12, fontWeight: "700", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
});