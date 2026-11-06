// mobile/app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ColorValue } from "react-native";
import { colors } from "@/components/ui";

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => (
  <Ionicons name={name} color={color} size={size} />
);

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTitleStyle: { fontWeight: "800" } }}>
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: icon("stats-chart") }} />
      <Tabs.Screen name="transactions" options={{ title: "Sales", tabBarIcon: icon("receipt") }} />
      <Tabs.Screen name="payroll" options={{ title: "Payroll", tabBarIcon: icon("wallet") }} />
      <Tabs.Screen name="history" options={{ title: "History", tabBarIcon: icon("time") }} />
      <Tabs.Screen name="assistant" options={{ title: "AI", tabBarIcon: icon("sparkles") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings") }} />
    </Tabs>
  );
}