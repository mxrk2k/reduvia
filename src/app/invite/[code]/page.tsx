"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    // Store the referral code in a short-lived cookie so the auth callback
    // can read it after the user completes Google OAuth or email signup.
    document.cookie = `ref=${encodeURIComponent(code)}; path=/; max-age=3600; SameSite=Lax`;
    router.replace("/signup");
  }, [code, router]);

  return null;
}
