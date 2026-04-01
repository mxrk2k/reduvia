"use client";

import { Card, CardContent } from "@/components/ui/card";
import { DeleteBudgetButton } from "./delete-budget-button";
import { formatCurrency } from "@/lib/formatters";
import type { BudgetWithSpending } from "@/types";

type PaceStatus = "on-track" | "careful" | "warning" | "alert" | "exhausted";

interface PaceInfo {
  status: PaceStatus;
  paceRatio: number;
  barColor: string;
  statusLabel: string;
  statusColor: string;
  advisory: string | null;
}

function getPaceInfo(spent: number, limit: number): PaceInfo {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const expectedSpent = (limit / 30) * dayOfMonth;
  const paceRatio = expectedSpent > 0 ? spent / expectedSpent : 0;
  const monthProgress = Math.round((dayOfMonth / 30) * 100);

  if (spent >= limit) {
    return {
      status: "exhausted",
      paceRatio,
      barColor: "bg-destructive",
      statusLabel: "Exhausted",
      statusColor: "text-destructive",
      advisory: "Budget exhausted. No more spending in this category.",
    };
  }

  if (paceRatio > 1.3) {
    const dailyRate = dayOfMonth > 0 ? spent / dayOfMonth : 0;
    let advisory: string;
    if (dailyRate > 0) {
      const remaining = limit - spent;
      const daysLeft = remaining / dailyRate;
      const exhaustionDate = new Date(now);
      exhaustionDate.setDate(now.getDate() + Math.floor(daysLeft));
      const formatted = exhaustionDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      advisory = `At this pace you'll exhaust your budget by ${formatted}. Reduce spending immediately.`;
    } else {
      advisory = "Spending is significantly ahead of pace. Reduce spending immediately.";
    }
    return {
      status: "alert",
      paceRatio,
      barColor: "bg-destructive",
      statusLabel: "Alert",
      statusColor: "text-destructive",
      advisory,
    };
  }

  if (paceRatio > 1.0) {
    const spentPct = Math.round((spent / limit) * 100);
    return {
      status: "warning",
      paceRatio,
      barColor: "bg-orange-500",
      statusLabel: "Warning",
      statusColor: "text-orange-500",
      advisory: `You've spent ${spentPct}% of your budget but only ${monthProgress}% of the month has passed. Slow down.`,
    };
  }

  if (paceRatio > 0.8) {
    return {
      status: "careful",
      paceRatio,
      barColor: "bg-amber-500",
      statusLabel: "Careful",
      statusColor: "text-amber-500",
      advisory: null,
    };
  }

  return {
    status: "on-track",
    paceRatio,
    barColor: "bg-emerald-500",
    statusLabel: "On track",
    statusColor: "text-emerald-500",
    advisory: null,
  };
}

function ProgressBar({
  spent,
  limit,
  barColor,
}: {
  spent: number;
  limit: number;
  barColor: string;
}) {
  const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${barColor}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function BudgetList({ budgets }: { budgets: BudgetWithSpending[] }) {
  if (budgets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No budgets yet. Add one to start tracking your spending.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {budgets.map((budget) => {
        const percentage =
          budget.monthly_limit > 0
            ? Math.round((budget.spent / budget.monthly_limit) * 100)
            : 0;
        const pace = getPaceInfo(budget.spent, budget.monthly_limit);

        return (
          <Card key={budget.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize">{budget.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(budget.spent)} of{" "}
                    {formatCurrency(budget.monthly_limit)} spent
                    <span className={`ml-2 font-medium ${pace.statusColor}`}>
                      · {pace.statusLabel}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold tabular-nums ${pace.statusColor}`}
                  >
                    {percentage}%
                  </span>
                  <DeleteBudgetButton budgetId={budget.id} />
                </div>
              </div>
              <ProgressBar
                spent={budget.spent}
                limit={budget.monthly_limit}
                barColor={pace.barColor}
              />
              {pace.advisory && (
                <p className={`text-xs ${pace.statusColor}`}>
                  {pace.advisory}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
