"use server";

import { createClient } from "@/lib/supabase/server";
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currencies";
import { getRedis } from "@/lib/redis";

const PREFERENCES_TTL = 60 * 5; // 5 minutes

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

  const redis = getRedis();
  const cacheKey = `user:preferences:${user.id}`;

  if (redis) {
    const cached = await redis.get<UserPreferences>(cacheKey);
    if (cached) return cached;
  }

  const { data } = await supabase
    .from("user_preferences")
    .select("dismiss_import_prompt, preferred_currency, onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (redis && data) {
    await redis.set(cacheKey, data, { ex: PREFERENCES_TTL });
  }

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

  const redis = getRedis();
  if (redis) await redis.del(`user:preferences:${user.id}`);

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
