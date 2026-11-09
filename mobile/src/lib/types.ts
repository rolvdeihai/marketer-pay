// mobile/src/lib/types.ts
export type BonusType = "PER_SALE" | "PER_X_SALES";

/** How the bonus is counted for one outcome (target met or missed). */
export type BonusRule = {
  bonusType: BonusType;
  salesPerBonus: number;
  bonusAmount: number;
  /** % of the counted bonus that is paid out. */
  bonusPct: number;
};

export type PayRule = {
  /** Paid only when the target is achieved. */
  baseSalary: number;
  targetMet: BonusRule;
  targetMissed: BonusRule;
};

/** DELETED = removed for good; ARCHIVED = had history, so it was hidden instead. */
export type RemoveResult = "DELETED" | "ARCHIVED";

export type Business = { id: string; name: string; slug: string; rule: PayRule };
export type BusinessRef = { id: string; name: string };

export type Marketer = {
  id: string;
  name: string;
  phone?: string | null;
  active: boolean;
  businesses: BusinessRef[];
};

export type Product = { id: string; businessId: string; businessName: string; name: string; price: number };

export type Transaction = {
  id: string;
  businessId: string;
  businessName: string;
  marketerId: string;
  marketerName: string;
  productId: string;
  productName: string;
  amount: number;
  soldAt: string;
  note?: string | null;
};

export type MarketerStat = {
  marketerId: string;
  marketerName: string;
  businessId: string;
  businessName: string;
  salesCount: number;
  revenue: number;
  isPaid: boolean;
  paidTotal?: number | null;
  paidAt?: string | null;
};

export type DashboardStats = {
  period: string;
  totalSales: number;
  totalRevenue: number;
  unpaidCount: number;
  topMarketers: MarketerStat[];
};

export type PayoutPreview = {
  marketerId: string;
  marketerName: string;
  businessId: string;
  businessName: string;
  period: string;
  salesCount: number;
  targetAchieved: boolean;
  baseSalary: number;
  bonusRaw: number;
  bonusPct: number;
  bonusFinal: number;
  total: number;
  ruleSummary: string;
  alreadyPaid: boolean;
};

export type Payout = Omit<PayoutPreview, "ruleSummary" | "alreadyPaid"> & {
  id: string;
  paidAt: string;
  paidBy?: string | null;
};

export type ChatMessage = { role: "user" | "assistant"; content: string; html?: string | null };