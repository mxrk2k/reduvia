import { TriangleAlert, OctagonAlert, Sparkles } from "lucide-react";
import { getBudgetPredictions } from "@/app/actions/insights";
import { formatCurrency } from "@/lib/formatters";

export async function BudgetPredictionsCard() {
  const predictions = await getBudgetPredictions();

  if (predictions.length === 0) return null;

  return (
    <section aria-label="Budget predictions">
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-rose-500" />
        <h2 className="text-sm font-semibold">Budget Warnings</h2>
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
          AI
        </span>
      </div>

      <div className="space-y-2">
        {predictions.map((p) => {
          const fillPct  = Math.min(100, Math.round((p.currentSpend / p.budgetAmount) * 100));
          const overagePct = Math.round(((p.projectedAmount - p.budgetAmount) / p.budgetAmount) * 100);
          const overage  = p.projectedAmount - p.budgetAmount;

          // Colour theme: rose = already over, orange = on-pace-to-exceed
          const theme = p.alreadyExceeded
            ? {
                border:   "border-rose-200 dark:border-rose-800/40",
                bg:       "bg-rose-50 dark:bg-rose-950/20",
                badge:    "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
                bar:      "bg-rose-500",
                barTrack: "bg-rose-100 dark:bg-rose-900/30",
              }
            : {
                border:   "border-orange-200 dark:border-orange-800/40",
                bg:       "bg-orange-50 dark:bg-orange-950/20",
                badge:    "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
                bar:      "bg-orange-500",
                barTrack: "bg-orange-100 dark:bg-orange-900/30",
              };

          return (
            <div
              key={p.category}
              className={`rounded-lg border p-4 ${theme.border} ${theme.bg}`}
            >
              <div className="flex items-start gap-3">
                {/* Warning icon */}
                {p.alreadyExceeded ? (
                  <OctagonAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                ) : (
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                )}

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-2.5">
                  {/* AI sentence */}
                  <p className="text-sm leading-snug">{p.prediction}</p>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className={`h-1.5 w-full overflow-hidden rounded-full ${theme.barTrack}`}>
                      <div
                        className={`h-full rounded-full transition-all ${theme.bar}`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {formatCurrency(p.currentSpend)}{" "}
                        <span className="opacity-60">of {formatCurrency(p.budgetAmount)}</span>
                      </span>
                      <span>{fillPct}% used</span>
                    </div>
                  </div>
                </div>

                {/* Overage badge */}
                <div className="shrink-0 text-right">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${theme.badge}`}>
                    {p.alreadyExceeded ? "+" : "proj. +"}
                    {formatCurrency(Math.abs(overage))}
                  </span>
                  {!p.alreadyExceeded && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      +{overagePct}% over
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
