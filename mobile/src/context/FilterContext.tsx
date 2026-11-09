// mobile/src/context/FilterContext.tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@apollo/client/react";
import { BUSINESSES } from "@/lib/graphql";
import type { Business } from "@/lib/types";
import { currentPeriod } from "@/lib/format";
import { useAuth } from "./AuthContext";

type FilterState = {
  businessId: string | null; // null = All businesses
  setBusinessId: (id: string | null) => void;
  period: string; // YYYY-MM
  setPeriod: (p: string) => void;
  businesses: Business[];
  loadingBusinesses: boolean;
};

const FilterContext = createContext<FilterState | null>(null);

/** The global "which business / which month" filter every screen reads. */
export function FilterProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [period, setPeriod] = useState(currentPeriod());
  const { data, loading } = useQuery<{ businesses: Business[] }>(BUSINESSES, { skip: !session });
  const businesses = data?.businesses ?? [];
  // If the selected business was removed/archived, fall back to "All businesses".
  const selected = data && businessId && !businesses.some((b) => b.id === businessId) ? null : businessId;

  return (
    <FilterContext.Provider
      value={{
        businessId: selected,
        setBusinessId,
        period,
        setPeriod,
        businesses,
        loadingBusinesses: loading,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used inside FilterProvider");
  return ctx;
}