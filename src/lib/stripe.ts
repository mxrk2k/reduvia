/**
 * src/lib/stripe.ts
 *
 * Server-side Stripe helpers.
 * Import only in Server Components, Server Actions, and API Routes.
 */

import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

// ── Client ────────────────────────────────────────────────────────────────────

export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

// ── Subscription check ────────────────────────────────────────────────────────

/**
 * Returns true only when the user has an active Pro subscription.
 * Safe to call from any server context — creates its own Supabase client.
 */
export async function isProUser(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("subscription_tier, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  return (
    data?.subscription_tier === "pro" &&
    data?.subscription_status === "active"
  );
}
