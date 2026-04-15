-- ── Subscription columns on user_preferences ─────────────────────────────────
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS subscription_tier       text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text,
  ADD COLUMN IF NOT EXISTS subscription_status     text DEFAULT 'inactive';
