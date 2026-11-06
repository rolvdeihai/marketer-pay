// mobile/app/marketers.tsx
import { useState } from "react";
import { Text } from "react-native";
import { useMutation, useQuery } from "@apollo/client/react";
import { CREATE_MARKETER, MARKETERS } from "@/lib/graphql";
import type { Marketer } from "@/lib/types";
import { useFilter } from "@/context/FilterContext";
import { FilterBar } from "@/components/FilterBar";
import { Body, Button, Card, Chip, Empty, H2, Input, Loading, Muted, Row, Screen, colors } from "@/components/ui";

export default function Marketers() {
  const { businessId, businesses } = useFilter();
  const { data, loading } = useQuery<{ marketers: Marketer[] }>(MARKETERS, { variables: { businessId } });
  const [create, { loading: saving }] = useMutation(CREATE_MARKETER, { refetchQueries: ["Marketers", "Payroll", "Dashboard"] });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function add() {
    setError(null);
    try {
      await create({ variables: { input: { name: name.trim(), phone: phone.trim() || null, businesses: picked } } });
      setName("");
      setPhone("");
      setPicked([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <FilterBar showPeriod={false} />
      {!data && loading && <Loading />}
      {data && data.marketers.length === 0 && <Empty text="No marketers for this filter." />}
      {data?.marketers.map((m) => (
        <Card key={m.id}>
          <Body bold>{m.name}</Body>
          <Muted>{m.businesses.map((b) => b.name).join(", ")}{m.phone ? ` · ${m.phone}` : ""}</Muted>
        </Card>
      ))}

      <H2>Add marketer</H2>
      <Card>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Text style={{ fontWeight: "600", color: colors.muted, marginBottom: 6 }}>Sells for</Text>
        <Row style={{ marginBottom: 12 }}>
          {businesses.map((b) => <Chip key={b.id} label={b.name} selected={picked.includes(b.id)} onPress={() => toggle(b.id)} />)}
        </Row>
        {error && <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>}
        <Button title="Add marketer" onPress={add} loading={saving} disabled={!name.trim() || picked.length === 0} />
      </Card>
    </Screen>
  );
}