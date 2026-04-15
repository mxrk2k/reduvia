"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function deleteAccount(): Promise<{ error: string } | null> {
  // Verify the requesting user is authenticated
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Not authenticated" };

  const userId = user.id;

  // Use the service role client so we can delete auth users and bypass RLS
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Delete all user data from each table
  const tables = [
    "transactions",
    "budgets",
    "recurring_transactions",
    "user_preferences",
  ] as const;

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) {
      console.error(`[deleteAccount] failed to delete from ${table}:`, error);
      return { error: `Failed to delete data from ${table}.` };
    }
  }

  // Delete the user from Supabase Auth
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    console.error("[deleteAccount] failed to delete auth user:", deleteUserError);
    return { error: "Failed to delete account." };
  }

  return null;
}
