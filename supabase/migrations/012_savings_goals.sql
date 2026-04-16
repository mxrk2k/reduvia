-- ── savings_goals ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.savings_goals (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  target_amount  numeric(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date    date,
  color          text        NOT NULL DEFAULT '#7c3aed',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS savings_goals_user_id_idx ON public.savings_goals (user_id);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own savings goals"
  ON public.savings_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings goals"
  ON public.savings_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings goals"
  ON public.savings_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings goals"
  ON public.savings_goals FOR DELETE
  USING (auth.uid() = user_id);
