-- ── referral_code in user_preferences ─────────────────────────────────────────

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- ── referrals ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referrals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code text        NOT NULL UNIQUE,
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx  ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referral_code_idx ON public.referrals (referral_code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users see their own referrals (as referrer or referred), plus any unclaimed
-- referral so they can look one up by code when applying it.
CREATE POLICY "Users can view own or pending referrals"
  ON public.referrals FOR SELECT
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR referred_id IS NULL);

-- Users can create a referral entry where they are the referrer.
CREATE POLICY "Users can create own referral entry"
  ON public.referrals FOR INSERT
  WITH CHECK (referrer_id = auth.uid());

-- Any authenticated user can claim an unclaimed referral that isn't their own.
CREATE POLICY "Users can claim pending referrals"
  ON public.referrals FOR UPDATE
  USING  (referred_id IS NULL AND referrer_id != auth.uid())
  WITH CHECK (referred_id = auth.uid() AND status = 'completed');
