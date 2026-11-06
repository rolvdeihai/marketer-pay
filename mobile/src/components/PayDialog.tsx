// mobile/src/components/PayDialog.tsx
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useApolloClient, useMutation } from "@apollo/client/react";
import { PAY_MARKETER, PAYOUT_PREVIEW } from "@/lib/graphql";
import type { MarketerStat, PayoutPreview } from "@/lib/types";
import { formatIDR, formatPeriod } from "@/lib/format";
import { Body, Button, Muted, Row, colors } from "./ui";

type Props = { row: MarketerStat | null; period: string; onClose: () => void; onPaid: () => void };

/**
 * Step 1: "Did they achieve their target?"  (Yes / No)
 * Step 2: server-calculated breakdown        (Confirm payment)
 */
export function PayDialog({ row, period, onClose, onPaid }: Props) {
  const client = useApolloClient();
  const [preview, setPreview] = useState<PayoutPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pay, { loading: paying }] = useMutation(PAY_MARKETER, {
    refetchQueries: ["Payroll", "Payouts", "Dashboard"],
  });

  useEffect(() => {
    setPreview(null);
    setError(null);
  }, [row]);

  if (!row) return null;

  const input = (targetAchieved: boolean) => ({
    marketerId: row.marketerId,
    businessId: row.businessId,
    period,
    targetAchieved,
  });

  async function choose(targetAchieved: boolean) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.query<{ payoutPreview: PayoutPreview }>({
        query: PAYOUT_PREVIEW,
        variables: { input: input(targetAchieved) },
        fetchPolicy: "network-only", // always recalculate
      });
      setPreview(data!.payoutPreview);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    try {
      await pay({ variables: { input: input(preview.targetAchieved) } });
      onPaid();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <Text style={st.title}>Pay {row.marketerName}</Text>
          <Muted>{row.businessName} · {formatPeriod(period)} · {row.salesCount} sales</Muted>

          {!preview ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Body bold>Did {row.marketerName} achieve their target this month?</Body>
              <Row>
                <View style={{ flex: 1 }}><Button title="Yes, achieved" variant="success" loading={loading} onPress={() => choose(true)} /></View>
                <View style={{ flex: 1 }}><Button title="No, missed" variant="danger" loading={loading} onPress={() => choose(false)} /></View>
              </Row>
            </View>
          ) : (
            <View style={{ marginTop: 16, gap: 6 }}>
              <Muted>{preview.ruleSummary}</Muted>
              <Line label="Target" value={preview.targetAchieved ? "Achieved ✅" : "Not achieved ❌"} />
              <Line label="Sales" value={String(preview.salesCount)} />
              <Line label="Base salary" value={formatIDR(preview.baseSalary)} />
              <Line label="Bonus (before %)" value={formatIDR(preview.bonusRaw)} />
              <Line label={`Bonus × ${preview.bonusPct}%`} value={formatIDR(preview.bonusFinal)} />
              <View style={st.divider} />
              <Line label="Total to pay" value={formatIDR(preview.total)} strong />
              {preview.alreadyPaid && <Text style={{ color: colors.danger }}>Already paid for this period.</Text>}
              <Row style={{ marginTop: 12 }}>
                <View style={{ flex: 1 }}><Button title="Back" variant="ghost" onPress={() => setPreview(null)} /></View>
                <View style={{ flex: 1 }}>
                  <Button title="Confirm payment" loading={paying} disabled={preview.alreadyPaid} onPress={confirm} />
                </View>
              </Row>
            </View>
          )}

          {error && <Text style={{ color: colors.danger, marginTop: 10 }}>{error}</Text>}
          <View style={{ marginTop: 12 }}><Button title="Cancel" variant="ghost" small onPress={onClose} /></View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: colors.muted, fontWeight: strong ? "800" : "400" }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: strong ? "800" : "600" }}>{value}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 460, alignSelf: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
});