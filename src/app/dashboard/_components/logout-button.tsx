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
    <Button variant="outline" size="sm" onClick={handleLogout}>
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  );
}
