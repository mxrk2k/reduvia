-- ── households ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.households (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_by uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- ── household_members ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.household_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- ── household_budgets ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.household_budgets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category     text        NOT NULL,
  amount       numeric     NOT NULL CHECK (amount > 0),
  month        text        NOT NULL, -- YYYY-MM format
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, category, month)
);

ALTER TABLE public.household_budgets ENABLE ROW LEVEL SECURITY;

-- ── household_invites ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.household_invites (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  invited_email text        NOT NULL,
  invited_by    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token         uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at   timestamptz
);

ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- ── Security-definer helpers (bypass RLS when called from policies) ────────────
-- These run as the postgres role so they can read household_members
-- without triggering recursive RLS evaluation.

CREATE OR REPLACE FUNCTION public.get_my_household_ids()
RETURNS TABLE(household_id uuid)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_household_owner(p_household_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = p_household_id
      AND user_id = auth.uid()
      AND role = 'owner'
  )
$$;

-- ── RLS: households ────────────────────────────────────────────────────────────

CREATE POLICY "Members can view their household"
  ON public.households FOR SELECT
  USING (id IN (SELECT household_id FROM public.get_my_household_ids()));

CREATE POLICY "Authenticated users can create a household"
  ON public.households FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can update their household"
  ON public.households FOR UPDATE
  USING (public.is_household_owner(id));

CREATE POLICY "Owners can delete their household"
  ON public.households FOR DELETE
  USING (public.is_household_owner(id));

-- ── RLS: household_members ─────────────────────────────────────────────────────
-- Members can see who else is in their household.
-- All writes go through the service role (bootstrap / invite acceptance).

CREATE POLICY "Members can view household members"
  ON public.household_members FOR SELECT
  USING (household_id IN (SELECT household_id FROM public.get_my_household_ids()));

-- Users may remove themselves from a household; owners may remove anyone.
CREATE POLICY "Members can leave; owners can remove members"
  ON public.household_members FOR DELETE
  USING (user_id = auth.uid() OR public.is_household_owner(household_id));

-- ── RLS: household_budgets ─────────────────────────────────────────────────────

CREATE POLICY "Members can view household budgets"
  ON public.household_budgets FOR SELECT
  USING (household_id IN (SELECT household_id FROM public.get_my_household_ids()));

CREATE POLICY "Members can insert household budgets"
  ON public.household_budgets FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM public.get_my_household_ids()));

CREATE POLICY "Members can update household budgets"
  ON public.household_budgets FOR UPDATE
  USING (household_id IN (SELECT household_id FROM public.get_my_household_ids()));

CREATE POLICY "Members can delete household budgets"
  ON public.household_budgets FOR DELETE
  USING (household_id IN (SELECT household_id FROM public.get_my_household_ids()));

-- ── RLS: household_invites ─────────────────────────────────────────────────────

CREATE POLICY "Members can view invites for their household"
  ON public.household_invites FOR SELECT
  USING (household_id IN (SELECT household_id FROM public.get_my_household_ids()));
