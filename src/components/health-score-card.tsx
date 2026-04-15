import { Sparkles } from "lucide-react";
import { getFinancialHealthScore } from "@/app/actions/insights";

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-amber-500";
  return "text-rose-500";
}

function ringColor(score: number): string {
  if (score >= 70) return "border-emerald-400 dark:border-emerald-600";
  if (score >= 40) return "border-amber-400 dark:border-amber-600";
  return "border-rose-400 dark:border-rose-600";
}

function labelColor(score: number): string {
  if (score >= 70) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (score >= 40) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
}

function barColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

interface FactorBarProps {
  label: string;
  score: number;
}

function FactorBar({ label, score }: FactorBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{score}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${barColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export async function HealthScoreCard() {
  const result = await getFinancialHealthScore();

  if (!result) return null;

  const { score, label, factors, explanation } = result;

  return (
    <section aria-label="Financial health score">
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-sky-500" />
        <h2 className="text-sm font-semibold">Financial Health</h2>
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          AI
        </span>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start gap-4">
          {/* Score circle */}
          <div className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 ${ringColor(score)}`}>
            <span className={`text-2xl font-bold leading-none tabular-nums ${scoreColor(score)}`}>
              {score}
            </span>
            <span className="mt-0.5 text-[10px] text-muted-foreground">/ 100</span>
          </div>

          {/* Right column */}
          <div className="min-w-0 flex-1 space-y-2">
            {/* Label */}
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${labelColor(score)}`}>
              {label}
            </span>

            {/* AI explanation */}
            <p className="text-sm leading-snug text-muted-foreground">{explanation}</p>
          </div>
        </div>

        {/* Factor bars */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FactorBar label="Budget Adherence" score={factors.budgetAdherence} />
          <FactorBar label="Savings Rate"      score={factors.savingsRate} />
          <FactorBar label="Income Consistency" score={factors.incomeConsistency} />
          <FactorBar label="Spending Stability" score={factors.spendingStability} />
        </div>
      </div>
    </section>
  );
}
