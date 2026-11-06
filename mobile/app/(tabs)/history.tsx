// mobile/app/(tabs)/history.tsx
import { View } from "react-native";
import { useQuery } from "@apollo/client/react";
import { PAYOUTS } from "@/lib/graphql";
import type { Payout } from "@/lib/types";
import { useFilter } from "@/context/FilterContext";
import { formatDate, formatIDR, formatPeriod } from "@/lib/format";
import { FilterBar } from "@/components/FilterBar";
import { Badge, Body, Card, Empty, ErrorBox, Loading, Muted, Row, Screen } from "@/components/ui";

export default function History() {
  const { businessId } = useFilter();
  const { data, loading, error, refetch } = useQuery<{ payouts: Payout[] }>(PAYOUTS, { variables: { businessId } });
  const list = data?.payouts ?? [];
  const total = list.reduce((s, p) => s + p.total, 0);

  return (
    <Screen refreshing={loading} onRefresh={() => refetch()}>
      <FilterBar showPeriod={false} />
      <Muted>{list.length} payouts · {formatIDR(total)} total</Muted>
      {error && <ErrorBox message={error.message} />}
      {!data && loading && <Loading />}
      {data && list.length === 0 && <Empty text="No payouts yet." />}
      {list.map((p) => (
        <Card key={p.id} style={{ marginTop: 10 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flexShrink: 1 }}>
              <Body bold>{p.marketerName}</Body>
              <Muted>{p.businessName} · {formatPeriod(p.period)}</Muted>
            </View>
            <Body bold>{formatIDR(p.total)}</Body>
          </Row>
          <Row style={{ marginTop: 6 }}>
            <Badge text={p.targetAchieved ? "Target met" : "Target missed"} tone={p.targetAchieved ? "success" : "warning"} />
            <Muted>{p.salesCount} sales</Muted>
          </Row>
          <Muted>
            Salary {formatIDR(p.baseSalary)} + bonus {formatIDR(p.bonusRaw)} × {p.bonusPct}% = {formatIDR(p.bonusFinal)}
          </Muted>
          <Muted>Paid {formatDate(p.paidAt)}{p.paidBy ? ` by ${p.paidBy}` : ""}</Muted>
        </Card>
      ))}
    </Screen>
  );
}