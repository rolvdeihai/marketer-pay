// mobile/src/lib/types.ts
export type BonusType = "PER_SALE" | "PER_X_SALES";

export type PayRule = {
  baseSalary: number;
  bonusType: BonusType;
  salesPerBonus: number;
  bonusAmount: number;
  bonusPctTargetMet: number;
  bonusPctTargetMissed: number;
};

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