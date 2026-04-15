"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { Transaction } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BudgetPrediction {
  category: string;
  budgetAmount: number;
  currentSpend: number;
  projectedAmount: number;
  /** Human-readable date string, e.g. "April 23" */
  predictedExceedDate: string;
  /** true when currentSpend already exceeds budgetAmount */
  alreadyExceeded: boolean;
  prediction: string;
}

export interface NLSearchResult {
  transactions: Transaction[];
  interpretation: string;
}

export interface SpendingAnomaly {
  category: string;
  currentAmount: number;
  averageAmount: number;
  percentageIncrease: number;
  insight: string;
}

// ── naturalLanguageSearch ─────────────────────────────────────────────────────

export async function naturalLanguageSearch(
  query: string,
  transactions: Transaction[]
): Promise<NLSearchResult> {
  if (!query.trim() || transactions.length === 0) {
    return { transactions: [], interpretation: "No transactions to search." };
  }

  // Build a lookup map so we can resolve IDs → full Transaction objects
  const txById = new Map(transactions.map((t) => [t.id, t]));

  // Send only the fields Claude needs — keeps the prompt lean
  const minimalTxs = transactions.map((t) => ({
    id:          t.id,
    description: t.description,
    category:    t.category,
    type:        t.type,
    amount:      Number(t.amount),
    date:        t.created_at.slice(0, 10), // YYYY-MM-DD
  }));

  const today = new Date().toISOString().slice(0, 10);

  const anthropic = new Anthropic();

  const msg = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system:
      `Today is ${today}. You are a financial assistant analyzing a user's personal transactions. ` +
      `When given a natural language query, identify which transactions match it. ` +
      `Return ONLY a valid JSON object with exactly two fields:\n` +
      `- "ids": an array of matching transaction id strings (empty array if none match)\n` +
      `- "interpretation": one short sentence describing what you found ` +
      `(e.g. "Showing 4 food transactions from last month totalling $123.45.")\n` +
      `Do not include any other text, explanation, or markdown formatting.`,
    messages: [
      {
        role:    "user",
        content: `Query: "${query.trim()}"\n\nTransactions:\n${JSON.stringify(minimalTxs)}`,
      },
    ],
  });

  const raw     = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  let ids: string[]         = [];
  let interpretation: string = `Showing results for "${query}".`;

  try {
    const parsed   = JSON.parse(cleaned) as { ids: string[]; interpretation: string };
    ids            = Array.isArray(parsed.ids) ? parsed.ids : [];
    interpretation = parsed.interpretation ?? interpretation;
  } catch {
    // Parsing failed — return empty result rather than crashing
    return { transactions: [], interpretation: `Could not interpret "${query}". Try rephrasing.` };
  }

  // Guard: only return IDs that actually exist in the user's transaction list
  const matched = ids
    .map((id) => txById.get(id))
    .filter((t): t is Transaction => t !== undefined);

  return { transactions: matched, interpretation };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM" for a given year and 0-indexed month. */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Builds the fallback insight sentence without AI. */
function fallbackInsight(category: string, pct: number): string {
  return `You spent ${pct}% more on ${category} this month than your 3-month average.`;
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function getSpendingAnomalies(): Promise<SpendingAnomaly[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return [];

  // ── Date bounds ─────────────────────────────────────────────────────────────
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Inclusive start of the window: first day of 3 months ago
  const windowStart = new Date(currentYear, currentMonth - 3, 1);
  const startDate   = windowStart.toISOString().slice(0, 10);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("category, amount, created_at")
    .eq("user_id", user.id)
    .eq("type", "expense")
    .gte("created_at", startDate);

  if (txError || !transactions?.length) return [];

  // ── Aggregate: category → month → total spend ───────────────────────────────
  const byCategory: Record<string, Record<string, number>> = {};

  for (const tx of transactions) {
    const mk  = (tx.created_at as string).slice(0, 7); // "YYYY-MM"
    const cat = tx.category as string;
    if (!byCategory[cat]) byCategory[cat] = {};
    byCategory[cat][mk] = (byCategory[cat][mk] ?? 0) + Number(tx.amount);
  }

  // ── Build comparison keys ───────────────────────────────────────────────────
  const thisMK = monthKey(currentYear, currentMonth);

  // Previous 3 months (always 3 slots; missing months count as 0)
  const prevMKs: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(currentYear, currentMonth - i, 1);
    prevMKs.push(monthKey(d.getFullYear(), d.getMonth()));
  }

  // ── Detect anomalies ────────────────────────────────────────────────────────
  const flagged: Omit<SpendingAnomaly, "insight">[] = [];

  for (const [category, monthData] of Object.entries(byCategory)) {
    const currentAmount = monthData[thisMK] ?? 0;
    if (currentAmount === 0) continue;

    // Require at least one prior month with data to avoid false positives for
    // brand-new categories where there is genuinely no history to compare.
    const prevValues  = prevMKs.map((mk) => monthData[mk] ?? 0);
    const hasHistory  = prevValues.some((v) => v > 0);
    if (!hasHistory) continue;

    // Average over all 3 slots (including zero months) so infrequent spend
    // doesn't look artificially low.
    const averageAmount      = prevValues.reduce((s, v) => s + v, 0) / 3;
    const percentageIncrease = Math.round(
      ((currentAmount - averageAmount) / averageAmount) * 100
    );

    if (percentageIncrease > 25) {
      flagged.push({ category, currentAmount, averageAmount, percentageIncrease });
    }
  }

  if (flagged.length === 0) return [];

  // ── Single Anthropic call for all insight sentences ─────────────────────────
  const anthropic = new Anthropic();

  const categoryLines = flagged
    .map(
      (a) =>
        `- ${a.category}: $${a.currentAmount.toFixed(2)} this month vs ` +
        `$${a.averageAmount.toFixed(2)} 3-month average (+${a.percentageIncrease}%)`
    )
    .join("\n");

  let insightMap: Record<string, string> = {};

  try {
    const msg = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content:
            `Generate one short, friendly insight sentence per spending category below. ` +
            `Each sentence must mention the percentage increase and feel personal ` +
            `(e.g. "You spent 43% more on food this month than your 3-month average."). ` +
            `Keep each sentence under 20 words.\n\n` +
            `${categoryLines}\n\n` +
            `Return only a JSON array: [{"category":"food","insight":"..."},...]`,
        },
      ],
    });

    const raw    = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]";
    // Strip markdown code fences if the model wrapped the JSON
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed  = JSON.parse(cleaned) as { category: string; insight: string }[];
    insightMap    = Object.fromEntries(parsed.map((p) => [p.category, p.insight]));
  } catch {
    // Fallback to template sentences — dashboard still works if Anthropic is down
    for (const a of flagged) {
      insightMap[a.category] = fallbackInsight(a.category, a.percentageIncrease);
    }
  }

  return flagged.map((a) => ({
    ...a,
    insight: insightMap[a.category] ?? fallbackInsight(a.category, a.percentageIncrease),
  }));
}

// ── getBudgetPredictions ──────────────────────────────────────────────────────

function fallbackPrediction(
  category: string,
  exceedDate: string,
  alreadyExceeded: boolean
): string {
  if (alreadyExceeded) {
    return `You've already exceeded your ${category} budget this month.`;
  }
  return `At your current pace you will exceed your ${category} budget by ${exceedDate}.`;
}

function formatExceedDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export async function getBudgetPredictions(): Promise<BudgetPrediction[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return [];

  // ── Date helpers ────────────────────────────────────────────────────────────
  const now          = new Date();
  const year         = now.getFullYear();
  const month        = now.getMonth(); // 0-indexed
  const dayOfMonth   = now.getDate();  // 1-indexed, current day
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const daysElapsed  = dayOfMonth;
  const daysRemaining = daysInMonth - dayOfMonth;

  // Can't project a rate on the very first day (no elapsed time)
  if (daysElapsed === 0) return [];

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  // ── Fetch budgets + current-month expense transactions in parallel ───────────
  const [{ data: budgets }, { data: txRows }] = await Promise.all([
    supabase.from("budgets").select("category, monthly_limit").eq("user_id", user.id),
    supabase
      .from("transactions")
      .select("category, amount")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .gte("created_at", monthStart),
  ]);

  if (!budgets?.length) return [];

  // ── Aggregate current spend per category ────────────────────────────────────
  const spendByCategory: Record<string, number> = {};
  for (const tx of txRows ?? []) {
    const cat = tx.category as string;
    spendByCategory[cat] = (spendByCategory[cat] ?? 0) + Number(tx.amount);
  }

  // ── Project and flag ────────────────────────────────────────────────────────
  const flagged: Omit<BudgetPrediction, "prediction">[] = [];

  for (const budget of budgets) {
    const category    = budget.category as string;
    const budgetAmount = Number(budget.monthly_limit);
    const currentSpend = spendByCategory[category] ?? 0;

    // No spending yet — nothing to project
    if (currentSpend === 0) continue;

    const dailyRate      = currentSpend / daysElapsed;
    const projectedAmount = currentSpend + dailyRate * daysRemaining;

    // Only flag if projected total will exceed the budget
    if (projectedAmount <= budgetAmount && currentSpend < budgetAmount) continue;

    const alreadyExceeded = currentSpend >= budgetAmount;

    let exceedDate: Date;
    if (alreadyExceeded) {
      exceedDate = now;
    } else {
      // Days from today until the running total crosses the budget limit
      const daysUntilCrossing = (budgetAmount - currentSpend) / dailyRate;
      exceedDate = new Date(year, month, dayOfMonth + Math.ceil(daysUntilCrossing));
    }

    flagged.push({
      category,
      budgetAmount,
      currentSpend,
      projectedAmount: Math.round(projectedAmount * 100) / 100,
      predictedExceedDate: formatExceedDate(exceedDate),
      alreadyExceeded,
    });
  }

  if (flagged.length === 0) return [];

  // ── Single Anthropic call for all warning sentences ─────────────────────────
  const anthropic = new Anthropic();

  const lines = flagged
    .map((p) =>
      p.alreadyExceeded
        ? `- ${p.category}: $${p.currentSpend.toFixed(2)} spent of $${p.budgetAmount.toFixed(2)} budget (already exceeded by $${(p.currentSpend - p.budgetAmount).toFixed(2)})`
        : `- ${p.category}: $${p.currentSpend.toFixed(2)} spent of $${p.budgetAmount.toFixed(2)} budget, projected $${p.projectedAmount.toFixed(2)} by month end (will exceed on ${p.predictedExceedDate})`
    )
    .join("\n");

  let predictionMap: Record<string, string> = {};

  try {
    const msg = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content:
            `Generate one short, friendly but urgent budget warning sentence per category below. ` +
            `For categories already exceeded say so clearly. For others, mention the projected exceed date. ` +
            `Keep each sentence under 20 words. Be specific about amounts or dates.\n\n` +
            `${lines}\n\n` +
            `Return only a JSON array: [{"category":"food","prediction":"..."},...]`,
        },
      ],
    });

    const raw     = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed  = JSON.parse(cleaned) as { category: string; prediction: string }[];
    predictionMap = Object.fromEntries(parsed.map((p) => [p.category, p.prediction]));
  } catch {
    for (const p of flagged) {
      predictionMap[p.category] = fallbackPrediction(
        p.category,
        p.predictedExceedDate,
        p.alreadyExceeded
      );
    }
  }

  return flagged.map((p) => ({
    ...p,
    prediction:
      predictionMap[p.category] ??
      fallbackPrediction(p.category, p.predictedExceedDate, p.alreadyExceeded),
  }));
}
