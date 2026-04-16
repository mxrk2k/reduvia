"use server";

import { createClient } from "@/lib/supabase/server";
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserPreferences {
  dismiss_import_prompt: boolean;
  preferred_currency: string;
  onboarding_completed: boolean;
}

// ── getUserPreferences ─────────────────────────────────────────────────────────

export async function getUserPreferences(): Promise<UserPreferences | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data } = await supabase
    .from("user_preferences")
    .select("dismiss_import_prompt, preferred_currency, onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ?? null;
}

// ── dismissImportPrompt ───────────────────────────────────────────────────────

export async function dismissImportPrompt(): Promise<{ error: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      dismiss_import_prompt: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: error.message };
  return null;
}

// ── updateUserCurrency ────────────────────────────────────────────────────────

export async function updateUserCurrency(
  currency: string
): Promise<{ error: string } | null> {
  // Validate against the supported list
  const valid = SUPPORTED_CURRENCIES.some((c) => c.code === currency);
  if (!valid) return { error: "Unsupported currency." };

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      preferred_currency: currency,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: error.message };
  return null;
}

// ── completeOnboarding ────────────────────────────────────────────────────────

export async function completeOnboarding(): Promise<{ error: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: error.message };
  return null;
}

// ── getPreferredCurrency ──────────────────────────────────────────────────────

/** Lightweight helper — returns just the currency code (defaults to USD). */
export async function getPreferredCurrency(): Promise<string> {
  const prefs = await getUserPreferences();
  return prefs?.preferred_currency ?? DEFAULT_CURRENCY;
}
