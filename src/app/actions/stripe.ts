"use server";

import { redirect } from "next/navigation";
import { getStripeClient } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ── createCheckoutSession ─────────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout session for the Pro plan and redirects to it.
 */
export async function createCheckoutSession(): Promise<never> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const stripe = getStripeClient();

  // Get or create stripe_customer_id
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = prefs?.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;

    await supabase.from("user_preferences").upsert(
      { user_id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  }

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    client_reference_id:  user.id,
    mode:                 "subscription",
    line_items:           [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url:          `${APP_URL}/dashboard?upgraded=true`,
    cancel_url:           `${APP_URL}/pricing`,
  });

  redirect(session.url!);
}

// ── createPortalSession ───────────────────────────────────────────────────────

/**
 * Creates a Stripe Customer Portal session and redirects to it.
 */
export async function createPortalSession(): Promise<never> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = prefs?.stripe_customer_id as string | undefined;
  if (!customerId) redirect("/pricing");

  const stripe = getStripeClient();
  const portal = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${APP_URL}/billing`,
  });

  redirect(portal.url);
}
