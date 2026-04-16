"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Sparkles, Lock, X, Loader2 } from "lucide-react";

import { naturalLanguageSearch, type NLSearchResult } from "@/app/actions/insights";
import { TransactionList } from "@/app/dashboard/_components/transaction-list";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/types";

interface Props {
  isPro: boolean;
  transactions: Transaction[];
  currency?: string;
}

export function NaturalLanguageSearch({ isPro, transactions, currency = "USD" }: Props) {
  const [query, setQuery]     = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<NLSearchResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || !isPro) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await naturalLanguageSearch(q, transactions);
      setResult(res);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setQuery("");
    setResult(null);
    setError(null);
  }

  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h3 className="text-sm font-semibold">AI Search</h3>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          Pro
        </span>
      </div>

      {/* Input area — lock overlay for free users */}
      <div className="relative">
        <form onSubmit={handleSearch} className={!isPro ? "pointer-events-none select-none" : ""}>
          <div className="relative flex gap-2">
            {/* Sparkle icon inside input */}
            <div className="relative flex-1">
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Try: "all subscriptions last month", "biggest expenses in March"…'
                className="pl-9 pr-9"
                disabled={!isPro || loading}
                aria-label="AI transaction search"
              />
              {/* Clear button */}
              {hasQuery && isPro && !loading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button type="submit" size="sm" disabled={!isPro || !hasQuery || loading} className="shrink-0 min-h-[44px] sm:min-h-0">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </form>

        {/* Lock overlay — free users */}
        {!isPro && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/85 backdrop-blur-[2px]">
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
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Claude's interpretation */}
          <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 dark:border-violet-800/40 dark:bg-violet-950/20">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
            <p className="text-sm text-muted-foreground">{result.interpretation}</p>
          </div>

          {result.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">No matching transactions found</p>
              <p className="mt-1 text-xs text-muted-foreground">Try rephrasing your search.</p>
            </div>
          ) : (
            <TransactionList transactions={result.transactions} currency={currency} />
          )}
        </div>
      )}
    </div>
  );
}
