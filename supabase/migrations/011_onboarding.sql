-- Add onboarding_completed flag to user_preferences
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
