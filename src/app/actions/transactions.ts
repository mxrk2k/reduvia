"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType, TransactionCategory, RecurringFrequency } from "@/types";

type ActionResult = { error: string } | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateLocal(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function calculateNextDueDate(frequency: RecurringFrequency): string {
  const d = new Date();
  if (frequency === "weekly")  d.setDate(d.getDate() + 7);
  if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  if (frequency === "yearly")  d.setFullYear(d.getFullYear() + 1);
  return formatDateLocal(d);
}

function advanceDate(dateStr: string, frequency: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (frequency === "weekly")  d.setDate(d.getDate() + 7);
  if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  if (frequency === "yearly")  d.setFullYear(d.getFullYear() + 1);
  return formatDateLocal(d);
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function addTransaction(data: {
  type: TransactionType;
  amount: number;
  category: TransactionCategory;
  description: string;
  is_recurring?: boolean;
  recurring_frequency?: RecurringFrequency;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Not authenticated" };

  const isRecurring = data.is_recurring ?? false;

  const { error } = await supabase.from("transactions").insert({
    user_id:             user.id,
    type:                data.type,
    amount:              data.amount,
    category:            data.category,
    description:         data.description,
    is_recurring:        isRecurring,
    recurring_frequency: isRecurring ? (data.recurring_frequency ?? null) : null,
    next_due_date:       isRecurring && data.recurring_frequency
                           ? calculateNextDueDate(data.recurring_frequency)
                           : null,
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

export async function processRecurringTransactions(): Promise<
  { processed: number } | { error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { error: "Not authenticated" };

  const today = formatDateLocal(new Date());

  const { data: due, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_recurring", true)
    .lte("next_due_date", today);

  if (fetchError) return { error: fetchError.message };
  if (!due?.length)  return { processed: 0 };

  let processed = 0;

  for (const tx of due) {
    // Create the new occurrence as a plain (non-recurring) transaction
    const { error: insertError } = await supabase.from("transactions").insert({
      user_id:      user.id,
      type:         tx.type,
      amount:       tx.amount,
      category:     tx.category,
      description:  tx.description,
      is_recurring: false,
    });
    if (insertError) continue;

    // Advance the template's next_due_date
    const nextDate = advanceDate(tx.next_due_date, tx.recurring_frequency);
    await supabase
      .from("transactions")
      .update({ next_due_date: nextDate })
      .eq("id", tx.id);

    processed++;
  }

  revalidatePath("/dashboard");
  return { processed };
}
