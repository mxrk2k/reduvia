"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat2, RefreshCw } from "lucide-react";

import { processRecurringTransactions } from "@/app/actions/transactions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Transaction } from "@/types";

interface DueSoonProps {
  transactions: Transaction[];
}

export function DueSoon({ transactions }: DueSoonProps) {
  const [processing, setProcessing] = useState(false);
  const router = useRouter();

  if (transactions.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const hasOverdue = transactions.some(
    (t) => t.next_due_date && t.next_due_date <= todayStr
  );

  async function handleProcess() {
    setProcessing(true);
    await processRecurringTransactions();
    router.refresh();
    setProcessing(false);
  }

  return (
    <Card className="border-amber-300 dark:border-amber-800/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Repeat2 className="h-4 w-4 text-amber-500" />
            Recurring — Due Soon
          </CardTitle>
          {hasOverdue && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleProcess}
              disabled={processing}
              className="min-h-[44px] text-xs sm:min-h-0 sm:h-8"
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${processing ? "animate-spin" : ""}`}
              />
              {processing ? "Processing…" : "Process Due Transactions"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-1.5">
        {transactions.map((t) => {
          const isOverdue = !!t.next_due_date && t.next_due_date < todayStr;
          const isDueToday = t.next_due_date === todayStr;

          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-md px-3 py-2 ${
                isOverdue || isDueToday
                  ? "bg-amber-50/60 dark:bg-amber-950/25"
                  : ""
              }`}
            >
              {/* Income / expense dot */}
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
                    {isDueToday
                      ? "Due today"
                      : isOverdue
                      ? `Overdue since ${formatDate(t.next_due_date!)}`
                      : `Due ${formatDate(t.next_due_date!)}`}
                  </span>
                  {isOverdue && (
                    <Badge variant="destructive" className="text-xs">
                      Overdue
                    </Badge>
                  )}
                  {isDueToday && (
                    <Badge className="bg-amber-500 text-white text-xs hover:bg-amber-500">
                      Today
                    </Badge>
                  )}
                </div>
              </div>

              {/* Frequency + amount */}
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className="hidden gap-1 text-xs capitalize text-muted-foreground sm:flex"
                >
                  <Repeat2 className="h-3 w-3" />
                  {t.recurring_frequency}
                </Badge>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    t.type === "income" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {t.type === "income" ? "+" : "−"}
                  {formatCurrency(Number(t.amount))}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
