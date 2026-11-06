// mobile/src/components/FilterBar.tsx
import { ScrollView, Text, View } from "react-native";
import { useFilter } from "@/context/FilterContext";
import { formatPeriod, shiftPeriod } from "@/lib/format";
import { Button, Chip, colors } from "./ui";

export function FilterBar({ showPeriod = true }: { showPeriod?: boolean }) {
  const { businesses, businessId, setBusinessId, period, setPeriod } = useFilter();
  return (
    <View style={{ gap: 10, marginBottom: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="All businesses" selected={!businessId} onPress={() => setBusinessId(null)} />
        {businesses.map((b) => (
          <Chip key={b.id} label={b.name} selected={businessId === b.id} onPress={() => setBusinessId(b.id)} />
        ))}
      </ScrollView>
      {showPeriod && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Button small variant="ghost" title="‹" onPress={() => setPeriod(shiftPeriod(period, -1))} />
          <Text style={{ fontWeight: "700", color: colors.text, minWidth: 130, textAlign: "center" }}>{formatPeriod(period)}</Text>
          <Button small variant="ghost" title="›" onPress={() => setPeriod(shiftPeriod(period, 1))} />
        </View>
      )}
    </View>
  );
}