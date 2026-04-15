import { TriangleAlert, Sparkles } from "lucide-react";
import { getSpendingAnomalies } from "@/app/actions/insights";
import { formatCurrency } from "@/lib/formatters";

interface InsightsCardProps {
  currency: string;
}

export async function InsightsCard({ currency }: InsightsCardProps) {
  const anomalies = await getSpendingAnomalies();

  if (anomalies.length === 0) return null;

  return (
    <section aria-label="Spending insights">
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold">Spending Insights</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          AI
        </span>
      </div>

      <div className="space-y-2">
        {anomalies.map((a) => (
          <div
            key={a.category}
            className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20"
          >
            {/* Warning icon */}
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />

            {/* Insight text + meta */}
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{a.insight}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {formatCurrency(a.currentAmount, currency)} this month
                <span className="mx-1.5 opacity-40">·</span>
                {formatCurrency(a.averageAmount, currency)} avg last 3 months
              </p>
            </div>

            {/* Percentage badge */}
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              +{a.percentageIncrease}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
