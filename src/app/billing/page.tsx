import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createPortalSession } from "@/app/actions/stripe";

function statusLabel(status: string): { text: string; className: string } {
  if (status === "active")   return { text: "Active",   className: "text-emerald-600 dark:text-emerald-400" };
  if (status === "past_due") return { text: "Past Due",  className: "text-amber-600  dark:text-amber-400"  };
  return                            { text: "Inactive",  className: "text-muted-foreground"                 };
}

export default async function BillingPage() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("subscription_tier, subscription_status, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const tier   = (prefs?.subscription_tier   as string | undefined) ?? "free";
  const status = (prefs?.subscription_status as string | undefined) ?? "inactive";
  const hasCustomer = Boolean(prefs?.stripe_customer_id);

  const { text: statusText, className: statusClass } = statusLabel(status);

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/dashboard" className="text-base font-semibold">
            Finance Tracker
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="mb-8 text-3xl font-bold tracking-tight">Billing</h1>

        <div className="rounded-2xl border bg-background p-8 space-y-6">
          {/* Plan */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="mt-0.5 text-xl font-semibold capitalize">{tier}</p>
            </div>
            {tier === "free" && (
              <Link
                href="/pricing"
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Upgrade
              </Link>
            )}
          </div>

          {/* Status */}
          <div>
            <p className="text-sm text-muted-foreground">Subscription Status</p>
            <p className={`mt-0.5 text-base font-medium ${statusClass}`}>
              {statusText}
            </p>
          </div>

          {/* Portal button */}
          {hasCustomer && (
            <form action={createPortalSession}>
              <button
                type="submit"
                className="w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Manage Subscription
              </button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link href="/pricing" className="underline underline-offset-2">
              View Pricing
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
