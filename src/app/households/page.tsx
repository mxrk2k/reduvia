import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/stripe";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUserHousehold, getHouseholdBudgets } from "@/app/actions/household";
import { getUserPreferences } from "@/app/actions/user-preferences";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { CreateHouseholdForm } from "./_components/create-household-form";
import { HouseholdView } from "./_components/household-view";

export const metadata = { title: "Household Budgets — Reduvia" };

export default async function HouseholdsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [isPro, household, preferences] = await Promise.all([
    isProUser(user.id),
    getUserHousehold(),
    getUserPreferences(),
  ]);

  const currency = preferences?.preferred_currency ?? DEFAULT_CURRENCY;

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
            <h1 className="text-base font-semibold sm:text-lg">Households</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 pt-8">
        {/* Page title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight">
            Household Budgets
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share budgets with family or housemates. Combined spending from all
            members counts toward each shared limit.
          </p>
        </div>

        {/* Pro gate */}
        {!isPro ? (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Lock className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Pro feature</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Upgrade to Pro to create a shared household and track budgets
              together with family or housemates.
            </p>
            <Link
              href="/pricing"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Upgrade to Pro
            </Link>
          </div>
        ) : household ? (
          /* User already has a household — show the household view */
          <HouseholdViewWithBudgets
            household={household}
            currentUserId={user.id}
            currency={currency}
          />
        ) : (
          /* No household yet — show the create form */
          <CreateHouseholdForm />
        )}
      </main>
    </div>
  );
}

// ── Async wrapper so we can fetch budgets server-side ─────────────────────────

async function HouseholdViewWithBudgets({
  household,
  currentUserId,
  currency,
}: {
  household: Awaited<ReturnType<typeof getUserHousehold>>;
  currentUserId: string;
  currency: string;
}) {
  if (!household) return null;

  const budgetsResult = await getHouseholdBudgets(household.id);
  const budgets =
    "data" in budgetsResult && budgetsResult.data ? budgetsResult.data : [];

  return (
    <HouseholdView
      household={household}
      budgets={budgets}
      currentUserId={currentUserId}
      currency={currency}
    />
  );
}
