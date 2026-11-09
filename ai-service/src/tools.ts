// ai-service/src/tools.ts
import { tool } from "@langchain/core/tools";
import * as z from "zod";
import { supabase } from "./supabase.js";
import { embed } from "./embeddings.js";

/** Tools are created per request so they can be scoped to the selected business. */
export function makeTools(businessId: string | null) {
  const getSalesByMonth = tool(
    async ({ months }) => {
      const { data, error } = await supabase.rpc("ai_sales_by_month", {
        filter_business: businessId,
        months: months ?? 6,
      });
      if (error) return `Error: ${error.message}`;
      return JSON.stringify(data);
    },
    {
      name: "get_sales_by_month",
      description:
        "Monthly sales count and revenue (IDR) grouped by month, business and marketer. " +
        "Use for trends, growth, rankings and comparing marketers or businesses.",
      schema: z.object({
        months: z.number().int().min(1).max(24).optional().describe("How many recent months, default 6"),
      }),
    },
  );

  const getPayoutHistory = tool(
    async ({ limit }) => {
      let q = supabase
        .from("payouts")
        .select("period, sales_count, target_achieved, base_salary, bonus_final, bonus_pct, total, paid_at, marketers(name), businesses(name)")
        .order("paid_at", { ascending: false })
        .limit(limit ?? 50);
      if (businessId) q = q.eq("business_id", businessId);
      const { data, error } = await q;
      if (error) return `Error: ${error.message}`;
      return JSON.stringify(data);
    },
    {
      name: "get_payout_history",
      description: "Past salary/bonus payouts to marketers, newest first.",
      schema: z.object({
        limit: z.number().int().min(1).max(200).optional().describe("Max rows, default 50"),
      }),
    },
  );

  const getBusinessRules = tool(
    async () => {
      let q = supabase
        .from("businesses")
        .select(
          "id, name, active, pay_rules(base_salary, " +
            "met_bonus_type, met_sales_per_bonus, met_bonus_amount, bonus_pct_target_met, " +
            "missed_bonus_type, missed_sales_per_bonus, missed_bonus_amount, bonus_pct_target_missed)",
        );
      if (businessId) q = q.eq("id", businessId);
      const { data, error } = await q;
      if (error) return `Error: ${error.message}`;
      return JSON.stringify(data);
    },
    {
      name: "get_business_rules",
      description:
        "Pay rules per business: base salary (paid only if target achieved), then a separate bonus " +
        "for target met (met_*) and target missed (missed_*): type (PER_SALE or PER_X_SALES), " +
        "sales per bonus, bonus amount, and % of that bonus paid. active=false means archived.",
      schema: z.object({}),
    },
  );

  const searchRecords = tool(
    async ({ query, k }) => {
      const queryEmbedding = await embed(query);
      const { data, error } = await supabase.rpc("match_ai_documents", {
        query_embedding: queryEmbedding,
        match_count: k ?? 8,
        filter_business: businessId,
      });
      if (error) return `Error: ${error.message}`;
      return JSON.stringify(data);
    },
    {
      name: "search_records",
      description:
        "Semantic search over individual sales and payouts. Use to find specific records by meaning " +
        "(a note, a product, a person). Not suitable for totals — use get_sales_by_month for those.",
      schema: z.object({
        query: z.string().describe("What to look for, in natural language"),
        k: z.number().int().min(1).max(20).optional().describe("How many results, default 8"),
      }),
    },
  );

  return [getSalesByMonth, getPayoutHistory, getBusinessRules, searchRecords];
}