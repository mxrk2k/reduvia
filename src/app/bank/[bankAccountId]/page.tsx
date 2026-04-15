import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Upload, Building2, Calendar, FileText, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBankAccountAnalysis } from "@/app/actions/bank-statements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatCurrency } from "@/lib/formatters";
import { isProUser } from "@/lib/stripe";
import { BankCharts } from "./_components/bank-charts";
import { BankTransactionList } from "./_components/bank-transaction-list";
import { StatementList } from "./_components/statement-list";
import {
  BankStatementInsights,
  BankStatementInsightsSkeleton,
} from "@/components/bank-statement-insights";

interface PageProps {
  params: { bankAccountId: string };
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

// Link styled to match the project's Button outline/sm variant
const linkBtnSm =
  "inline-flex shrink-0 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-all hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 h-7 gap-1";

// outline default size
const linkBtnDefault =
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium whitespace-nowrap transition-all hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 h-8 gap-1.5";

export default async function BankAccountPage({ params }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let analysis;
  try {
    analysis = await getBankAccountAnalysis(params.bankAccountId);
  } catch {
    notFound();
  }

  const isPro = await isProUser(user.id);

  const { account, statements, summary, monthlyTrends } = analysis;

  // Date range across all statements
  const allDates = statements.flatMap((s) => [s.date_from, s.date_to]).sort();
  const overallFrom = allDates[0];
  const overallTo   = allDates[allDates.length - 1];

  // Total transactions across all statements
  const totalTransactions = statements.reduce(
    (sum, s) => sum + s.transaction_count,
    0
  );

  // Fetch full bank_transactions for this account (for the transaction list)
  const { data: txnsRaw } = await supabase
    .from("bank_transactions")
    .select("id, date, description, clean_description, amount, type, category")
    .eq("bank_account_id", params.bankAccountId)
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  const transactions = (txnsRaw ?? []) as {
    id: string;
    date: string;
    description: string;
    clean_description: string | null;
    amount: number;
    type: "income" | "expense";
    category: string | null;
  }[];

  const balancePositive = summary.balance >= 0;

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <span className="text-muted-foreground/40 hidden sm:inline">/</span>
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {account.bank_name} Analysis
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/import" className={`${linkBtnSm} hidden sm:inline-flex`}>
              <Upload className="h-3.5 w-3.5" />
              Import Statement
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-4xl space-y-6 p-4 pt-6">
        {/* Page title */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{account.bank_name}</h2>
            {account.account_type && (
              <p className="mt-0.5 text-sm text-muted-foreground capitalize">
                {account.account_type}
              </p>
            )}
          </div>
          {/* Desktop */}
          <Link href="/import" className={`${linkBtnSm} hidden sm:inline-flex`}>
            <Upload className="h-3.5 w-3.5" />
            Import Another Statement
          </Link>
          {/* Mobile */}
          <Link href="/import" className={`${linkBtnDefault} sm:hidden w-full justify-center`}>
            <Upload className="h-4 w-4" />
            Import Another Statement
          </Link>
        </div>

        {/* Account details card */}
        <Card>
          <CardContent className="pt-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  Bank
                </div>
                <p className="text-sm font-semibold">{account.bank_name}</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Date Range
                </div>
                <p className="text-sm font-semibold">
                  {overallFrom && overallTo
                    ? formatDateRange(overallFrom, overallTo)
                    : "—"}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  Statements
                </div>
                <p className="text-sm font-semibold">{statements.length}</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Transactions
                </div>
                <p className="text-sm font-semibold tabular-nums">{totalTransactions.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Total Income */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.totalIncome)}
              </p>
            </CardContent>
          </Card>

          {/* Total Expenses */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                {formatCurrency(summary.totalExpenses)}
              </p>
            </CardContent>
          </Card>

          {/* Balance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Net Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  balancePositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {balancePositive ? "+" : ""}
                {formatCurrency(summary.balance)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <BankCharts
          monthlyTrends={monthlyTrends}
          spendingByCategory={summary.spendingByCategory}
          totalExpenses={summary.totalExpenses}
        />

        <Separator />

        {/* Statements imported */}
        {statements.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Imported Statements</h3>
            <StatementList statements={statements} />
          </div>
        )}

        <Separator />

        {/* Transaction list */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              All Transactions
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({transactions.length.toLocaleString()})
              </span>
            </h3>
          </div>
          <BankTransactionList transactions={transactions} />
        </div>

        <Separator />

        {/* AI Analysis — Pro users get live analysis; free users see locked preview */}
        <Suspense fallback={<BankStatementInsightsSkeleton />}>
          <BankStatementInsights transactions={transactions} isPro={isPro} />
        </Suspense>
      </main>
    </div>
  );
}
