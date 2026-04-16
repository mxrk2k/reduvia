"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  color: string;
  created_at: string;
}

type ActionResult = { error: string } | null;

// ── getSavingsGoals ────────────────────────────────────────────────────────────

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return [];

  const { data } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (data ?? []) as SavingsGoal[];
}

// ── createSavingsGoal ──────────────────────────────────────────────────────────

export async function createSavingsGoal(input: {
  name: string;
  target_amount: number;
  target_date?: string | null;
  color?: string;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase.from("savings_goals").insert({
    user_id:       user.id,
    name:          input.name.trim(),
    target_amount: input.target_amount,
    target_date:   input.target_date ?? null,
    color:         input.color ?? "#7c3aed",
  });

  if (error) return { error: error.message };

  revalidatePath("/savings");
  return null;
}

// ── updateSavingsGoalAmount ────────────────────────────────────────────────────

export async function updateSavingsGoalAmount(
  id: string,
  amountToAdd: number
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  // Fetch current value to do the addition server-side
  const { data: goal, error: fetchErr } = await supabase
    .from("savings_goals")
    .select("current_amount, target_amount")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr || !goal) return { error: "Goal not found" };

  const newAmount = Math.min(
    Number(goal.current_amount) + amountToAdd,
    Number(goal.target_amount)
  );

  const { error } = await supabase
    .from("savings_goals")
    .update({ current_amount: newAmount })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/savings");
  return null;
}

// ── deleteSavingsGoal ──────────────────────────────────────────────────────────

export async function deleteSavingsGoal(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/savings");
  return null;
}
