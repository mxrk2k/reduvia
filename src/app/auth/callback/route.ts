import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureServerEvent } from "@/lib/posthog";
import { sendWelcomeEmail } from "@/app/actions/emails";

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
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
