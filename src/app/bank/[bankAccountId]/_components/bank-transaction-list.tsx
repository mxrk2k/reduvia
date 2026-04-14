"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  clean_description: string | null;
  amount: number;
  type: "income" | "expense";
  category: string | null;
}

interface BankTransactionListProps {
  transactions: BankTransaction[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  housing:       "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  food:          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  transport:     "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  entertainment: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  health:        "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  education:     "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  shopping:      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  utilities:     "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
  salary:        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  freelance:     "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  investment:    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  other:         "bg-muted text-muted-foreground",
};

const PAGE_SIZE = 25;

// ── Component ─────────────────────────────────────────────────────────────────

export function BankTransactionList({ transactions }: BankTransactionListProps) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visible = transactions.slice(0, page * PAGE_SIZE);
  const hasMore = transactions.length > page * PAGE_SIZE;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="divide-y rounded-lg border">
        {visible.map((t) => {
          const isExpanded = expanded.has(t.id);
          const label = t.clean_description || t.description;
          const hasRaw =
            t.clean_description && t.clean_description !== t.description;
          const catClass =
            CATEGORY_COLORS[t.category ?? "other"] ?? CATEGORY_COLORS.other;

          return (
            <div key={t.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Type dot */}
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    t.type === "income" ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />

                {/* Description + meta */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {t.category && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${catClass}`}
                      >
                        {t.category}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(t.date)}
                    </span>
                    {hasRaw && (
                      <button
                        onClick={() => toggleExpand(t.id)}
                        className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={isExpanded ? "Hide original" : "Show original"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        original
                      </button>
                    )}
                  </div>
                  {isExpanded && hasRaw && (
                    <p className="mt-1 text-xs text-muted-foreground font-mono">
                      {t.description}
                    </p>
                  )}
                </div>

                {/* Amount */}
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    t.type === "income"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {t.type === "income" ? "+" : "-"}
                  {formatCurrency(Number(t.amount))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setPage((p) => p + 1)}
        >
          Load more ({transactions.length - page * PAGE_SIZE} remaining)
        </Button>
      )}
    </div>
  );
}
