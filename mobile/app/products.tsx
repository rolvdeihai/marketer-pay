// mobile/app/products.tsx
import { useState } from "react";
import { Text } from "react-native";
import { useMutation, useQuery } from "@apollo/client/react";
import { CREATE_PRODUCT, PRODUCTS } from "@/lib/graphql";
import type { Product } from "@/lib/types";
import { useFilter } from "@/context/FilterContext";
import { formatIDR } from "@/lib/format";
import { FilterBar } from "@/components/FilterBar";
import { Body, Button, Card, Empty, H2, Input, Loading, Muted, Row, Screen, Select, colors } from "@/components/ui";

export default function Products() {
  const { businessId, businesses } = useFilter();
  const { data, loading } = useQuery<{ products: Product[] }>(PRODUCTS, { variables: { businessId } });
  const [create, { loading: saving }] = useMutation(CREATE_PRODUCT, { refetchQueries: ["Products"] });

  const [forBusiness, setForBusiness] = useState(businessId ?? "");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    try {
      await create({ variables: { input: { businessId: forBusiness, name: name.trim(), price: Number(price || 0) } } });
      setName("");
      setPrice("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <FilterBar showPeriod={false} />
      {!data && loading && <Loading />}
      {data && data.products.length === 0 && <Empty text="No products for this filter." />}
      {data?.products.map((p) => (
        <Card key={p.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <Body bold>{p.name}</Body>
            <Body>{formatIDR(p.price)}</Body>
          </Row>
          <Muted>{p.businessName}</Muted>
        </Card>
      ))}

      <H2>Add product</H2>
      <Card>
        <Select label="Business" value={forBusiness} onChange={setForBusiness}
          options={businesses.map((b) => ({ label: b.name, value: b.id }))} />
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Price (IDR)" value={price} onChangeText={(t) => setPrice(t.replace(/\D/g, ""))} keyboardType="number-pad" />
        {error && <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>}
        <Button title="Add product" onPress={add} loading={saving} disabled={!forBusiness || !name.trim()} />
      </Card>
    </Screen>
  );
}