import Link from "next/link";
import { Sparkles, Lock, TrendingUp, Repeat2, Lightbulb, BarChart3 } from "lucide-react";
import {
  analyzeBankStatement,
  type BankTxInput,
  type BankStatementAnalysis,
} from "@/app/actions/insights";
import { formatCurrency } from "@/lib/formatters";

// ── Helpers ───────────────────────────────────────────────────────────────────


function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function BankStatementInsightsSkeleton() {
  return (
    <section aria-label="AI analysis loading">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h2 className="text-sm font-semibold">AI Analysis</h2>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          AI
        </span>
      </div>
      <div className="rounded-lg border bg-card p-5 space-y-5 animate-pulse">
        {/* Top categories */}
        <div className="space-y-2.5">
          <div className="h-3 w-32 rounded bg-muted" />
          {[72, 55, 38].map((w) => (
            <div key={w} className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="flex justify-between">
                  <div className={`h-2.5 rounded bg-muted`} style={{ width: `${w}%` }} />
                  <div className="h-2.5 w-10 rounded bg-muted" />
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted" />
              </div>
            </div>
          ))}
        </div>
        {/* Divider */}
        <div className="h-px w-full bg-muted" />
        {/* Summary */}
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-2.5 w-full rounded bg-muted" />
          <div className="h-2.5 w-5/6 rounded bg-muted" />
          <div className="h-2.5 w-4/6 rounded bg-muted" />
        </div>
      </div>
    </section>
  );
}

// ── Inner card content ─────────────────────────────────────────────────────────

function AnalysisContent({ data }: { data: BankStatementAnalysis }) {
  const maxCatAmount = data.topCategories[0]?.amount ?? 1;

  return (
    <div className="space-y-5">
      {/* ── Spending Breakdown ── */}
      {data.topCategories.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            Top Spending Categories
          </div>
          <div className="space-y-2.5">
            {data.topCategories.map((cat, i) => {
              const barColors = [
                "bg-violet-500",
                "bg-violet-400",
                "bg-violet-300 dark:bg-violet-600",
              ];
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  {/* Rank dot */}
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{cat.category}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCurrency(cat.amount)}
                        <span className="ml-1.5 text-xs opacity-60">{cat.percentage}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${barColors[i]}`}
                        style={{ width: `${(cat.amount / maxCatAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Biggest Expense ── */}
      {data.biggestExpense && (
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            Biggest Expense
          </p>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{data.biggestExpense.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(data.biggestExpense.date)}
                <span className="mx-1.5 opacity-40">·</span>
                <span className="capitalize">{data.biggestExpense.category}</span>
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
              {formatCurrency(data.biggestExpense.amount)}
            </span>
          </div>
        </div>
      )}

      {/* ── Recurring Charges ── */}
      {data.recurringCharges.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Repeat2 className="h-3.5 w-3.5" />
            Recurring Charges Detected
          </p>
          <div className="space-y-1.5">
            {data.recurringCharges.map((charge) => (
              <div
                key={charge.description}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{charge.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {charge.count}× detected
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatCurrency(charge.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary ── */}
      {data.summary && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Summary
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">{data.summary}</p>
        </div>
      )}

      {/* ── Suggestion ── */}
      {data.suggestion && (
        <div className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800/40 dark:bg-violet-950/20">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
          <div>
            <p className="mb-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
              Suggestion
            </p>
            <p className="text-sm leading-snug">{data.suggestion}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Free-user blurred placeholder ─────────────────────────────────────────────

function LockedPlaceholder() {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-card p-5">
      {/* Blurred fake content */}
      <div className="select-none space-y-5 blur-sm" aria-hidden>
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Top Spending Categories
          </p>
          {["Food & Dining", "Shopping", "Entertainment"].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                {i + 1}
              </span>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span className="tabular-nums">$000.00</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-violet-400"
                    style={{ width: `${[80, 55, 35][i]}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Biggest Expense</p>
          <p className="mt-1 text-sm font-medium">████████████████</p>
          <p className="text-xs text-muted-foreground">Jan 1, 2025</p>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your spending this period shows interesting patterns across several categories.
          There are opportunities to optimize your budget significantly.
        </p>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-[3px]">
        <div className="flex items-center gap-2 rounded-lg border bg-background px-5 py-3 shadow-md">
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Pro feature</p>
            <p className="text-xs text-muted-foreground">
              Upgrade to unlock AI spending analysis
            </p>
          </div>
          <Link
            href="/pricing"
            className="ml-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main component (async Server Component) ───────────────────────────────────

interface Props {
  transactions: BankTxInput[];
  isPro: boolean;
}

export async function BankStatementInsights({ transactions, isPro }: Props) {
  return (
    <section aria-label="AI analysis">
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h2 className="text-sm font-semibold">AI Analysis</h2>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          AI
        </span>
      </div>

      {!isPro ? (
        <LockedPlaceholder />
      ) : (
        <AnalysisWrapper transactions={transactions} />
      )}
    </section>
  );
}

// Split into a separate async function so the isPro branch doesn't hit the API
async function AnalysisWrapper({ transactions }: { transactions: BankTxInput[] }) {
  const data = await analyzeBankStatement(transactions);

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        No expense transactions found to analyze.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <AnalysisContent data={data} />
    </div>
  );
}
