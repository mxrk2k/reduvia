import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body      = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const secret    = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  const stripe = getStripeClient();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createClient();

  // ── checkout.session.completed ────────────────────────────────────────────

  if (event.type === "checkout.session.completed") {
    const session    = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string;
    const subId      = session.subscription as string;

    await supabase
      .from("user_preferences")
      .update({
        subscription_tier:    "pro",
        subscription_status:  "active",
        stripe_subscription_id: subId,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", customerId);
  }

  // ── customer.subscription.deleted ────────────────────────────────────────

  else if (event.type === "customer.subscription.deleted") {
    const sub        = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;

    await supabase
      .from("user_preferences")
      .update({
        subscription_tier:   "free",
        subscription_status: "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", customerId);
  }

  // ── invoice.payment_failed ────────────────────────────────────────────────

  else if (event.type === "invoice.payment_failed") {
    const invoice    = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;

    await supabase
      .from("user_preferences")
      .update({
        subscription_status: "past_due",
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", customerId);
  }

  return NextResponse.json({ received: true });
}
