"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getRedis } from "@/lib/redis";
import type { Transaction } from "@/types";

const ANOMALIES_TTL   = 60 * 30;      // 30 minutes
const HEALTH_SCORE_TTL = 60 * 60;     // 1 hour

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HealthScoreFactors {
  budgetAdherence: number;    // 0-100
  savingsRate: number;        // 0-100
  incomeConsistency: number;  // 0-100
  spendingStability: number;  // 0-100
}

export type HealthScoreLabel = "Needs Work" | "Fair" | "Good" | "Excellent";

export interface FinancialHealthScore {
  score: number;
  label: HealthScoreLabel;
  factors: HealthScoreFactors;
  explanation: string;
}

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

// ── detectAndSuggestRecurring ─────────────────────────────────────────────────

/** Normalises a merchant description for grouping (case-insensitive, no punctuation). */
function normalizeForGrouping(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
}

/** Median of a numeric array. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export interface RecurringSuggestion {
  /** Stable client-side key */
  id: string;
  merchant: string;
  amount: number;
  frequency: "weekly" | "monthly" | "yearly";
  /** 0-100 */
  confidence: number;
  category: string;
  occurrences: number;
}

export async function detectAndSuggestRecurring(
  transactions: BankTxInput[]
): Promise<RecurringSuggestion[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const expenses = transactions.filter((t) => t.type === "expense");
  if (expenses.length < 2) return [];

  // ── Fetch existing recurring transactions to avoid duplicate suggestions ────
  const { data: existingRows } = await supabase
    .from("transactions")
    .select("description")
    .eq("user_id", user.id)
    .eq("is_recurring", true);

  const existingKeys = new Set(
    (existingRows ?? []).map((r) => normalizeForGrouping(r.description as string))
  );

  // ── Group expenses by normalised merchant name ──────────────────────────────
  const groups: Record<string, BankTxInput[]> = {};
  for (const tx of expenses) {
    const key = normalizeForGrouping(tx.clean_description ?? tx.description);
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }

  const suggestions: RecurringSuggestion[] = [];

  for (const [key, txs] of Object.entries(groups)) {
    if (txs.length < 2)       continue; // need at least 2 occurrences
    if (existingKeys.has(key)) continue; // already tracked

    // Sort chronologically
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

    // ── Amount consistency check (within 10%) ────────────────────────────────
    const amounts   = sorted.map((t) => Number(t.amount));
    const avgAmount = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const maxDev    = Math.max(...amounts.map((a) => Math.abs(a - avgAmount) / avgAmount));
    if (maxDev > 0.10) continue;

    // ── Interval analysis ────────────────────────────────────────────────────
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const ms = new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime();
      intervals.push(Math.round(ms / 86_400_000)); // convert ms → days
    }

    const med = median(intervals);

    // Classify: weekly 5-10d, monthly 25-35d, yearly 350-380d  (skip biweekly — no matching type)
    let frequency: RecurringSuggestion["frequency"];
    let targetInterval: number;

    if (med >= 5 && med <= 10) {
      frequency      = "weekly";
      targetInterval = 7;
    } else if (med >= 25 && med <= 35) {
      frequency      = "monthly";
      targetInterval = 30;
    } else if (med >= 350 && med <= 380) {
      frequency      = "yearly";
      targetInterval = 365;
    } else {
      continue; // doesn't fit any known period
    }

    // ── Confidence ───────────────────────────────────────────────────────────
    // Based on: interval consistency (low std-dev) + occurrence count
    const variance    = intervals.reduce((s, v) => s + (v - targetInterval) ** 2, 0) / intervals.length;
    const stdDev      = Math.sqrt(variance);
    const intervalScore = Math.max(0, 100 - (stdDev / targetInterval) * 200);
    const countBonus    = Math.min(25, (txs.length - 2) * 8); // up to +25 for 5+ occurrences
    const confidence    = Math.round(Math.min(100, intervalScore * 0.75 + countBonus));

    if (confidence < 55) continue;

    // ── Most common category ─────────────────────────────────────────────────
    const catCounts: Record<string, number> = {};
    for (const t of txs) {
      const cat = t.category ?? "other";
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }
    const category = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0];

    const merchant = sorted[0].clean_description ?? sorted[0].description;

    suggestions.push({
      id:          `${key}-${frequency}`,
      merchant,
      amount:      Math.round(avgAmount * 100) / 100,
      frequency,
      confidence,
      category,
      occurrences: txs.length,
    });
  }

  // Return highest-confidence suggestions first, cap at 10
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
}

// ── analyzeBankStatement types ────────────────────────────────────────────────

export interface BankStatementTopCategory {
  category: string;
  amount: number;
  percentage: number;
}

export interface BankStatementBiggestExpense {
  description: string;
  amount: number;
  date: string;
  category: string;
}

export interface BankStatementRecurringCharge {
  description: string;
  amount: number;
  count: number;
}

export interface BankStatementAnalysis {
  topCategories: BankStatementTopCategory[];
  biggestExpense: BankStatementBiggestExpense | null;
  recurringCharges: BankStatementRecurringCharge[];
  summary: string;
  suggestion: string;
}

/** Minimal shape the analyzeBankStatement action expects from bank_transactions rows. */
export interface BankTxInput {
  date: string;
  description: string;
  clean_description: string | null;
  amount: number;
  type: "income" | "expense";
  category: string | null;
}

// ── analyzeBankStatement ──────────────────────────────────────────────────────

export async function analyzeBankStatement(
  transactions: BankTxInput[]
): Promise<BankStatementAnalysis | null> {
  const expenses = transactions.filter((t) => t.type === "expense");
  if (expenses.length === 0) return null;

  const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount), 0);

  // ── Pre-compute top 3 categories ───────────────────────────────────────────
  const catMap: Record<string, number> = {};
  for (const t of expenses) {
    const cat = t.category ?? "other";
    catMap[cat] = (catMap[cat] ?? 0) + Number(t.amount);
  }
  const topCategories: BankStatementTopCategory[] = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: Math.round((amount / totalExpenses) * 100),
    }));

  // ── Pre-compute biggest single expense ─────────────────────────────────────
  const biggestTx = expenses.reduce((max, t) =>
    Number(t.amount) > Number(max.amount) ? t : max
  );
  const biggestExpense: BankStatementBiggestExpense = {
    description: biggestTx.clean_description ?? biggestTx.description,
    amount:      Math.round(Number(biggestTx.amount) * 100) / 100,
    date:        biggestTx.date,
    category:    biggestTx.category ?? "other",
  };

  // ── Anthropic call — recurring detection + summary + suggestion ────────────
  const anthropic = new Anthropic();

  // Cap at 200 rows to stay within token budget
  const minimalTxs = transactions.slice(0, 200).map((t) => ({
    date:   t.date,
    desc:   t.clean_description ?? t.description,
    amount: Number(t.amount),
    type:   t.type,
    cat:    t.category ?? "other",
  }));

  const contextLines = [
    `Total expenses: $${totalExpenses.toFixed(2)} across ${expenses.length} transactions`,
    `Top spending: ${topCategories.map((c) => `${c.category} ($${c.amount.toFixed(2)}, ${c.percentage}%)`).join(", ")}`,
    `Biggest expense: ${biggestExpense.description} on ${biggestExpense.date} for $${biggestExpense.amount.toFixed(2)}`,
  ].join("\n");

  let recurringCharges: BankStatementRecurringCharge[] = [];
  let summary = "";
  let suggestion = "";

  try {
    const msg = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 768,
      messages: [
        {
          role: "user",
          content:
            `Analyze this bank statement and return a JSON object with exactly three fields:\n` +
            `- "recurring": array of recurring charges (same merchant appearing 2+ times with similar amounts), ` +
            `each with {description: string, amount: number, count: number}. Max 5 items. Empty array if none.\n` +
            `- "summary": 3-4 sentences describing the user's spending patterns from this statement.\n` +
            `- "suggestion": one specific, actionable tip to improve their finances based on what you see.\n\n` +
            `Context:\n${contextLines}\n\n` +
            `Transactions:\n${JSON.stringify(minimalTxs)}\n\n` +
            `Return only valid JSON — no markdown, no explanation.`,
        },
      ],
    });

    const raw     = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed  = JSON.parse(cleaned) as {
      recurring: { description: string; amount: number; count: number }[];
      summary:   string;
      suggestion: string;
    };

    recurringCharges = Array.isArray(parsed.recurring)
      ? parsed.recurring.slice(0, 5)
      : [];
    summary    = parsed.summary    ?? "";
    suggestion = parsed.suggestion ?? "";
  } catch {
    // Fallback — card still renders without AI text
    summary    = `You had ${expenses.length} expense transactions totalling $${totalExpenses.toFixed(2)}. ` +
                 `Your top spending category was ${topCategories[0]?.category ?? "other"}, ` +
                 `which accounted for ${topCategories[0]?.percentage ?? 0}% of your total spend.`;
    suggestion = `Review your ${topCategories[0]?.category ?? "top"} spending — it makes up ` +
                 `${topCategories[0]?.percentage ?? 0}% of your expenses this period.`;
  }

  return { topCategories, biggestExpense, recurringCharges, summary, suggestion };
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

  const redis = getRedis();
  const cacheKey = `user:anomalies:${user.id}`;

  if (redis) {
    const cached = await redis.get<SpendingAnomaly[]>(cacheKey);
    if (cached) return cached;
  }

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

  const result = flagged.map((a) => ({
    ...a,
    insight: insightMap[a.category] ?? fallbackInsight(a.category, a.percentageIncrease),
  }));

  if (redis) await redis.set(cacheKey, result, { ex: ANOMALIES_TTL });

  return result;
}

// ── getFinancialHealthScore ───────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreLabel(score: number): HealthScoreLabel {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Work";
}

export async function getFinancialHealthScore(): Promise<FinancialHealthScore | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const redis = getRedis();
  const cacheKey = `user:health-score:${user.id}`;

  if (redis) {
    const cached = await redis.get<FinancialHealthScore>(cacheKey);
    if (cached) return cached;
  }

  // ── Date bounds: 3 complete calendar months, excluding current partial month ─
  const now          = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Start of 3 months ago, end of last month
  const windowStart = new Date(currentYear, currentMonth - 3, 1);
  const windowEnd   = new Date(currentYear, currentMonth, 0); // last day of prev month

  const startDate = windowStart.toISOString().slice(0, 10);
  const endDate   = windowEnd.toISOString().slice(0, 10);

  // ── Fetch transactions + budgets in parallel ────────────────────────────────
  const [{ data: txRows }, { data: budgets }] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, category, created_at")
      .eq("user_id", user.id)
      .gte("created_at", startDate)
      .lte("created_at", endDate),
    supabase
      .from("budgets")
      .select("category, monthly_limit")
      .eq("user_id", user.id),
  ]);

  const transactions = txRows ?? [];

  // ── Aggregate per month ─────────────────────────────────────────────────────
  // Build list of the 3 month keys in the window
  const monthKeys: string[] = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    monthKeys.push(monthKey(d.getFullYear(), d.getMonth()));
  }

  // income & expense totals per month
  const incomeByMonth:  Record<string, number> = {};
  const expenseByMonth: Record<string, number> = {};
  // expense per category per month: { category → { monthKey → total } }
  const categoryExpenseByMonth: Record<string, Record<string, number>> = {};

  for (const mk of monthKeys) {
    incomeByMonth[mk]  = 0;
    expenseByMonth[mk] = 0;
  }

  for (const tx of transactions) {
    const mk  = (tx.created_at as string).slice(0, 7);
    if (!monthKeys.includes(mk)) continue;

    const amt = Number(tx.amount);
    if (tx.type === "income") {
      incomeByMonth[mk] = (incomeByMonth[mk] ?? 0) + amt;
    } else {
      expenseByMonth[mk] = (expenseByMonth[mk] ?? 0) + amt;
      const cat = tx.category as string;
      if (!categoryExpenseByMonth[cat]) categoryExpenseByMonth[cat] = {};
      categoryExpenseByMonth[cat][mk] = (categoryExpenseByMonth[cat][mk] ?? 0) + amt;
    }
  }

  const totalIncome   = Object.values(incomeByMonth).reduce((s, v) => s + v, 0);
  const totalExpenses = Object.values(expenseByMonth).reduce((s, v) => s + v, 0);

  // ── Factor 1: Budget Adherence ──────────────────────────────────────────────
  let budgetAdherence: number;
  if (!budgets?.length) {
    budgetAdherence = 50; // neutral: no budgets set
  } else {
    const scores: number[] = [];
    for (const budget of budgets) {
      const cat   = budget.category as string;
      const limit = Number(budget.monthly_limit);
      for (const mk of monthKeys) {
        const spend = categoryExpenseByMonth[cat]?.[mk] ?? 0;
        if (spend === 0) {
          scores.push(100); // nothing spent → perfect adherence
        } else {
          scores.push(clamp((limit / spend) * 100, 0, 100));
        }
      }
    }
    budgetAdherence = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  }

  // ── Factor 2: Savings Rate ──────────────────────────────────────────────────
  // (income - expenses) / income, mapped: 0% → 0, 20%+ → 100
  let savingsRate: number;
  if (totalIncome === 0) {
    savingsRate = totalExpenses === 0 ? 50 : 0;
  } else {
    const rate = (totalIncome - totalExpenses) / totalIncome; // can be negative
    // Map: rate ≤ 0 → 0, rate ≥ 0.20 → 100
    savingsRate = Math.round(clamp((rate / 0.20) * 100, 0, 100));
  }

  // ── Factor 3: Income Consistency (income vs expense ratio per month) ─────────
  // Per month: ratio = income / expenses; ratio ≥ 1.5 → 100, 0 → 0. Avg across months.
  const consistencyScores: number[] = [];
  for (const mk of monthKeys) {
    const inc = incomeByMonth[mk]  ?? 0;
    const exp = expenseByMonth[mk] ?? 0;
    if (exp === 0 && inc === 0) {
      consistencyScores.push(50); // no activity
    } else if (exp === 0) {
      consistencyScores.push(100); // income but no expenses
    } else {
      const ratio = inc / exp; // ≥ 1.5 → 100, 0 → 0
      consistencyScores.push(Math.round(clamp((ratio / 1.5) * 100, 0, 100)));
    }
  }
  const incomeConsistency = Math.round(
    consistencyScores.reduce((s, v) => s + v, 0) / consistencyScores.length
  );

  // ── Factor 4: Spending Stability (low CV of monthly expenses) ───────────────
  let spendingStability: number;
  const expenseValues = monthKeys.map((mk) => expenseByMonth[mk] ?? 0);
  const nonZeroMonths = expenseValues.filter((v) => v > 0);

  if (nonZeroMonths.length < 2) {
    spendingStability = 75; // not enough data to measure variance
  } else {
    const mean = expenseValues.reduce((s, v) => s + v, 0) / expenseValues.length;
    if (mean === 0) {
      spendingStability = 100;
    } else {
      const variance = expenseValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / expenseValues.length;
      const cv = Math.sqrt(variance) / mean; // coefficient of variation
      // CV = 0 → 100, CV ≥ 1 → 0
      spendingStability = Math.round(clamp((1 - cv) * 100, 0, 100));
    }
  }

  // ── Overall score ───────────────────────────────────────────────────────────
  const factors: HealthScoreFactors = {
    budgetAdherence,
    savingsRate,
    incomeConsistency,
    spendingStability,
  };

  const score = Math.round(
    (budgetAdherence + savingsRate + incomeConsistency + spendingStability) / 4
  );

  // ── Anthropic call for explanation ─────────────────────────────────────────
  const anthropic = new Anthropic();

  const factorLines = [
    `- Budget Adherence: ${budgetAdherence}/100`,
    `- Savings Rate: ${savingsRate}/100 (total income $${totalIncome.toFixed(2)}, total expenses $${totalExpenses.toFixed(2)})`,
    `- Income Consistency: ${incomeConsistency}/100`,
    `- Spending Stability: ${spendingStability}/100`,
  ].join("\n");

  let explanation = `Your financial health score is ${score}/100 (${scoreLabel(score)}). Focus on improving your weakest area to boost your overall score.`;

  try {
    const msg = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content:
            `A user's financial health score is ${score}/100 (${scoreLabel(score)}), based on these factor scores:\n` +
            `${factorLines}\n\n` +
            `Write 2-3 short, friendly sentences explaining this score and identifying the biggest area for improvement. ` +
            `Be specific and encouraging. Do not use bullet points. Plain text only.`,
        },
      ],
    });

    explanation = msg.content[0].type === "text" ? msg.content[0].text.trim() : explanation;
  } catch {
    // Fallback — dashboard still works without AI explanation
  }

  const result: FinancialHealthScore = { score, label: scoreLabel(score), factors, explanation };

  if (redis) await redis.set(cacheKey, result, { ex: HEALTH_SCORE_TTL });

  return result;
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
