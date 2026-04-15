"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/stripe";
import type { TransactionCategory } from "@/types";

type ActionResult = { error: string } | null;

export async function addBudget(data: {
  category: TransactionCategory;
  monthly_limit: number;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Not authenticated" };

  // Free plan: max 3 budgets
  if (!(await isProUser(user.id))) {
    const { count } = await supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= 3) {
      return { error: "Free plan is limited to 3 budgets. Upgrade to Pro at /pricing" };
    }
  }

  const { error } = await supabase.from("budgets").insert({
    user_id: user.id,
    category: data.category,
    monthly_limit: data.monthly_limit,
  });

  if (error) return { error: error.message };

  revalidatePath("/budgets");
  return null;
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/budgets");
  return null;
}
