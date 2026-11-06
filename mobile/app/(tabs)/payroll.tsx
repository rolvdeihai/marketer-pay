// mobile/app/(tabs)/payroll.tsx
import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@apollo/client/react";
import { PAYROLL } from "@/lib/graphql";
import type { MarketerStat } from "@/lib/types";
import { useFilter } from "@/context/FilterContext";
import { formatDate, formatIDR } from "@/lib/format";
import { FilterBar } from "@/components/FilterBar";
import { PayDialog } from "@/components/PayDialog";
import { Body, Button, Card, Chip, Empty, ErrorBox, Loading, Muted, Row, Screen } from "@/components/ui";

export default function Payroll() {
  const { businessId, period } = useFilter();
  const [tab, setTab] = useState<"unpaid" | "paid">("unpaid");
  const [selected, setSelected] = useState<MarketerStat | null>(null);
  const { data, loading, error, refetch } = useQuery<{ payroll: MarketerStat[] }>(PAYROLL, {
    variables: { businessId, period },
  });

  const all = data?.payroll ?? [];
  const rows = all.filter((r) => (tab === "paid" ? r.isPaid : !r.isPaid));
  const unpaidCount = all.filter((r) => !r.isPaid).length;

  return (
    <Screen refreshing={loading} onRefresh={() => refetch()}>
      <FilterBar />
      <Row style={{ marginBottom: 10 }}>
        <Chip label={`Unpaid (${unpaidCount})`} selected={tab === "unpaid"} onPress={() => setTab("unpaid")} />
        <Chip label={`Paid (${all.length - unpaidCount})`} selected={tab === "paid"} onPress={() => setTab("paid")} />
      </Row>
      {error && <ErrorBox message={error.message} />}
      {!data && loading && <Loading />}
      {data && rows.length === 0 && <Empty text={tab === "unpaid" ? "Everyone is paid 🎉" : "Nobody paid yet for this month."} />}
      {rows.map((r) => (
        <Card key={`${r.marketerId}-${r.businessId}`}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flexShrink: 1 }}>
              <Body bold>{r.marketerName}</Body>
              <Muted>{r.businessName}</Muted>
              <Muted>{r.salesCount} sales · {formatIDR(r.revenue)} revenue</Muted>
            </View>
            {r.isPaid ? (
              <View style={{ alignItems: "flex-end" }}>
                <Body bold>{formatIDR(r.paidTotal)}</Body>
                <Muted>paid {r.paidAt ? formatDate(r.paidAt) : ""}</Muted>
              </View>
            ) : (
              <Button title="Pay" variant="success" onPress={() => setSelected(r)} />
            )}
          </Row>
        </Card>
      ))}
      <PayDialog row={selected} period={period} onClose={() => setSelected(null)} onPaid={() => setSelected(null)} />
    </Screen>
  );
}