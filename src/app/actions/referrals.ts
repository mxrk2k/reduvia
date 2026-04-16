"use server";

import { createClient } from "@/lib/supabase/server";
import { randomReferralCode } from "@/lib/referral-utils";

export { randomReferralCode };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReferralStats {
  code: string | null;
  /** People who have actually signed up using this user's code. */
  invited: number;
  /** How many of those signups completed (same as invited in 1:1 model). */
  completed: number;
}

// ── generateReferralCode ──────────────────────────────────────────────────────

export async function generateReferralCode(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  // Return existing code if the user already has one.
  const { data: pref } = await supabase
    .from("user_preferences")
    .select("referral_code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (pref?.referral_code) return pref.referral_code as string;

  // Generate a unique code (retry up to 5 times on collision).
  let code = randomReferralCode();
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabase
      .from("referrals")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!clash) break;
    code = randomReferralCode();
  }

  // Persist to user_preferences and create the pending referrals row.
  await supabase.from("user_preferences").upsert(
    { user_id: user.id, referral_code: code, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  await supabase.from("referrals").insert({
    referrer_id: user.id,
    referral_code: code,
    status: "pending",
  });

  return code;
}

// ── getReferralStats ──────────────────────────────────────────────────────────

export async function getReferralStats(): Promise<ReferralStats | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const [{ data: pref }, { data: rows }] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("referral_code")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("referrals")
      .select("status, referred_id")
      .eq("referrer_id", user.id),
  ]);

  const code = (pref?.referral_code as string | null) ?? null;
  const referrals = rows ?? [];

  // Only count rows where someone actually signed up (referred_id is set).
  const invited   = referrals.filter((r) => r.referred_id !== null).length;
  const completed = referrals.filter((r) => r.status === "completed").length;

  return { code, invited, completed };
}

// ── applyReferralCode ─────────────────────────────────────────────────────────

export async function applyReferralCode(
  code: string
): Promise<{ error: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  const { error } = await supabase
    .from("referrals")
    .update({
      referred_id: user.id,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("referral_code", code)
    .is("referred_id", null)
    .neq("referrer_id", user.id);

  if (error) return { error: error.message };
  return null;
}
