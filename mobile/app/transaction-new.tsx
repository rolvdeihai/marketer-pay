// mobile/app/transaction-new.tsx
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@apollo/client/react";
import { CREATE_TRANSACTION, MARKETERS, PRODUCTS } from "@/lib/graphql";
import type { Marketer, Product } from "@/lib/types";
import { useFilter } from "@/context/FilterContext";
import { formatIDR, todayJakarta } from "@/lib/format";
import { Button, Card, Empty, Input, Muted, Screen, Select, colors } from "@/components/ui";

export default function NewTransaction() {
  const { businesses, businessId: filterBusiness } = useFilter();
  const [businessId, setBusinessId] = useState(filterBusiness ?? businesses[0]?.id ?? "");
  const [marketerId, setMarketerId] = useState("");
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayJakarta());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: mData } = useQuery<{ marketers: Marketer[] }>(MARKETERS, { variables: { businessId }, skip: !businessId });
  const { data: pData } = useQuery<{ products: Product[] }>(PRODUCTS, { variables: { businessId }, skip: !businessId });
  const [create, { loading }] = useMutation(CREATE_TRANSACTION, {
    refetchQueries: ["Transactions", "Dashboard", "Payroll"],
  });

  // Changing business resets the dependent fields.
  useEffect(() => {
    setMarketerId("");
    setProductId("");
    setAmount("");
  }, [businessId]);

  // Picking a product pre-fills its price.
  useEffect(() => {
    const p = pData?.products.find((x) => x.id === productId);
    if (p) setAmount(String(p.price));
  }, [productId, pData]);

  async function submit() {
    setError(null);
    if (!businessId || !marketerId || !productId) return setError("Pick a business, marketer and product.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Date must be YYYY-MM-DD.");
    try {
      await create({
        variables: {
          input: {
            businessId,
            marketerId,
            productId,
            amount: amount ? Number(amount) : null,
            soldAt: new Date(`${date}T12:00:00+07:00`).toISOString(), // midday Jakarta: safely inside that day
            note: note.trim() || null,
          },
        },
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (businesses.length === 0) return <Screen><Empty text="Create a business first (Settings)." /></Screen>;

  return (
    <Screen>
      <Card>
        <Select label="Business" value={businessId} onChange={setBusinessId}
          options={businesses.map((b) => ({ label: b.name, value: b.id }))} />
        <Select label="Marketer" value={marketerId} onChange={setMarketerId}
          options={(mData?.marketers ?? []).map((m) => ({ label: m.name, value: m.id }))} />
        <Select label="Product" value={productId} onChange={setProductId}
          options={(pData?.products ?? []).map((p) => ({ label: `${p.name} (${formatIDR(p.price)})`, value: p.id }))} />
        <Input label="Amount (IDR)" value={amount} onChangeText={(t) => setAmount(t.replace(/\D/g, ""))} keyboardType="number-pad" />
        <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
        <Input label="Note (optional)" value={note} onChangeText={setNote} />
        <Muted>Sales in a month that's already paid for this marketer are blocked.</Muted>
        {error && <Text style={{ color: colors.danger, marginTop: 8 }}>{error}</Text>}
        <Button title="Save sale" onPress={submit} loading={loading} />
      </Card>
    </Screen>
  );
}