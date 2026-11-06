// mobile/app/(tabs)/transactions.tsx
import { View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@apollo/client/react";
import { DELETE_TRANSACTION, TRANSACTIONS } from "@/lib/graphql";
import type { Transaction } from "@/lib/types";
import { useFilter } from "@/context/FilterContext";
import { formatDate, formatIDR } from "@/lib/format";
import { confirmAsync, notify } from "@/lib/dialogs";
import { FilterBar } from "@/components/FilterBar";
import { Body, Button, Card, Empty, ErrorBox, Loading, Muted, Row, Screen } from "@/components/ui";

export default function Transactions() {
  const { businessId, period } = useFilter();
  const { data, loading, error, refetch } = useQuery<{ transactions: Transaction[] }>(TRANSACTIONS, {
    variables: { businessId, period },
  });
  const [remove] = useMutation(DELETE_TRANSACTION, { refetchQueries: ["Transactions", "Dashboard", "Payroll"] });

  async function onDelete(t: Transaction) {
    if (!(await confirmAsync("Delete sale?", `${t.productName} by ${t.marketerName}`))) return;
    try {
      await remove({ variables: { id: t.id } });
    } catch (e) {
      notify("Can't delete", (e as Error).message);
    }
  }

  const list = data?.transactions ?? [];
  const total = list.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Screen refreshing={loading} onRefresh={() => refetch()}>
      <FilterBar />
      <Row style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <Muted>{list.length} sales · {formatIDR(total)}</Muted>
        <Button small title="+ Add sale" onPress={() => router.push("/transaction-new")} />
      </Row>
      {error && <ErrorBox message={error.message} />}
      {!data && loading && <Loading />}
      {data && list.length === 0 && <Empty text="No sales in this period." />}
      {list.map((t) => (
        <Card key={t.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flexShrink: 1 }}>
              <Body bold>{t.productName}</Body>
              <Muted>{t.marketerName} · {t.businessName}</Muted>
              <Muted>{formatDate(t.soldAt)}{t.note ? ` · ${t.note}` : ""}</Muted>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Body bold>{formatIDR(t.amount)}</Body>
              <Button small variant="ghost" title="Delete" onPress={() => onDelete(t)} />
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}