"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteStatement } from "@/app/actions/bank-statements";
import { formatCurrency } from "@/lib/formatters";

interface Statement {
  id: string;
  file_name: string;
  date_from: string;
  date_to: string;
  transaction_count: number;
  statement_period: string | null;
  beginning_balance: number | null;
  ending_balance: number | null;
}

interface StatementListProps {
  statements: Statement[];
}

function formatDateRange(from: string, to: string) {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(from)} – ${fmt(to)}`;
}

export function StatementList({ statements }: StatementListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(stmt: Statement) {
    const confirmed = window.confirm(
      `Delete "${stmt.file_name}"?\n\nThis will permanently remove the statement and all ${stmt.transaction_count} associated transactions.`
    );
    if (!confirmed) return;

    setDeletingId(stmt.id);
    startTransition(async () => {
      const result = await deleteStatement(stmt.id);
      setDeletingId(null);
      if (result?.error) {
        alert(`Failed to delete: ${result.error}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="divide-y rounded-lg border">
      {statements.map((s) => {
        const isDeleting = deletingId === s.id && isPending;
        return (
          <div key={s.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.file_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.statement_period ?? formatDateRange(s.date_from, s.date_to)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {s.transaction_count} txns
                </span>
                <button
                  onClick={() => handleDelete(s)}
                  disabled={isPending}
                  aria-label={`Delete statement ${s.file_name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50 sm:h-7 sm:w-7"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            {(s.beginning_balance !== null || s.ending_balance !== null) && (
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                {s.beginning_balance !== null && (
                  <span>
                    Opening:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(s.beginning_balance)}
                    </span>
                  </span>
                )}
                {s.ending_balance !== null && (
                  <span>
                    Closing:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(s.ending_balance)}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
