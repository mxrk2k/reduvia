"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddTransactionDialog } from "./add-transaction-dialog";
import { TransactionList } from "./transaction-list";
import type { Transaction } from "@/types";

export function TransactionSection({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const [search, setSearch]               = useState("");
  const [typeFilter, setTypeFilter]       = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Unique categories derived from all transactions, alphabetically sorted
  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const t of transactions) seen.add(t.category);
    return Array.from(seen).sort();
  }, [transactions]);

  // Client-side filtering — no server round trips
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (
        q &&
        !t.description.toLowerCase().includes(q) &&
        !t.category.toLowerCase().includes(q)
      )
        return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter)
        return false;
      return true;
    });
  }, [transactions, search, typeFilter, categoryFilter]);

  const isFiltered =
    search.trim() !== "" || typeFilter !== "all" || categoryFilter !== "all";

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setCategoryFilter("all");
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Transactions</h3>
          <p className="text-sm text-muted-foreground">
            {isFiltered
              ? `Showing ${filtered.length} of ${transactions.length} transactions`
              : `${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <AddTransactionDialog />
      </div>

      {/* Filter controls */}
      {transactions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Text search */}
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by description or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Type filter */}
          <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income only</SelectItem>
              <SelectItem value="expense">Expense only</SelectItem>
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear — only shown when a filter is active */}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              <X className="mr-1.5 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Results */}
      {isFiltered && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            No transactions match your search
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your filters.
          </p>
        </div>
      ) : (
        <TransactionList transactions={filtered} />
      )}
    </div>
  );
}
