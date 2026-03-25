"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType, TransactionCategory } from "@/types";

type ActionResult = { error: string } | null;

export async function addTransaction(data: {
  type: TransactionType;
  amount: number;
  category: TransactionCategory;
  description: string;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    type: data.type,
    amount: data.amount,
    category: data.category,
    description: data.description,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return null;
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return null;
}
