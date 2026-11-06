// mobile/app/(tabs)/index.tsx
import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@apollo/client/react";
import { DASHBOARD } from "@/lib/graphql";
import type { DashboardStats } from "@/lib/types";
import { useFilter } from "@/context/FilterContext";
import { formatIDR } from "@/lib/format";
import { FilterBar } from "@/components/FilterBar";
import { Badge, Body, Button, Card, Empty, ErrorBox, H2, Loading, Muted, Row, Screen, Stat } from "@/components/ui";

export default function Dashboard() {
  const { businessId, period } = useFilter();
  const { data, loading, error, refetch } = useQuery<{ dashboard: DashboardStats }>(DASHBOARD, {
    variables: { businessId, period },
  });
  const d = data?.dashboard;

  return (
    <Screen refreshing={loading} onRefresh={() => refetch()}>
      <FilterBar />
      {error && <ErrorBox message={error.message} />}
      {!d && loading && <Loading />}
      {d && (
        <>
          <Row style={{ alignItems: "stretch" }}>
            <Stat label="Sales" value={String(d.totalSales)} />
            <Stat label="Revenue" value={formatIDR(d.totalRevenue)} />
            <Stat label="Unpaid marketers" value={String(d.unpaidCount)} />
          </Row>
          <View style={{ marginVertical: 8 }}>
            <Button title="+ Add sale" onPress={() => router.push("/transaction-new")} />
          </View>
          <H2>Top marketers</H2>
          {d.topMarketers.length === 0 && <Empty text="No marketers yet." />}
          {d.topMarketers.map((m) => (
            <Card key={`${m.marketerId}-${m.businessId}`}>
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flexShrink: 1 }}>
                  <Body bold>{m.marketerName}</Body>
                  <Muted>{m.businessName}</Muted>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Body bold>{m.salesCount} sales</Body>
                  <Muted>{formatIDR(m.revenue)}</Muted>
                </View>
              </Row>
              <View style={{ marginTop: 6, flexDirection: "row" }}>
                <Badge text={m.isPaid ? "Paid" : "Unpaid"} tone={m.isPaid ? "success" : "warning"} />
              </View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}