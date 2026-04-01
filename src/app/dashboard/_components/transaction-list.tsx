"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Repeat2 } from "lucide-react";

import { deleteTransaction } from "@/app/actions/transactions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/types";

interface TransactionListProps {
  transactions: Transaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteTransaction(id);
    setDeletingId(null);
    if (!result?.error) {
      router.refresh();
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">No transactions yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add your first transaction to get started
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {transactions.map((t) => (
        <div key={t.id} className="flex items-center gap-4 px-4 py-3">
          {/* Type indicator */}
          <div
            className={`h-2 w-2 shrink-0 rounded-full ${
              t.type === "income" ? "bg-emerald-500" : "bg-rose-500"
            }`}
          />

          {/* Description + meta */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{t.description}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs capitalize">
                {t.category}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(t.created_at)}
              </span>
              {t.is_recurring && (
                <Badge
                  variant="outline"
                  className="gap-1 text-xs capitalize text-muted-foreground"
                >
                  <Repeat2 className="h-3 w-3" />
                  {t.recurring_frequency}
                </Badge>
              )}
            </div>
          </div>

          {/* Amount */}
          <span
            className={`shrink-0 text-sm font-semibold tabular-nums ${
              t.type === "income" ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {t.type === "income" ? "+" : "-"}
            {formatCurrency(Number(t.amount))}
          </span>

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            disabled={deletingId === t.id}
            onClick={() => handleDelete(t.id)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete transaction</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
