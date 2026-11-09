// mobile/src/lib/format.ts
import type { BonusRule, PayRule } from "./types";

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
export const formatIDR = (n: number | null | undefined) => idr.format(n ?? 0);

// Periods are "YYYY-MM" in Jakarta time (UTC+7), same as the server.
export function currentPeriod(): string {
  const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return jakarta.toISOString().slice(0, 7);
}

export function shiftPeriod(p: string, delta: number): string {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function formatPeriod(p: string): string {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}

export function todayJakarta(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function bonusSummary(b: BonusRule): string {
  const per = b.bonusType === "PER_X_SALES" ? `per ${b.salesPerBonus} sales` : "per sale";
  return `${formatIDR(b.bonusAmount)} ${per} at ${b.bonusPct}%`;
}

export function ruleSummary(r: PayRule): string {
  return `Met: ${formatIDR(r.baseSalary)} salary + ${bonusSummary(r.targetMet)} · Missed: ${bonusSummary(r.targetMissed)}`;
}

/** Client-side copy of the Go calculator — ONLY for live hints in forms. The server is the source of truth. */
export function estimatePay(r: PayRule, sales: number, targetAchieved: boolean): number {
  const b = targetAchieved ? r.targetMet : r.targetMissed;
  const raw = b.bonusType === "PER_X_SALES" ? Math.floor(sales / Math.max(1, b.salesPerBonus)) * b.bonusAmount : sales * b.bonusAmount;
  return (targetAchieved ? r.baseSalary : 0) + Math.floor((raw * b.bonusPct) / 100);
}
