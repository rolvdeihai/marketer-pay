// ai-service/src/indexer.ts
import { supabase } from "./supabase.js";
import { embed } from "./embeddings.js";

const rupiah = (n: number) => "Rp" + Number(n).toLocaleString("id-ID");

type Doc = { source_type: string; source_id: string; business_id: string | null; content: string };

async function embedAndStore(docs: Doc[]) {
  for (const d of docs) {
    const embedding = await embed(d.content);
    const { error } = await supabase
      .from("ai_documents")
      .upsert({ ...d, embedding }, { onConflict: "source_type,source_id" });
    if (error) throw new Error(error.message);
  }
}

/** Embeds up to `limit` new transactions and payouts. Returns how many were indexed. */
export async function syncIndex(limit = 20): Promise<number> {
  let indexed = 0;

  // ---- Transactions ----
  const { data: txs, error: txErr } = await supabase
    .from("transactions")
    .select("id, business_id, amount, sold_at, note, marketers(name), products(name), businesses(name)")
    .is("embedded_at", null)
    .order("sold_at", { ascending: true })
    .limit(limit);
  if (txErr) throw new Error(txErr.message);

  if (txs && txs.length > 0) {
    const docs: Doc[] = txs.map((t: any) => ({
      source_type: "transaction",
      source_id: t.id,
      business_id: t.business_id,
      content:
        `Sale on ${String(t.sold_at).slice(0, 10)} | business: ${t.businesses?.name} | ` +
        `marketer: ${t.marketers?.name} | product: ${t.products?.name} | amount: ${rupiah(t.amount)}` +
        (t.note ? ` | note: ${t.note}` : ""),
    }));
    await embedAndStore(docs);
    await supabase
      .from("transactions")
      .update({ embedded_at: new Date().toISOString() })
      .in("id", txs.map((t: any) => t.id));
    indexed += txs.length;
  }

  // ---- Payouts ----
  const { data: pays, error: payErr } = await supabase
    .from("payouts")
    .select("id, business_id, period, sales_count, target_achieved, base_salary, bonus_final, bonus_pct, total, paid_at, marketers(name), businesses(name)")
    .is("embedded_at", null)
    .limit(limit);
  if (payErr) throw new Error(payErr.message);

  if (pays && pays.length > 0) {
    const docs: Doc[] = pays.map((p: any) => ({
      source_type: "payout",
      source_id: p.id,
      business_id: p.business_id,
      content:
        `Payout for ${p.period} | marketer: ${p.marketers?.name} | business: ${p.businesses?.name} | ` +
        `sales: ${p.sales_count} | target achieved: ${p.target_achieved ? "yes" : "no"} | ` +
        `salary: ${rupiah(p.base_salary)} | bonus: ${rupiah(p.bonus_final)} (${p.bonus_pct}%) | ` +
        `total: ${rupiah(p.total)} | paid on ${String(p.paid_at).slice(0, 10)}`,
    }));
    await embedAndStore(docs);
    await supabase
      .from("payouts")
      .update({ embedded_at: new Date().toISOString() })
      .in("id", pays.map((p: any) => p.id));
    indexed += pays.length;
  }

  return indexed;
}