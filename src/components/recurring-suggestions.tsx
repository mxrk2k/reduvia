"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Repeat2, Check, X, Loader2, Lock, Sparkles } from "lucide-react";
import { addRecurringFromSuggestion } from "@/app/actions/transactions";
import type { RecurringSuggestion } from "@/app/actions/insights";

// ── Helpers ───────────────────────────────────────────────────────────────────


function frequencyLabel(f: RecurringSuggestion["frequency"]): string {
  return { weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" }[f];
}

function confidenceColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 65) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

// ── Per-suggestion card ───────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: RecurringSuggestion;
  onAccepted: (id: string) => void;
  onDismissed: (id: string) => void;
}

function SuggestionCard({ suggestion, onAccepted, onDismissed }: SuggestionCardProps) {
  const [isPending, startTransition]   = useTransition();
  const [justAccepted, setJustAccepted] = useState(false);
  const [error, setError]              = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await addRecurringFromSuggestion(suggestion);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setJustAccepted(true);
      // Brief "Added!" flash, then remove from list
      setTimeout(() => onAccepted(suggestion.id), 900);
    });
  }

  function handleDismiss() {
    onDismissed(suggestion.id);
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-background px-4 py-3 transition-all ${
        justAccepted ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20" : "border-border"
      }`}
    >
      {/* Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
        {justAccepted ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <Repeat2 className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{suggestion.merchant}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">
            ${suggestion.amount.toFixed(2)}
          </span>
          <span className="opacity-40">·</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium">
            {frequencyLabel(suggestion.frequency)}
          </span>
          <span className="opacity-40">·</span>
          <span className="capitalize">{suggestion.category}</span>
          <span className="opacity-40">·</span>
          <span>{suggestion.occurrences}× detected</span>
          <span className="opacity-40">·</span>
          <span className={confidenceColor(suggestion.confidence)}>
            {suggestion.confidence}% confidence
          </span>
        </div>
        {error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </div>

      {/* Actions */}
      {justAccepted ? (
        <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Added!
        </span>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={handleAccept}
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 sm:min-h-0"
            aria-label={`Add ${suggestion.merchant} as recurring`}
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Add
          </button>
          <button
            onClick={handleDismiss}
            disabled={isPending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 sm:h-7 sm:w-7"
            aria-label={`Dismiss ${suggestion.merchant}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  suggestions: RecurringSuggestion[];
  isPro: boolean;
}

export function RecurringSuggestions({ suggestions: initialSuggestions, isPro }: Props) {
  const [visible, setVisible] = useState(
    initialSuggestions.map((s) => s.id)
  );

  if (!isPro) {
    return (
      <div className="relative overflow-hidden rounded-lg border bg-card p-4">
        {/* Blurred placeholder */}
        <div className="select-none space-y-2 blur-sm" aria-hidden>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-muted" />
                <div className="h-2.5 w-48 rounded bg-muted" />
              </div>
              <div className="h-7 w-12 rounded-md bg-muted" />
            </div>
          ))}
        </div>
        {/* Lock overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[3px]">
          <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-sm">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Pro feature</p>
            <Link
              href="/pricing"
              className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Upgrade
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayed = initialSuggestions.filter((s) => visible.includes(s.id));

  if (displayed.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold">Detected Recurring Transactions</h3>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          {displayed.length}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        We found these repeated charges in your statement. Add them as recurring transactions to track them on your dashboard.
      </p>

      {/* Cards */}
      <div className="space-y-2">
        {displayed.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onAccepted={(id) => setVisible((prev) => prev.filter((v) => v !== id))}
            onDismissed={(id) => setVisible((prev) => prev.filter((v) => v !== id))}
          />
        ))}
      </div>
    </div>
  );
}
