"use server";

/**
 * bank-statements.ts
 *
 * Server actions for the bank statement import feature.
 *
 * Actions:
 *   categorizeTransactions  – AI-categorize a batch of raw transactions (internal helper)
 *   importBankStatement     – parse + categorize + persist an uploaded PDF statement
 *   getBankAccounts         – list bank accounts with statement stats for the current user
 *   getBankAccountAnalysis  – full analysis (transactions, trends, summary) for one account
 *   deleteBankAccount       – cascade-delete an account and all its statements/transactions
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { parsePdfStatement } from "@/lib/parsers";
import { isProUser } from "@/lib/stripe";
import type { ParsedTransaction } from "@/lib/parsers";

// ── Types ─────────────────────────────────────────────────────────────────────

/** The valid category strings accepted by the AI and the DB. */
type TransactionCategory =
  | "housing"
  | "food"
  | "transport"
  | "utilities"
  | "health"
  | "entertainment"
  | "shopping"
  | "education"
  | "salary"
  | "freelance"
  | "investment"
  | "other";

const VALID_CATEGORIES: TransactionCategory[] = [
  "housing", "food", "transport", "utilities", "health",
  "entertainment", "shopping", "education", "salary",
  "freelance", "investment", "other",
];

/** A parsed transaction after AI enrichment. */
export interface CategorizedTransaction extends ParsedTransaction {
  clean_description: string;
  category: TransactionCategory;
}

// ── Return types for public actions ──────────────────────────────────────────

export interface ImportResult {
  bankAccountId: string;
  bankName: string;
  transactionCount: number;
  dateFrom: string;
  dateTo: string;
  statementPeriod?: string;
  beginningBalance?: number;
  endingBalance?: number;
}

export interface BankAccountSummary {
  id: string;
  bank_name: string;
  account_last_four: string | null;
  account_type: string | null;
  created_at: string;
  statement_count: number;
  date_from: string | null;
  date_to: string | null;
}

export interface MonthlyTrend {
  month: string; // "YYYY-MM"
  income: number;
  expenses: number;
}

export interface CategorySpend {
  category: string;
  total: number;
}

export interface BankAccountAnalysis {
  account: {
    id: string;
    bank_name: string;
    account_last_four: string | null;
    account_type: string | null;
  };
  statements: {
    id: string;
    file_name: string;
    date_from: string;
    date_to: string;
    transaction_count: number;
    created_at: string;
    beginning_balance: number | null;
    ending_balance: number | null;
    statement_period: string | null;
  }[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    spendingByCategory: CategorySpend[];
  };
  monthlyTrends: MonthlyTrend[];
}

// ── AI categorisation ────────────────────────────────────────────────────────

/**
 * Send all transaction descriptions to Claude in a single call.
 * Returns a CategorizedTransaction for every input, falling back to
 * category "other" and the original description if the API call fails.
 */
export async function categorizeTransactions(
  transactions: ParsedTransaction[]
): Promise<CategorizedTransaction[]> {
  function ruleBasedCategory(t: ParsedTransaction): TransactionCategory {
    if (t.type === "income") return "salary";
    const d = t.description.toLowerCase();
    if (/grocery|food|restaurant|doordash|ubereats|chick.fil.a|heinen/.test(d)) return "food";
    if (/lyft|uber|transport|parking|gas/.test(d)) return "transport";
    if (/netflix|spotify|apple|playstation|gaming|entertainment/.test(d)) return "entertainment";
    if (/amazon|walmart|target|shopping|klarna|ebay/.test(d)) return "shopping";
    if (/rent|mortgage|housing|utilities|electric|internet|water/.test(d)) return "housing";
    if (/hospital|pharmacy|gym|health|medical/.test(d)) return "health";
    if (/tuition|university|college|course|education|kindle|book/.test(d)) return "education";
    return "other";
  }

  const fallback = (): CategorizedTransaction[] =>
    transactions.map((t) => ({
      ...t,
      clean_description: t.description,
      category: ruleBasedCategory(t),
    }));

  if (transactions.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set — skipping AI categorisation.");
    return fallback();
  }

  try {
    const client = new Anthropic({ apiKey });

    const payload = transactions.map((t, i) => ({
      i,
      desc: t.description,
      type: t.type,
    }));

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are a financial transaction categorizer.
You will receive a JSON array of transactions, each with an index (i), raw description (desc), and type (income/expense).
Return a JSON array with the same number of objects, each containing:
  - i: the original index (unchanged)
  - clean: a short, human-readable description (remove merchant codes, location suffixes, card numbers, etc.)
  - category: exactly one of: housing, food, transport, utilities, health, entertainment, shopping, education, salary, freelance, investment, other

Rules:
- Match the category to the transaction type: salary/freelance/investment are for income; the rest skew expense.
- When unsure, use "other".
- Return ONLY valid JSON — no markdown fences, no explanation.`,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });

    const raw = message.content[0];
    if (raw.type !== "text") throw new Error("Unexpected response type from Claude.");

    const jsonText = raw.text.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
    const parsed: { i: number; clean: string; category: string }[] = JSON.parse(jsonText);

    const lookup = new Map(parsed.map((r) => [r.i, r]));

    return transactions.map((t, idx) => {
      const enriched = lookup.get(idx);
      const category: TransactionCategory =
        enriched && VALID_CATEGORIES.includes(enriched.category as TransactionCategory)
          ? (enriched.category as TransactionCategory)
          : "other";
      const clean_description = enriched?.clean?.trim() || t.description;
      return { ...t, clean_description, category };
    });
  } catch (err) {
    console.error("categorizeTransactions failed, using fallback:", err);
    return fallback();
  }
}

// ── Import action ─────────────────────────────────────────────────────────────

/**
 * Parse, categorize, and persist a PDF bank statement.
 *
 * Accepts a FormData with a single "file" entry (PDF File object).
 * Returns import metadata on success or throws on error.
 */
export async function importBankStatement(
  formData: FormData
): Promise<ImportResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated.");

  // ── Pro gate ──────────────────────────────────────────────────────────────
  if (!(await isProUser(user.id))) {
    throw new Error(
      "Bank statement import is a Pro feature. Upgrade at /pricing"
    );
  }

  // ── 1. Extract and validate file ──────────────────────────────────────────
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided.");

  const name  = file.name.toLowerCase();
  const mime  = file.type.toLowerCase();
  const isPdf = name.endsWith(".pdf") || mime === "application/pdf";
  if (!isPdf) {
    throw new Error(
      `Unsupported file type "${file.name}". Please upload a PDF bank statement.`
    );
  }

  // ── 2. Parse PDF ──────────────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  const buffer      = Buffer.from(arrayBuffer);
  const parsed      = await parsePdfStatement(buffer);

  const {
    bankName,
    transactions: rawTxns,
    dateFrom,
    dateTo,
    accountLastFour,
    accountType,
    beginningBalance,
    endingBalance,
    statementPeriod,
  } = parsed;

  // ── 3. Upsert bank account ─────────────────────────────────────────────────
  const { data: existingAccounts, error: accountFetchError } = await supabase
    .from("bank_accounts")
    .select("id, account_last_four, account_type")
    .eq("user_id", user.id)
    .eq("bank_name", bankName)
    .limit(1);

  if (accountFetchError) throw new Error(accountFetchError.message);

  let bankAccountId: string;

  if (existingAccounts && existingAccounts.length > 0) {
    bankAccountId = existingAccounts[0].id;

    // Backfill account_last_four and account_type if not yet set
    const updates: Record<string, string> = {};
    if (!existingAccounts[0].account_last_four && accountLastFour) {
      updates.account_last_four = accountLastFour;
    }
    if (!existingAccounts[0].account_type && accountType) {
      updates.account_type = accountType;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from("bank_accounts").update(updates).eq("id", bankAccountId);
    }
  } else {
    const { data: newAccount, error: insertAccountError } = await supabase
      .from("bank_accounts")
      .insert({
        user_id:          user.id,
        bank_name:        bankName,
        account_last_four: accountLastFour ?? null,
        account_type:      accountType ?? null,
      })
      .select("id")
      .single();

    if (insertAccountError || !newAccount) {
      throw new Error(insertAccountError?.message ?? "Failed to create bank account.");
    }
    bankAccountId = newAccount.id;
  }

  // ── 4. Duplicate detection ────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("imported_statements")
    .select("id")
    .eq("user_id", user.id)
    .eq("file_name", file.name)
    .eq("date_from", dateFrom)
    .eq("date_to", dateTo)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error("This statement has already been imported.");
  }

  // ── 5. AI categorisation ──────────────────────────────────────────────────
  const categorized = await categorizeTransactions(rawTxns);

  // ── 6. Create imported_statements record ──────────────────────────────────
  const { data: statement, error: statementError } = await supabase
    .from("imported_statements")
    .insert({
      user_id:           user.id,
      bank_account_id:   bankAccountId,
      file_name:         file.name,
      date_from:         dateFrom,
      date_to:           dateTo,
      transaction_count: categorized.length,
      beginning_balance: beginningBalance ?? null,
      ending_balance:    endingBalance    ?? null,
      statement_period:  statementPeriod  ?? null,
    })
    .select("id")
    .single();

  if (statementError || !statement) {
    throw new Error(statementError?.message ?? "Failed to create statement record.");
  }

  // ── 7. Bulk insert bank_transactions ─────────────────────────────────────
  const rows = categorized.map((t) => ({
    user_id:           user.id,
    bank_account_id:   bankAccountId,
    statement_id:      statement.id,
    date:              t.date,
    description:       t.description,
    clean_description: t.clean_description,
    amount:            t.amount,
    type:              t.type,
    category:          t.category,
  }));

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error: txError } = await supabase
      .from("bank_transactions")
      .insert(rows.slice(i, i + CHUNK));
    if (txError) throw new Error(`Failed to insert transactions: ${txError.message}`);
  }

  return {
    bankAccountId,
    bankName,
    transactionCount: categorized.length,
    dateFrom,
    dateTo,
    statementPeriod,
    beginningBalance,
    endingBalance,
  };
}

// ── getBankAccounts ───────────────────────────────────────────────────────────

export async function getBankAccounts(): Promise<BankAccountSummary[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated.");

  const { data: accounts, error } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_last_four, account_type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!accounts?.length) return [];

  const results = await Promise.all(
    accounts.map(async (acct) => {
      const { data: stmts } = await supabase
        .from("imported_statements")
        .select("date_from, date_to")
        .eq("bank_account_id", acct.id);

      const statement_count = stmts?.length ?? 0;
      const dates = (stmts ?? []).flatMap((s) => [s.date_from, s.date_to]).sort();
      const date_from = dates.length > 0 ? dates[0] : null;
      const date_to   = dates.length > 0 ? dates[dates.length - 1] : null;

      return {
        ...acct,
        statement_count,
        date_from,
        date_to,
      } satisfies BankAccountSummary;
    })
  );

  return results;
}

// ── getBankAccountAnalysis ────────────────────────────────────────────────────

export async function getBankAccountAnalysis(
  bankAccountId: string
): Promise<BankAccountAnalysis> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated.");

  const { data: account, error: acctError } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_last_four, account_type")
    .eq("id", bankAccountId)
    .eq("user_id", user.id)
    .single();

  if (acctError || !account) throw new Error("Bank account not found.");

  const { data: statementsRaw, error: stmtError } = await supabase
    .from("imported_statements")
    .select(
      "id, file_name, date_from, date_to, transaction_count, created_at, beginning_balance, ending_balance, statement_period"
    )
    .eq("bank_account_id", bankAccountId)
    .order("date_from", { ascending: false });

  if (stmtError) throw new Error(stmtError.message);
  const statements = (statementsRaw ?? []) as BankAccountAnalysis["statements"];

  const { data: txns, error: txnError } = await supabase
    .from("bank_transactions")
    .select("date, amount, type, category")
    .eq("bank_account_id", bankAccountId)
    .eq("user_id", user.id)
    .order("date", { ascending: true });

  if (txnError) throw new Error(txnError.message);
  const transactions = txns ?? [];

  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryMap = new Map<string, number>();

  for (const t of transactions) {
    const amt = Number(t.amount);
    if (t.type === "income") {
      totalIncome += amt;
    } else {
      totalExpenses += amt;
      const cat = t.category ?? "other";
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + amt);
    }
  }

  const spendingByCategory: CategorySpend[] = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);

  const monthMap = new Map<string, { income: number; expenses: number }>();
  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    const entry = monthMap.get(month) ?? { income: 0, expenses: 0 };
    const amt   = Number(t.amount);
    if (t.type === "income") entry.income   += amt;
    else                      entry.expenses += amt;
    monthMap.set(month, entry);
  }

  const monthlyTrends: MonthlyTrend[] = Array.from(monthMap.entries())
    .map(([month, { income, expenses }]) => ({
      month,
      income:   Math.round(income   * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    account,
    statements,
    summary: {
      totalIncome:   Math.round(totalIncome   * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      balance:       Math.round((totalIncome - totalExpenses) * 100) / 100,
      spendingByCategory,
    },
    monthlyTrends,
  };
}

// ── deleteStatement ───────────────────────────────────────────────────────────

export async function deleteStatement(
  statementId: string
): Promise<{ error: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  // Verify ownership
  const { data: stmt } = await supabase
    .from("imported_statements")
    .select("id")
    .eq("id", statementId)
    .eq("user_id", user.id)
    .single();

  if (!stmt) return { error: "Statement not found." };

  // Delete transactions first (in case FK constraints are not cascade)
  await supabase
    .from("bank_transactions")
    .delete()
    .eq("statement_id", statementId)
    .eq("user_id", user.id);

  const { error } = await supabase
    .from("imported_statements")
    .delete()
    .eq("id", statementId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return null;
}

// ── deleteBankAccount ─────────────────────────────────────────────────────────

export async function deleteBankAccount(
  bankAccountId: string
): Promise<{ error: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("bank_accounts")
    .delete()
    .eq("id", bankAccountId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return null;
}
