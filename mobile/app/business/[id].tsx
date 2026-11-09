import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@apollo/client/react";
import { CREATE_BUSINESS, REMOVE_BUSINESS, UPDATE_PAY_RULE } from "@/lib/graphql";
import type { BonusRule, BonusType, PayRule } from "@/lib/types";
import { useFilter } from "@/context/FilterContext";
import { confirmRemove } from "@/lib/dialogs";
import { estimatePay, formatIDR } from "@/lib/format";
import { Body, Button, Card, Chip, H2, Input, Muted, Row, Screen, colors } from "@/components/ui";

const num = (s: string) => Number(s.replace(/\D/g, "") || 0);

/** Form state for one bonus (strings, because they come from text inputs). */
type BonusForm = { bonusType: BonusType; salesPerBonus: string; bonusAmount: string; bonusPct: string };

const emptyBonus: BonusForm = { bonusType: "PER_SALE", salesPerBonus: "1", bonusAmount: "0", bonusPct: "100" };

const toForm = (b: BonusRule): BonusForm => ({
  bonusType: b.bonusType,
  salesPerBonus: String(b.salesPerBonus),
  bonusAmount: String(b.bonusAmount),
  bonusPct: String(b.bonusPct),
});

const fromForm = (f: BonusForm): BonusRule => ({
  bonusType: f.bonusType,
  salesPerBonus: Math.max(1, num(f.salesPerBonus)),
  bonusAmount: num(f.bonusAmount),
  bonusPct: num(f.bonusPct),
});

function BonusEditor({ title, value, onChange }: { title: string; value: BonusForm; onChange: (f: BonusForm) => void }) {
  const set = (patch: Partial<BonusForm>) => onChange({ ...value, ...patch });
  return (
    <Card>
      <Body bold>{title}</Body>
      <Text style={{ fontWeight: "600", color: colors.muted, marginTop: 8, marginBottom: 6 }}>Bonus type</Text>
      <Row style={{ marginBottom: 12 }}>
        <Chip label="Per sale" selected={value.bonusType === "PER_SALE"} onPress={() => set({ bonusType: "PER_SALE" })} />
        <Chip label="Per X sales" selected={value.bonusType === "PER_X_SALES"} onPress={() => set({ bonusType: "PER_X_SALES" })} />
      </Row>
      {value.bonusType === "PER_X_SALES" && (
        <Input label="Every how many sales?" value={value.salesPerBonus} onChangeText={(t) => set({ salesPerBonus: t })} keyboardType="number-pad" />
      )}
      <Input label="Bonus amount (IDR)" value={value.bonusAmount} onChangeText={(t) => set({ bonusAmount: t })} keyboardType="number-pad" />
      <Input label="% of bonus amount paid" value={value.bonusPct} onChangeText={(t) => set({ bonusPct: t })} keyboardType="number-pad" />
    </Card>
  );
}

export default function BusinessEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { businesses } = useFilter();
  const existing = businesses.find((b) => b.id === id);

  const [name, setName] = useState("");
  const [baseSalary, setBaseSalary] = useState("0");
  const [met, setMet] = useState<BonusForm>(emptyBonus);
  const [missed, setMissed] = useState<BonusForm>(emptyBonus);
  const [error, setError] = useState<string | null>(null);

  // Load the existing rule into the form once it's available.
  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setBaseSalary(String(existing.rule.baseSalary));
    setMet(toForm(existing.rule.targetMet));
    setMissed(toForm(existing.rule.targetMissed));
  }, [existing?.id]);

  const rule: PayRule = { baseSalary: num(baseSalary), targetMet: fromForm(met), targetMissed: fromForm(missed) };

  const refetchQueries = ["Businesses", "Dashboard", "Payroll"];
  const [create, { loading: creating }] = useMutation(CREATE_BUSINESS, { refetchQueries });
  const [update, { loading: updating }] = useMutation(UPDATE_PAY_RULE, { refetchQueries });
  const [remove, { loading: removing }] = useMutation(REMOVE_BUSINESS, {
    refetchQueries: [...refetchQueries, "Marketers", "Products", "Transactions"],
  });

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

  async function onRemove() {
    if (await confirmRemove(existing?.name ?? "this business", () => remove({ variables: { id } }))) router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? "New business" : existing?.name ?? "Business" }} />
      <Card>
        {isNew && <Input label="Business name" value={name} onChangeText={setName} />}
        <Input label="Base salary (IDR, paid only if target achieved)" value={baseSalary} onChangeText={setBaseSalary} keyboardType="number-pad" />
      </Card>

      <BonusEditor title="Bonus if target ACHIEVED" value={met} onChange={setMet} />
      <BonusEditor title="Bonus if target NOT achieved" value={missed} onChange={setMissed} />

      <H2>Example: 12 sales</H2>
      <Card>
        <Body>Target achieved → {formatIDR(estimatePay(rule, 12, true))}</Body>
        <Body>Target missed → {formatIDR(estimatePay(rule, 12, false))}</Body>
        <Muted>Estimate only — the server calculates the real payout.</Muted>
      </Card>

      {error && <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>}
      <Button title={isNew ? "Create business" : "Save rule"} onPress={save} loading={creating || updating}
        disabled={isNew && !name.trim()} />
      {!isNew && existing && (
        <>
          <Text> </Text>
          <Button variant="danger" title="Remove business" onPress={onRemove} loading={removing} />
        </>
      )}
    </Screen>
  );
}
