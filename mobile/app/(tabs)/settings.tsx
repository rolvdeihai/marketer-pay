// mobile/app/(tabs)/settings.tsx
import { Pressable } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useFilter } from "@/context/FilterContext";
import { ruleSummary } from "@/lib/format";
import { Body, Button, Card, H2, Muted, Row, Screen } from "@/components/ui";

export default function Settings() {
  const { session, signOut } = useAuth();
  const { businesses } = useFilter();

  return (
    <Screen>
      <Row style={{ justifyContent: "space-between" }}>
        <H2>Businesses & pay rules</H2>
        <Button small title="+ Add" onPress={() => router.push("/business/new")} />
      </Row>
      {businesses.map((b) => (
        <Pressable key={b.id} onPress={() => router.push(`/business/${b.id}`)}>
          <Card>
            <Body bold>{b.name}</Body>
            <Muted>{ruleSummary(b.rule)}</Muted>
          </Card>
        </Pressable>
      ))}

      <H2>Manage</H2>
      <Row>
        <Button variant="ghost" title="Marketers" onPress={() => router.push("/marketers")} />
        <Button variant="ghost" title="Products" onPress={() => router.push("/products")} />
      </Row>

      <H2>Account</H2>
      <Card>
        <Muted>Signed in as</Muted>
        <Body bold>{session?.user.email}</Body>
      </Card>
      <Button variant="danger" title="Sign out" onPress={signOut} />
    </Screen>
  );
}