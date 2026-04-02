import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Separator } from "@/components/ui/separator";
import { SummaryCards } from "./_components/summary-cards";
import { SpendingChart } from "./_components/spending-chart";
import { TransactionSection } from "./_components/transaction-section";
import { LogoutButton } from "./_components/logout-button";
import { DueSoon } from "./_components/due-soon";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Transaction } from "@/types";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // All transactions (for summary + charts)
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Recurring transactions due within the next 7 days
  const today = new Date();
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);

  function fmt(d: Date): string {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const { data: dueSoonRaw } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_recurring", true)
    .lte("next_due_date", fmt(sevenDaysLater))
    .order("next_due_date", { ascending: true });

  const txList  = (transactions  ?? []) as Transaction[];
  const dueSoon = (dueSoonRaw    ?? []) as Transaction[];

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <h1 className="truncate text-base font-semibold sm:text-lg">Finance Tracker</h1>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/budgets"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0 flex items-center"
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

        {/* Due soon — only rendered when there is data */}
        <DueSoon transactions={dueSoon} />

        {/* Summary cards */}
        <SummaryCards transactions={txList} />

        {/* Spending breakdown */}
        <SpendingChart transactions={txList} />

        <Separator />

        {/* Transactions section */}
        <TransactionSection transactions={txList} />
      </main>
    </div>
  );
}
