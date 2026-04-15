-- ── preferred_currency on user_preferences ────────────────────────────────────
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'USD';
