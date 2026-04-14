"use server";

import { createClient } from "@/lib/supabase/server";

export interface UserPreferences {
  dismiss_import_prompt: boolean;
}

export async function getUserPreferences(): Promise<UserPreferences | null> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data } = await supabase
    .from("user_preferences")
    .select("dismiss_import_prompt")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ?? null;
}

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
