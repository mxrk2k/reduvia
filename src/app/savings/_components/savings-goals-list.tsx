"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Target, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateSavingsGoalAmount, deleteSavingsGoal } from "@/app/actions/savings-goals";
import type { SavingsGoal } from "@/app/actions/savings-goals";

// ── Progress Bar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width:           `${Math.min(pct, 100)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

// ── Add Money Dialog ───────────────────────────────────────────────────────────

function AddMoneyDialog({ goal }: { goal: SavingsGoal }) {
  const [open, setOpen]   = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const remaining = goal.target_amount - goal.current_amount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return setError("Enter a valid amount");
    if (amt > remaining) return setError(`Max you can add is $${remaining.toFixed(2)}`);

    setSaving(true);
    const result = await updateSavingsGoalAmount(goal.id, amt);
    setSaving(false);

    if (result?.error) return setError(result.error);
    setAmount("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) { setAmount(""); setError(null); }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] sm:min-h-0"
            disabled={goal.current_amount >= goal.target_amount}
          />
        }
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add Money
      </DialogTrigger>

      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Add to &ldquo;{goal.name}&rdquo;</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="add-amount">
              Amount to add ($)
            </label>
            <Input
              id="add-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={remaining}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              ${remaining.toFixed(2)} remaining to reach goal
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? "Saving…" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Goal Card ──────────────────────────────────────────────────────────────────

function GoalCard({ goal }: { goal: SavingsGoal }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const pct       = goal.target_amount > 0
    ? Math.round((goal.current_amount / goal.target_amount) * 100)
    : 0;
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const complete  = goal.current_amount >= goal.target_amount;

  async function handleDelete() {
    if (!confirm(`Delete "${goal.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await deleteSavingsGoal(goal.id);
    router.refresh();
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const targetDateLabel = goal.target_date
    ? new Date(goal.target_date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day:   "numeric",
        year:  "numeric",
      })
    : null;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-3 w-3 shrink-0 rounded-full mt-0.5"
            style={{ backgroundColor: goal.color }}
          />
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{goal.name}</h3>
            {targetDateLabel && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 shrink-0" />
                {targetDateLabel}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {complete && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Complete!
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete goal"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar pct={pct} color={goal.color} />

      {/* Stats row */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Saved</p>
          <p className="text-base font-bold tabular-nums">
            {fmt(goal.current_amount)}
          </p>
        </div>
        <div className="text-center">
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: complete ? "#059669" : goal.color }}
          >
            {pct}%
          </p>
          <p className="text-xs text-muted-foreground">complete</p>
        </div>
        <div className="space-y-0.5 text-right">
          <p className="text-xs text-muted-foreground">Target</p>
          <p className="text-base font-bold tabular-nums">
            {fmt(goal.target_amount)}
          </p>
        </div>
      </div>

      {/* Amount remaining + CTA */}
      {!complete && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{fmt(remaining)}</span>{" "}
            to go
          </p>
          <AddMoneyDialog goal={goal} />
        </div>
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
      <Target className="mb-3 h-10 w-10 text-muted-foreground/40" />
      <p className="font-medium text-muted-foreground">No savings goals yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Create your first goal to start tracking your progress.
      </p>
    </div>
  );
}

// ── List ───────────────────────────────────────────────────────────────────────

export function SavingsGoalsList({ goals }: { goals: SavingsGoal[] }) {
  if (goals.length === 0) return <EmptyState />;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {goals.map((goal) => (
        <GoalCard key={goal.id} goal={goal} />
      ))}
    </div>
  );
}
