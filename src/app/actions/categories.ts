"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CustomCategory {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense";
  created_at: string;
}

type ActionResult = { error: string } | null;

// ── getCustomCategories ────────────────────────────────────────────────────────

export async function getCustomCategories(): Promise<CustomCategory[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const { data } = await supabase
    .from("custom_categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  return (data ?? []) as CustomCategory[];
}

// ── createCustomCategory ───────────────────────────────────────────────────────

export async function createCustomCategory(input: {
  name: string;
  type: "income" | "expense";
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const name = input.name.trim().toLowerCase();
  if (!name) return { error: "Category name is required" };
  if (name.length > 30) return { error: "Category name must be 30 characters or fewer" };

  const { error } = await supabase.from("custom_categories").insert({
    user_id: user.id,
    name,
    type: input.type,
  });

  if (error) {
    if (error.code === "23505") return { error: "That category already exists" };
    return { error: error.message };
  }

  revalidatePath("/settings");
  return null;
}

// ── deleteCustomCategory ───────────────────────────────────────────────────────

export async function deleteCustomCategory(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("custom_categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return null;
}
