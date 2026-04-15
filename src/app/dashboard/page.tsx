import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Separator } from "@/components/ui/separator";
import { SummaryCards } from "./_components/summary-cards";
import { SpendingChart } from "./_components/spending-chart";
import { TransactionSection } from "./_components/transaction-section";
import { LogoutButton } from "./_components/logout-button";
import { DueSoon } from "./_components/due-soon";
import { HamburgerMenu } from "./_components/hamburger-menu";
import { OnboardingPopup } from "./_components/onboarding-popup";
import { ThemeToggle } from "@/components/theme-toggle";
import { DownloadAppButton } from "./_components/download-app-dialog";
import { InsightsCard } from "@/components/insights-card";
import { NaturalLanguageSearch } from "@/components/natural-language-search";
import { getBankAccounts } from "@/app/actions/bank-statements";
import { getUserPreferences } from "@/app/actions/user-preferences";
import { isProUser } from "@/lib/stripe";
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

  // Bank accounts (for hamburger menu + onboarding check) + Pro status
  const [bankAccounts, preferences, isPro] = await Promise.all([
    getBankAccounts(),
    getUserPreferences(),
    isProUser(user.id),
  ]);

  const txList  = (transactions  ?? []) as Transaction[];
  const dueSoon = (dueSoonRaw    ?? []) as Transaction[];

  // Show onboarding popup if user has no bank accounts and hasn't dismissed it
  const showOnboarding =
    bankAccounts.length === 0 && preferences?.dismiss_import_prompt !== true;

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <HamburgerMenu bankAccounts={bankAccounts} />
            <h1 className="truncate text-base font-semibold sm:text-lg">Finance Tracker</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/budgets"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0 flex items-center"
            >
              Budgets
            </Link>
            <DownloadAppButton />
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

        {/* AI spending insights — Pro only, streamed in via Suspense */}
        {isPro && (
          <Suspense fallback={null}>
            <InsightsCard />
          </Suspense>
        )}

        {/* Summary cards */}
        <SummaryCards transactions={txList} />

        {/* Spending breakdown */}
        <SpendingChart transactions={txList} />

        <Separator />

        {/* AI natural language search */}
        <NaturalLanguageSearch isPro={isPro} transactions={txList} />

        {/* Transactions section */}
        <TransactionSection transactions={txList} />
      </main>

      {/* Onboarding popup — client component, only mounts when needed */}
      <OnboardingPopup initialShow={showOnboarding} />
    </div>
  );
}
