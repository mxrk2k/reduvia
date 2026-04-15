import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession, createPortalSession } from "@/app/actions/stripe";

const FREE_FEATURES = [
  "Up to 3 budgets",
  "Manual transaction tracking",
  "Spending charts",
  "Dark / light mode",
];

const PRO_FEATURES = [
  "Unlimited budgets",
  "PDF bank statement import (AI-powered)",
  "Recurring transactions",
  "Advanced analytics",
  "Priority support",
  "Everything in Free",
];

async function getSubscriptionTier(userId: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("subscription_tier, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (
    data?.subscription_tier === "pro" &&
    data?.subscription_status === "active"
  ) {
    return "pro";
  }
  return "free";
}

export default async function PricingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tier = user ? await getSubscriptionTier(user.id) : null;
  const isPro = tier === "pro";

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/dashboard" className="text-base font-semibold">
            Finance Tracker
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16">
        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Simple pricing</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Start free. Upgrade when you need more.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col rounded-2xl border bg-background p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Free
              </p>
              <p className="mt-2 text-4xl font-bold">$0</p>
              <p className="mt-1 text-sm text-muted-foreground">Forever</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>

            {user ? (
              <div className="rounded-lg border bg-muted/50 px-4 py-2.5 text-center text-sm font-medium text-muted-foreground">
                {isPro ? "Previous plan" : "Current plan"}
              </div>
            ) : (
              <Link
                href="/signup"
                className="block rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted"
              >
                Get Started
              </Link>
            )}
          </div>

          {/* Pro */}
          <div className="relative flex flex-col rounded-2xl border-2 border-primary bg-background p-8">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Most Popular
              </span>
            </div>

            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pro
              </p>
              <p className="mt-2 text-4xl font-bold">$7.99</p>
              <p className="mt-1 text-sm text-muted-foreground">per month</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>

            {!user ? (
              <Link
                href="/signup"
                className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Get Started
              </Link>
            ) : isPro ? (
              <form action={createPortalSession}>
                <button
                  type="submit"
                  className="w-full rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted"
                >
                  Manage Subscription
                </button>
              </form>
            ) : (
              <form action={createCheckoutSession}>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Upgrade to Pro
                </button>
              </form>
            )}

            {isPro && (
              <p className="mt-3 text-center text-xs text-emerald-600 dark:text-emerald-400">
                ✓ You&apos;re on Pro
              </p>
            )}
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Questions?{" "}
          <Link href="/dashboard" className="underline underline-offset-2">
            Contact us
          </Link>
        </p>
      </main>
    </div>
  );
}
