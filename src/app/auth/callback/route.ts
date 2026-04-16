import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureServerEvent } from "@/lib/posthog";
import { sendWelcomeEmail } from "@/app/actions/emails";
import { randomReferralCode } from "@/app/actions/referrals";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createClient();
  const { data } = await supabase.auth.exchangeCodeForSession(code);

  if (data.user) {
    // Distinguish new signups from returning logins: if the account was created
    // within the last 60 seconds this is effectively a signup via Google OAuth.
    const ageMs     = Date.now() - new Date(data.user.created_at).getTime();
    const isNewUser = ageMs < 60_000;

    await captureServerEvent(
      data.user.id,
      isNewUser ? "user_signed_up" : "user_logged_in",
      { method: "google" }
    );

    if (isNewUser && data.user.email) {
      await sendWelcomeEmail(
        data.user.email,
        data.user.user_metadata?.full_name ?? null
      );
    }

    if (isNewUser) {
      const cookieStore = cookies();
      const refCode = cookieStore.get("ref")?.value;
      const admin = createAdminClient();

      // Apply referral code if the new user arrived via an invite link.
      if (refCode) {
        await admin
          .from("referrals")
          .update({
            referred_id:  data.user.id,
            status:       "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("referral_code", refCode)
          .is("referred_id", null)
          .neq("referrer_id", data.user.id);

        // Clear the cookie so it doesn't persist across future signups.
        cookieStore.set("ref", "", { path: "/", maxAge: 0 });
      }

      // Auto-generate a referral code for the new user (best-effort).
      try {
        const newCode = randomReferralCode();
        await admin.from("user_preferences").upsert(
          {
            user_id:       data.user.id,
            referral_code: newCode,
            updated_at:    new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        await admin.from("referrals").insert({
          referrer_id:   data.user.id,
          referral_code: newCode,
          status:        "pending",
        });
      } catch {
        // Non-critical — user can generate a code later from the Invite modal.
      }
    }
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
