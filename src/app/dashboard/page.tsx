import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Separator } from "@/components/ui/separator";
import { SummaryCards } from "./_components/summary-cards";
import { SpendingChart } from "./_components/spending-chart";
import { TransactionList } from "./_components/transaction-list";
import { AddTransactionDialog } from "./_components/add-transaction-dialog";
import { LogoutButton } from "./_components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Transaction } from "@/types";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const txList = (transactions ?? []) as Transaction[];

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <h1 className="text-lg font-semibold">Finance Tracker</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/budgets"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Budgets
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-4xl space-y-6 p-4 pt-6">
        {/* Greeting */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        {/* Summary cards */}
        <SummaryCards transactions={txList} />

        {/* Spending breakdown */}
        <SpendingChart transactions={txList} />

        <Separator />

        {/* Transactions section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Transactions</h3>
              <p className="text-sm text-muted-foreground">
                {txList.length} transaction{txList.length !== 1 ? "s" : ""}
              </p>
            </div>
            <AddTransactionDialog />
          </div>

          <TransactionList transactions={txList} />
        </div>
      </main>
    </div>
  );
}
