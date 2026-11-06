// mobile/app/business/[id].tsx
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@apollo/client/react";
import { CREATE_BUSINESS, UPDATE_PAY_RULE } from "@/lib/graphql";
import type { BonusType, PayRule } from "@/lib/types";
import { useFilter } from "@/context/FilterContext";
import { estimatePay, formatIDR } from "@/lib/format";
import { Body, Button, Card, Chip, H2, Input, Muted, Row, Screen, colors } from "@/components/ui";

const num = (s: string) => Number(s.replace(/\D/g, "") || 0);

export default function BusinessEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { businesses } = useFilter();
  const existing = businesses.find((b) => b.id === id);

  const [name, setName] = useState("");
  const [baseSalary, setBaseSalary] = useState("0");
  const [bonusType, setBonusType] = useState<BonusType>("PER_SALE");
  const [salesPerBonus, setSalesPerBonus] = useState("1");
  const [bonusAmount, setBonusAmount] = useState("0");
  const [pctMet, setPctMet] = useState("100");
  const [pctMissed, setPctMissed] = useState("100");
  const [error, setError] = useState<string | null>(null);

  // Load the existing rule into the form once it's available.
  useEffect(() => {
    if (!existing) return;
    const r = existing.rule;
    setName(existing.name);
    setBaseSalary(String(r.baseSalary));
    setBonusType(r.bonusType);
    setSalesPerBonus(String(r.salesPerBonus));
    setBonusAmount(String(r.bonusAmount));
    setPctMet(String(r.bonusPctTargetMet));
    setPctMissed(String(r.bonusPctTargetMissed));
  }, [existing?.id]);

  const rule: PayRule = {
    baseSalary: num(baseSalary),
    bonusType,
    salesPerBonus: Math.max(1, num(salesPerBonus)),
    bonusAmount: num(bonusAmount),
    bonusPctTargetMet: num(pctMet),
    bonusPctTargetMissed: num(pctMissed),
  };

  const refetchQueries = ["Businesses", "Dashboard", "Payroll"];
  const [create, { loading: creating }] = useMutation(CREATE_BUSINESS, { refetchQueries });
  const [update, { loading: updating }] = useMutation(UPDATE_PAY_RULE, { refetchQueries });

  async function save() {
    setError(null);
    try {
      if (isNew) await create({ variables: { input: { name: name.trim(), rule } } });
      else await update({ variables: { businessId: id, input: rule } });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? "New business" : existing?.name ?? "Business" }} />
      <Card>
        {isNew && <Input label="Business name" value={name} onChangeText={setName} />}
        <Input label="Base salary (IDR, paid only if target achieved)" value={baseSalary} onChangeText={setBaseSalary} keyboardType="number-pad" />

        <Text style={{ fontWeight: "600", color: colors.muted, marginBottom: 6 }}>Bonus type</Text>
        <Row style={{ marginBottom: 12 }}>
          <Chip label="Per sale" selected={bonusType === "PER_SALE"} onPress={() => setBonusType("PER_SALE")} />
          <Chip label="Per X sales" selected={bonusType === "PER_X_SALES"} onPress={() => setBonusType("PER_X_SALES")} />
        </Row>
        {bonusType === "PER_X_SALES" && (
          <Input label="Every how many sales?" value={salesPerBonus} onChangeText={setSalesPerBonus} keyboardType="number-pad" />
        )}
        <Input label="Bonus amount (IDR)" value={bonusAmount} onChangeText={setBonusAmount} keyboardType="number-pad" />
        <Input label="Bonus % if target ACHIEVED" value={pctMet} onChangeText={setPctMet} keyboardType="number-pad" />
        <Input label="Bonus % if target NOT achieved" value={pctMissed} onChangeText={setPctMissed} keyboardType="number-pad" />
      </Card>

      <H2>Example: 12 sales</H2>
      <Card>
        <Body>Target achieved → {formatIDR(estimatePay(rule, 12, true))}</Body>
        <Body>Target missed → {formatIDR(estimatePay(rule, 12, false))}</Body>
        <Muted>Estimate only — the server calculates the real payout.</Muted>
      </Card>

      {error && <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>}
      <Button title={isNew ? "Create business" : "Save rule"} onPress={save} loading={creating || updating}
        disabled={isNew && !name.trim()} />
    </Screen>
  );
}