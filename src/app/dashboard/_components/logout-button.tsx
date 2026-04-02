"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Hard redirect: bypasses Next.js Router cache so the middleware
    // re-evaluates the cleared session cookie on a fresh HTTP request.
    window.location.href = "/login";
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout} className="min-h-[44px] sm:min-h-0">
      <LogOut className="h-4 w-4 sm:mr-2" />
      <span className="hidden sm:inline">Logout</span>
    </Button>
  );
}
