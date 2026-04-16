-- ── custom_categories ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_categories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  type       text        NOT NULL CHECK (type IN ('income', 'expense')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name, type)
);

CREATE INDEX IF NOT EXISTS custom_categories_user_id_idx ON public.custom_categories (user_id);

ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom categories"
  ON public.custom_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom categories"
  ON public.custom_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom categories"
  ON public.custom_categories FOR DELETE
  USING (auth.uid() = user_id);
