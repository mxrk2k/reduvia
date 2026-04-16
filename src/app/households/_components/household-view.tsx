"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Crown,
  LogOut,
  Shield,
} from "lucide-react";
import { leaveHousehold } from "@/app/actions/household";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InviteDialog } from "./invite-dialog";
import { UpsertBudgetDialog } from "./upsert-budget-dialog";
import type { Household, HouseholdBudgetWithSpending } from "@/app/actions/household";

interface HouseholdViewProps {
  household: Household;
  budgets: HouseholdBudgetWithSpending[];
  currentUserId: string;
  currency: string;
}

function ProgressBar({
  spent,
  limit,
}: {
  spent: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const over = spent > limit;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${
          over ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function HouseholdView({
  household,
  budgets,
  currentUserId,
  currency,
}: HouseholdViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const isOwner = household.members.find(
    (m) => m.user_id === currentUserId
  )?.role === "owner";

  const usedCategories = budgets.map((b) => b.category);

  function handleLeave() {
    if (!confirm("Are you sure you want to leave this household?")) return;
    setLeaveError(null);
    startTransition(async () => {
      const result = await leaveHousehold(household.id);
      if ("error" in result && result.error) {
        setLeaveError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* Household header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{household.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {household.members.length}{" "}
            {household.members.length === 1 ? "member" : "members"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && <InviteDialog householdId={household.id} />}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={handleLeave}
            disabled={isPending}
          >
            <LogOut className="h-4 w-4" />
            Leave
          </Button>
        </div>
      </div>

      {leaveError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          {leaveError}
        </p>
      )}

      {/* Members */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Members</h3>
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {household.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Avatar */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {member.email.charAt(0).toUpperCase()}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {formatDate(member.joined_at)}
                  </p>
                </div>

                {/* Role badge */}
                {member.role === "owner" ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  >
                    <Crown className="h-3 w-3" />
                    Owner
                  </Badge>
                ) : (
                  <Badge variant="secondary">Member</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Shared Budgets */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Shared Budgets</h3>
            <p className="text-xs text-muted-foreground">
              Combined spending from all members this month
            </p>
          </div>
          <UpsertBudgetDialog
            householdId={household.id}
            usedCategories={usedCategories}
            currency={currency}
          />
        </div>

        {budgets.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No shared budgets yet. Add one to start tracking together.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {budgets.map((budget) => {
              const percentage =
                budget.amount > 0
                  ? Math.round((budget.spent / budget.amount) * 100)
                  : 0;
              const over = budget.spent > budget.amount;

              return (
                <Card key={budget.id}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-medium capitalize">
                        {budget.category}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            over
                              ? "text-destructive"
                              : percentage > 80
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {percentage}%
                        </span>
                        <UpsertBudgetDialog
                          householdId={household.id}
                          existing={{ category: budget.category, amount: budget.amount }}
                          currency={currency}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    <ProgressBar spent={budget.spent} limit={budget.amount} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {formatCurrency(budget.spent, currency)}{" "}
                        <span className="opacity-60">
                          of {formatCurrency(budget.amount, currency)} spent
                        </span>
                      </span>
                      {over && (
                        <span className="font-medium text-destructive">
                          {formatCurrency(budget.spent - budget.amount, currency)} over
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
