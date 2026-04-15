"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { captureServerEvent } from "@/lib/posthog";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserExport {
  transactions: Record<string, unknown>[];
  budgets: Record<string, unknown>[];
  recurring_transactions: Record<string, unknown>[];
  user_preferences: Record<string, unknown> | null;
  exported_at: string;
}

// ── exportUserData ────────────────────────────────────────────────────────────

export async function exportUserData(): Promise<
  { data: UserExport } | { error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Not authenticated" };

  const userId = user.id;

  const [txResult, budgetResult, recurringResult, prefResult] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("budgets")
        .select("*")
        .eq("user_id", userId),
      supabase
        .from("recurring_transactions")
        .select("*")
        .eq("user_id", userId),
      supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  for (const [label, result] of [
    ["transactions", txResult],
    ["budgets", budgetResult],
    ["recurring_transactions", recurringResult],
    ["user_preferences", prefResult],
  ] as const) {
    if (result.error) {
      console.error(`[exportUserData] failed to fetch ${label}:`, result.error);
      return { error: `Failed to export ${label}.` };
    }
  }

  await captureServerEvent(userId, "data_exported");

  return {
    data: {
      transactions: (txResult.data ?? []) as Record<string, unknown>[],
      budgets: (budgetResult.data ?? []) as Record<string, unknown>[],
      recurring_transactions: (recurringResult.data ?? []) as Record<string, unknown>[],
      user_preferences: prefResult.data as Record<string, unknown> | null,
      exported_at: new Date().toISOString(),
    },
  };
}

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
