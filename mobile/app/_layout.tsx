// mobile/app/_layout.tsx
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ApolloProvider } from "@apollo/client/react";
import { apolloClient } from "@/lib/apollo";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { FilterProvider } from "@/context/FilterContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ApolloProvider client={apolloClient}>
        <AuthProvider>
          <FilterProvider>
            <StatusBar style="dark" />
            <RootStack />
          </FilterProvider>
        </AuthProvider>
      </ApolloProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  // Stack.Protected: screens are only reachable while `guard` is true.
  // Logging in/out automatically redirects to the first allowed screen.
  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction-new" options={{ presentation: "modal", title: "Add sale" }} />
        <Stack.Screen name="business/[id]" options={{ title: "Business" }} />
        <Stack.Screen name="marketers" options={{ title: "Marketers" }} />
        <Stack.Screen name="products" options={{ title: "Products" }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}