"use client";

import { useState, useMemo } from "react";
import { Search, X, Download } from "lucide-react";

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

  function exportCSV() {
    const today = new Date();
    const dateStamp = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    const header = ["Date", "Type", "Category", "Description", "Amount"];

    const rows = transactions.map((t) => {
      const date = t.created_at.slice(0, 10);
      const amount = t.type === "income"
        ? Number(t.amount)
        : -Number(t.amount);
      // Wrap any field that contains a comma or quote in double-quotes;
      // escape internal double-quotes by doubling them.
      const escape = (s: string) =>
        /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      return [
        date,
        t.type,
        escape(t.category),
        escape(t.description),
        amount.toFixed(2),
      ].join(",");
    });

    const csv  = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);

    const a    = document.createElement("a");
    a.href     = url;
    a.download = `reduvia-transactions-${dateStamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={transactions.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <AddTransactionDialog />
        </div>
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
