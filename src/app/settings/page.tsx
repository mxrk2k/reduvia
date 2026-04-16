import Link from "next/link";
import { CreditCard } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { ExportDataButton } from "@/components/export-data-button";
import { CurrencySelector } from "@/components/currency-selector";
import { CustomCategoriesManager } from "@/components/custom-categories-manager";
import { DEFAULT_CURRENCY } from "@/lib/currencies";
import { getCustomCategories } from "@/app/actions/categories";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const [prefsResult, customCategories] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("preferred_currency")
      .eq("user_id", user.id)
      .maybeSingle(),
    getCustomCategories(),
  ]);

  const preferredCurrency =
    (prefsResult.data?.preferred_currency as string | undefined) ?? DEFAULT_CURRENCY;

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Currency */}
      <section className="mt-10">
        <h2 className="mb-1 text-base font-semibold">Currency</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Choose the currency used to display all amounts across the app.
        </p>
        <div className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Display Currency</p>
              <p className="text-xs text-muted-foreground">
                Amounts are displayed in this currency symbol. Exchange rates
                are not applied.
              </p>
            </div>
            <CurrencySelector currentCurrency={preferredCurrency} />
          </div>
        </div>
      </section>

      {/* Custom Categories */}
      <section className="mt-10">
        <h2 className="mb-1 text-base font-semibold">Custom Categories</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Add your own income and expense categories to use when logging transactions.
        </p>
        <div className="rounded-lg border p-4">
          <CustomCategoriesManager initialCategories={customCategories} />
        </div>
      </section>

      {/* Billing */}
      <section className="mt-10">
        <h2 className="mb-1 text-base font-semibold">Billing</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          View your current plan and manage your subscription.
        </p>
        <div className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Subscription &amp; Payments</p>
              <p className="text-xs text-muted-foreground">
                Upgrade to Pro or manage your billing details.
              </p>
            </div>
            <Link
              href="/billing"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted sm:w-auto sm:py-1.5"
            >
              <CreditCard className="h-4 w-4" />
              Manage Billing
            </Link>
          </div>
        </div>
      </section>

      {/* Your Data */}
      <section className="mt-10">
        <h2 className="mb-1 text-base font-semibold">Your Data</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Download a copy of all data associated with your account.
        </p>
        <div className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium">Export your data</p>
              <p className="text-xs text-muted-foreground">
                JSON includes all tables. CSV contains your transactions only.
              </p>
            </div>
            <ExportDataButton />
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="mt-10">
        <h2 className="mb-1 text-base font-semibold text-destructive">
          Danger Zone
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Permanently delete your account and all associated data. This cannot
          be undone.
        </p>
        <div className="rounded-lg border border-destructive/30 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground">
                Removes your account, transactions, budgets, and all other data.
              </p>
            </div>
            <DeleteAccountButton />
          </div>
        </div>
      </section>
    </main>
  );
}
