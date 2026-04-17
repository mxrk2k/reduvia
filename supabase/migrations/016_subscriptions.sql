-- ── subscriptions ──────────────────────────────────────────────────────────────
-- User-facing subscription tracker (distinct from Stripe billing in user_preferences)

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  amount            numeric     NOT NULL CHECK (amount >= 0),
  billing_cycle     text        NOT NULL CHECK (billing_cycle IN ('weekly', 'monthly', 'yearly')),
  next_billing_date date        NOT NULL,
  category          text        NOT NULL DEFAULT 'Other',
  is_active         boolean     NOT NULL DEFAULT true,
  auto_detected     boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_next_billing_date_idx ON public.subscriptions (user_id, next_billing_date);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own subscriptions"
  ON public.subscriptions FOR DELETE
  USING (user_id = auth.uid());
