"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  billing_cycle: "weekly" | "monthly" | "yearly";
  next_billing_date: string;
  category: string;
  is_active: boolean;
  auto_detected: boolean;
  created_at: string;
}

export interface SuggestedSubscription {
  name: string;
  amount: number;
  billing_cycle: "weekly" | "monthly" | "yearly";
  next_billing_date: string;
  category: string;
}

type ActionResult = { error: string } | null;

// ── getSubscriptions ───────────────────────────────────────────────────────────

export async function getSubscriptions(): Promise<Subscription[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("next_billing_date", { ascending: true });

  return (data ?? []) as Subscription[];
}

// ── createSubscription ────────────────────────────────────────────────────────

export async function createSubscription(input: {
  name: string;
  amount: number;
  billing_cycle: "weekly" | "monthly" | "yearly";
  next_billing_date: string;
  category: string;
  auto_detected?: boolean;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  if (!input.name.trim()) return { error: "Name is required" };
  if (input.amount < 0) return { error: "Amount must be non-negative" };
  if (!input.next_billing_date) return { error: "Next billing date is required" };

  const { error } = await supabase.from("subscriptions").insert({
    user_id:           user.id,
    name:              input.name.trim(),
    amount:            input.amount,
    billing_cycle:     input.billing_cycle,
    next_billing_date: input.next_billing_date,
    category:          input.category || "Other",
    auto_detected:     input.auto_detected ?? false,
  });

  if (error) return { error: error.message };

  revalidatePath("/subscriptions");
  return null;
}

// ── updateSubscription ────────────────────────────────────────────────────────

export async function updateSubscription(
  id: string,
  input: {
    name?: string;
    amount?: number;
    billing_cycle?: "weekly" | "monthly" | "yearly";
    next_billing_date?: string;
    category?: string;
    is_active?: boolean;
  }
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined)              updates.name              = input.name.trim();
  if (input.amount !== undefined)            updates.amount            = input.amount;
  if (input.billing_cycle !== undefined)     updates.billing_cycle     = input.billing_cycle;
  if (input.next_billing_date !== undefined) updates.next_billing_date = input.next_billing_date;
  if (input.category !== undefined)          updates.category          = input.category;
  if (input.is_active !== undefined)         updates.is_active         = input.is_active;

  const { error } = await supabase
    .from("subscriptions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/subscriptions");
  return null;
}

// ── deleteSubscription ────────────────────────────────────────────────────────

export async function deleteSubscription(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/subscriptions");
  return null;
}

// ── detectSubscriptionsFromTransactions ───────────────────────────────────────
// Analyses bank_transactions and manual transactions for recurring patterns
// (same merchant, consistent amount, regular interval) and suggests subscriptions.

export async function detectSubscriptionsFromTransactions(): Promise<SuggestedSubscription[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return [];

  // Fetch existing subscription names to avoid re-suggesting already tracked ones
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("name")
    .eq("user_id", user.id);
  const existingNames = new Set(
    (existing ?? []).map((s) => s.name.toLowerCase().trim())
  );

  // Fetch bank transactions (have proper dates) and manual transactions
  const [{ data: bankTxs }, { data: manualTxs }] = await Promise.all([
    supabase
      .from("bank_transactions")
      .select("description, clean_description, amount, date, category, type")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .order("date", { ascending: true }),
    supabase
      .from("transactions")
      .select("description, amount, created_at, category, type")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .order("created_at", { ascending: true }),
  ]);

  // Normalise into a common shape
  type TxRow = { key: string; amount: number; date: string; category: string };
  const rows: TxRow[] = [];

  for (const tx of bankTxs ?? []) {
    const label = (tx.clean_description || tx.description || "").toLowerCase().trim();
    if (label) rows.push({ key: label, amount: Math.abs(Number(tx.amount)), date: tx.date, category: tx.category ?? "Other" });
  }
  for (const tx of manualTxs ?? []) {
    const label = (tx.description || "").toLowerCase().trim();
    if (label) rows.push({ key: label, amount: Math.abs(Number(tx.amount)), date: tx.created_at.slice(0, 10), category: tx.category ?? "Other" });
  }

  // Group by merchant key
  const groups = new Map<string, TxRow[]>();
  for (const row of rows) {
    if (!groups.has(row.key)) groups.set(row.key, []);
    groups.get(row.key)!.push(row);
  }

  const suggestions: SuggestedSubscription[] = [];

  for (const [key, txs] of Array.from(groups)) {
    if (txs.length < 3) continue;
    if (existingNames.has(key)) continue;

    // Sort by date ascending
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

    // Check amount consistency (within 15% of median)
    const amounts = sorted.map((t) => t.amount);
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const median = sortedAmounts[Math.floor(sortedAmounts.length / 2)];
    if (median === 0) continue;
    const amountConsistent = amounts.every(
      (a) => Math.abs(a - median) / median < 0.15
    );
    if (!amountConsistent) continue;

    // Compute intervals in days between consecutive transactions
    const timestamps = sorted.map((t) => new Date(t.date + "T00:00:00").getTime());
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push((timestamps[i] - timestamps[i - 1]) / 86_400_000);
    }

    const avgInterval =
      intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) /
        intervals.length
    );

    // Coefficient of variation — too irregular means not a subscription
    if (avgInterval > 0 && stdDev / avgInterval > 0.35) continue;

    let billing_cycle: "weekly" | "monthly" | "yearly";
    if (avgInterval >= 5 && avgInterval <= 9)        billing_cycle = "weekly";
    else if (avgInterval >= 25 && avgInterval <= 35) billing_cycle = "monthly";
    else if (avgInterval >= 340 && avgInterval <= 395) billing_cycle = "yearly";
    else continue;

    // Project the next billing date from the last known transaction
    const lastDate = new Date(sorted[sorted.length - 1].date + "T00:00:00");
    const daysToAdd =
      billing_cycle === "weekly" ? 7 : billing_cycle === "monthly" ? 30 : 365;
    const next = new Date(lastDate.getTime() + daysToAdd * 86_400_000);
    const nextStr = next.toISOString().slice(0, 10);

    // Use the original (non-lowercased) description from the most recent transaction
    const displayName =
      sorted[sorted.length - 1].key
        .split(" ")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

    suggestions.push({
      name:              displayName,
      amount:            Math.round(median * 100) / 100,
      billing_cycle,
      next_billing_date: nextStr,
      category:          sorted[sorted.length - 1].category,
    });
  }

  // Return at most 20 suggestions sorted by amount descending
  return suggestions
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);
}
