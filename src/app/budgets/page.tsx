import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/app/dashboard/_components/logout-button";
import { BudgetList } from "./_components/budget-list";
import { AddBudgetDialog } from "./_components/add-budget-dialog";
import type { Budget } from "@/types";

export default async function BudgetsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: budgets } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("category, amount")
    .eq("user_id", user.id)
    .eq("type", "expense")
    .gte("created_at", startOfMonth)
    .lt("created_at", startOfNextMonth);

  const spendingByCategory: Record<string, number> = {};
  for (const tx of transactions ?? []) {
    spendingByCategory[tx.category] =
      (spendingByCategory[tx.category] ?? 0) + tx.amount;
  }

  const budgetList = (budgets ?? []) as Budget[];
  const budgetsWithSpending = budgetList.map((b) => ({
    ...b,
    spent: spendingByCategory[b.category] ?? 0,
  }));

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <h1 className="truncate text-base font-semibold sm:text-lg">Finance Tracker</h1>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0"
            >
              Dashboard
            </Link>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-4 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Budgets</h2>
            <p className="text-sm text-muted-foreground">
              Monthly spending limits for this period
            </p>
          </div>
          <AddBudgetDialog
            existingCategories={budgetList.map((b) => b.category)}
            triggerClassName="w-full min-h-[44px] sm:w-auto sm:min-h-0"
          />
        </div>

        <BudgetList budgets={budgetsWithSpending} />
      </main>
    </div>
  );
}
