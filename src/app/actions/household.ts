"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { isProUser } from "@/lib/stripe";
import { EXPENSE_CATEGORIES } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  email: string;
}

export interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  members: HouseholdMember[];
}

export interface HouseholdBudgetWithSpending {
  id: string;
  household_id: string;
  category: string;
  amount: number;
  month: string;
  spent: number;
}

type ActionResult<T = void> =
  | (T extends void ? { error?: never } : { data: T; error?: never })
  | { error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Fetches email addresses for a list of user IDs using the admin API. */
async function fetchMemberEmails(
  admin: ReturnType<typeof adminClient>,
  userIds: string[]
): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();
  await Promise.all(
    userIds.map(async (uid) => {
      const { data } = await admin.auth.admin.getUserById(uid);
      if (data?.user?.email) emailMap.set(uid, data.user.email);
    })
  );
  return emailMap;
}

// ── getUserHousehold ───────────────────────────────────────────────────────────

/**
 * Returns the user's household (the first one they belong to) with all members,
 * or null if the user has no household.
 */
export async function getUserHousehold(): Promise<Household | null> {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const admin = adminClient();

  // Find the user's membership
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return null;

  const householdId = membership.household_id;

  // Fetch household + all members in parallel
  const [householdRes, membersRes] = await Promise.all([
    supabase
      .from("households")
      .select("*")
      .eq("id", householdId)
      .maybeSingle(),
    supabase
      .from("household_members")
      .select("*")
      .eq("household_id", householdId)
      .order("joined_at", { ascending: true }),
  ]);

  if (!householdRes.data) return null;

  const memberRows = membersRes.data ?? [];
  const emailMap = await fetchMemberEmails(
    admin,
    memberRows.map((m) => m.user_id)
  );

  const members: HouseholdMember[] = memberRows.map((m) => ({
    id: m.id,
    household_id: m.household_id,
    user_id: m.user_id,
    role: m.role as "owner" | "member",
    joined_at: m.joined_at,
    email: emailMap.get(m.user_id) ?? m.user_id,
  }));

  return {
    id: householdRes.data.id,
    name: householdRes.data.name,
    created_by: householdRes.data.created_by,
    created_at: householdRes.data.created_at,
    members,
  };
}

// ── createHousehold ────────────────────────────────────────────────────────────

export async function createHousehold(
  name: string
): Promise<ActionResult<{ householdId: string }>> {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  if (!(await isProUser(user.id)))
    return { error: "Household budgets are a Pro feature." };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Household name cannot be empty." };
  if (trimmed.length > 60) return { error: "Household name is too long." };

  // Check if user already belongs to a household
  const { data: existing } = await supabase
    .from("household_members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { error: "You already belong to a household." };

  const admin = adminClient();

  // Create the household then add the creator as owner
  const { data: household, error: householdErr } = await admin
    .from("households")
    .insert({ name: trimmed, created_by: user.id })
    .select("id")
    .single();

  if (householdErr || !household)
    return { error: householdErr?.message ?? "Failed to create household." };

  const { error: memberErr } = await admin.from("household_members").insert({
    household_id: household.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberErr) {
    // Best-effort cleanup
    await admin.from("households").delete().eq("id", household.id);
    return { error: memberErr.message };
  }

  revalidatePath("/households");
  return { data: { householdId: household.id } };
}

// ── inviteMember ───────────────────────────────────────────────────────────────

export async function inviteMember(
  householdId: string,
  email: string
): Promise<ActionResult<{ inviteUrl: string }>> {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  // Verify caller is an owner
  const { data: membership } = await supabase
    .from("household_members")
    .select("role, household_id")
    .eq("user_id", user.id)
    .eq("household_id", householdId)
    .maybeSingle();

  if (!membership) return { error: "You are not a member of this household." };
  if (membership.role !== "owner")
    return { error: "Only the owner can invite members." };

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes("@"))
    return { error: "Please enter a valid email address." };

  const admin = adminClient();

  // Insert the invite (token is generated by DB default)
  const { data: invite, error: inviteErr } = await admin
    .from("household_invites")
    .insert({
      household_id: householdId,
      invited_email: trimmedEmail,
      invited_by: user.id,
    })
    .select("token")
    .single();

  if (inviteErr || !invite)
    return { error: inviteErr?.message ?? "Failed to create invite." };

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://reduvia.com";
  const inviteUrl = `${appUrl}/households/join?token=${invite.token}`;

  revalidatePath("/households");
  return { data: { inviteUrl } };
}

// ── acceptInvite ───────────────────────────────────────────────────────────────

export async function acceptInvite(
  token: string
): Promise<ActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  if (!(await isProUser(user.id)))
    return { error: "Household budgets are a Pro feature." };

  const admin = adminClient();

  // Fetch the invite
  const { data: invite, error: inviteErr } = await admin
    .from("household_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (inviteErr || !invite) return { error: "Invalid or expired invite link." };
  if (invite.accepted_at) return { error: "This invite has already been used." };

  // Check if user is already a member
  const { data: existingMember } = await admin
    .from("household_members")
    .select("id")
    .eq("household_id", invite.household_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember) return { error: "You are already a member of this household." };

  // Check if user already belongs to a different household
  const { data: otherMembership } = await admin
    .from("household_members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (otherMembership)
    return { error: "You already belong to a household. Leave it first to join another." };

  // Add user as member
  const { error: memberErr } = await admin.from("household_members").insert({
    household_id: invite.household_id,
    user_id: user.id,
    role: "member",
  });
  if (memberErr) return { error: memberErr.message };

  // Mark invite accepted
  await admin
    .from("household_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  revalidatePath("/households");
  return {};
}

// ── getHouseholdBudgets ────────────────────────────────────────────────────────

export async function getHouseholdBudgets(
  householdId: string
): Promise<ActionResult<HouseholdBudgetWithSpending[]>> {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  const month = currentMonth();
  const [year, mon] = month.split("-").map(Number);
  const startOfMonth = new Date(year, mon - 1, 1).toISOString();
  const startOfNextMonth = new Date(year, mon, 1).toISOString();

  // Fetch budgets + member IDs in parallel
  const [budgetsRes, membersRes] = await Promise.all([
    supabase
      .from("household_budgets")
      .select("*")
      .eq("household_id", householdId)
      .eq("month", month),
    supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId),
  ]);

  if (budgetsRes.error) return { error: budgetsRes.error.message };

  const memberIds = (membersRes.data ?? []).map((m) => m.user_id);

  // Sum expenses per category across all members for this month
  const spendingByCategory: Record<string, number> = {};
  if (memberIds.length > 0) {
    const { data: txRows } = await supabase
      .from("transactions")
      .select("category, amount")
      .in("user_id", memberIds)
      .eq("type", "expense")
      .gte("created_at", startOfMonth)
      .lt("created_at", startOfNextMonth);

    for (const tx of txRows ?? []) {
      spendingByCategory[tx.category] =
        (spendingByCategory[tx.category] ?? 0) + Number(tx.amount);
    }
  }

  const budgets: HouseholdBudgetWithSpending[] = (budgetsRes.data ?? []).map(
    (b) => ({
      id: b.id,
      household_id: b.household_id,
      category: b.category,
      amount: Number(b.amount),
      month: b.month,
      spent: spendingByCategory[b.category] ?? 0,
    })
  );

  return { data: budgets };
}

// ── upsertHouseholdBudget ──────────────────────────────────────────────────────

export async function upsertHouseholdBudget(
  householdId: string,
  category: string,
  amount: number
): Promise<ActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  if (!EXPENSE_CATEGORIES.includes(category as never))
    return { error: "Invalid category." };
  if (amount <= 0) return { error: "Amount must be greater than zero." };

  // Verify membership
  const { data: membership } = await supabase
    .from("household_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!membership) return { error: "You are not a member of this household." };

  const month = currentMonth();
  const admin = adminClient();

  const { error } = await admin.from("household_budgets").upsert(
    {
      household_id: householdId,
      category,
      amount,
      month,
    },
    { onConflict: "household_id,category,month" }
  );

  if (error) return { error: error.message };

  revalidatePath("/households");
  return {};
}

// ── leaveHousehold ─────────────────────────────────────────────────────────────

export async function leaveHousehold(
  householdId: string
): Promise<ActionResult> {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Not authenticated." };

  const { data: membership } = await supabase
    .from("household_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!membership) return { error: "You are not a member of this household." };

  const admin = adminClient();

  if (membership.role === "owner") {
    // Check if there are other members; if so, block or transfer ownership
    const { data: others } = await admin
      .from("household_members")
      .select("id")
      .eq("household_id", householdId)
      .neq("user_id", user.id);

    if ((others?.length ?? 0) > 0)
      return {
        error:
          "Transfer ownership to another member before leaving, or remove all members first.",
      };

    // No other members — delete the household entirely
    await admin.from("households").delete().eq("id", householdId);
  } else {
    await admin
      .from("household_members")
      .delete()
      .eq("household_id", householdId)
      .eq("user_id", user.id);
  }

  revalidatePath("/households");
  return {};
}
