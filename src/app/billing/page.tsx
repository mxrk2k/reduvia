import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, CreditCard, AlertCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createPortalSession } from "@/app/actions/stripe";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <Check className="h-3 w-3" />
        Active
      </span>
    );
  }
  if (status === "past_due") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
        <AlertCircle className="h-3 w-3" />
        Past Due
      </span>
    );
  }
  if (status === "canceled") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <Clock className="h-3 w-3" />
        Canceled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground capitalize">
      {status}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BillingPage() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select(
      "subscription_tier, subscription_status, stripe_subscription_id, stripe_customer_id"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const tier   = (prefs?.subscription_tier   as string | undefined) ?? "free";
  const status = (prefs?.subscription_status as string | undefined) ?? "inactive";
  const hasCustomer = Boolean(prefs?.stripe_customer_id);
  const isPro  = tier === "pro" && status === "active";

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/dashboard" className="text-base font-semibold">
            Reduvia
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Manage your subscription and billing details.
        </p>

        {isPro ? (
          /* ── Pro card ─────────────────────────────────────────────────── */
          <div className="rounded-2xl border-2 border-primary bg-background p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Plan
                </p>
                <p className="mt-1 text-2xl font-bold">Pro</p>
                <p className="mt-0.5 text-sm text-muted-foreground">$7.99 / month</p>
              </div>
              <div className="mt-1">
                <StatusBadge status={status} />
              </div>
            </div>

            <ul className="mt-6 space-y-2 border-t pt-6 text-sm text-muted-foreground">
              {[
                "Unlimited budgets",
                "PDF bank statement import (AI-powered)",
                "Recurring transactions",
                "Advanced analytics",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>

            {hasCustomer && (
              <div className="mt-8 space-y-3">
                <form action={createPortalSession}>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <CreditCard className="h-4 w-4" />
                    Manage Subscription
                  </button>
                </form>
                <p className="text-center text-xs text-muted-foreground">
                  Update your payment method or cancel your subscription in the
                  Stripe customer portal.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── Free card ────────────────────────────────────────────────── */
          <div className="rounded-2xl border bg-background p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Plan
                </p>
                <p className="mt-1 text-2xl font-bold">Free</p>
                <p className="mt-0.5 text-sm text-muted-foreground">No charge</p>
              </div>
              {/* Show past_due / canceled badge if they have a lapsed subscription */}
              {status !== "inactive" && (
                <div className="mt-1">
                  <StatusBadge status={status} />
                </div>
              )}
            </div>

            <p className="mt-6 border-t pt-6 text-sm text-muted-foreground">
              You&apos;re on the Free plan. Upgrade to Pro to unlock unlimited
              budgets, AI-powered bank statement import, recurring transactions,
              and advanced analytics.
            </p>

            <div className="mt-6">
              <Link
                href="/pricing"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Upgrade to Pro — $7.99/month
              </Link>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Questions?{" "}
          <a
            href="mailto:markmelds@gmail.com"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Contact support
          </a>
        </p>
      </main>
    </div>
  );
}
