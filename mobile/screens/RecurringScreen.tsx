import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "../lib/supabase";
import { COLORS } from "../lib/theme";
import type { Transaction, RecurringFrequency } from "../lib/types";

// ── Date helpers (identical logic to the web app's actions/transactions.ts) ────

function formatDateLocal(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function advanceDate(dateStr: string, frequency: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (frequency === "weekly")  d.setDate(d.getDate() + 7);
  if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  if (frequency === "yearly")  d.setFullYear(d.getFullYear() + 1);
  return formatDateLocal(d);
}

function todayStr(): string {
  return formatDateLocal(new Date());
}

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return (
    "$" +
    Math.abs(n)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Due-status helpers ─────────────────────────────────────────────────────────

function getDueStatus(nextDueDate: string | null): "overdue" | "today" | "soon" | "future" {
  if (!nextDueDate) return "future";
  const today = todayStr();
  if (nextDueDate < today)  return "overdue";
  if (nextDueDate === today) return "today";
  return "soon";
}

// ── Recurring transaction card ─────────────────────────────────────────────────

function RecurringCard({
  t,
  highlight,
  onDelete,
}: {
  t: Transaction;
  highlight?: boolean;
  onDelete: (t: Transaction) => void;
}) {
  const status = getDueStatus(t.next_due_date);

  const dueLabelMap: Record<string, { text: string; color: string; bg: string }> = {
    overdue: {
      text:  t.next_due_date ? `Overdue since ${fmtDate(t.next_due_date)}` : "Overdue",
      color: COLORS.expense,
      bg:    COLORS.expense + "18",
    },
    today: {
      text:  "Due today",
      color: "#f59e0b",
      bg:    "#f59e0b18",
    },
    soon: {
      text:  t.next_due_date ? `Due ${fmtDate(t.next_due_date)}` : "Due soon",
      color: COLORS.muted,
      bg:    "transparent",
    },
    future: {
      text:  t.next_due_date ? `Due ${fmtDate(t.next_due_date)}` : "—",
      color: COLORS.muted,
      bg:    "transparent",
    },
  };

  const due = dueLabelMap[status];

  return (
    <View
      style={[
        styles.card,
        highlight && {
          borderColor:
            status === "overdue"
              ? COLORS.expense + "60"
              : "#f59e0b60",
          backgroundColor:
            status === "overdue"
              ? COLORS.expense + "08"
              : "#f59e0b08",
        },
      ]}
    >
      {/* Top row */}
      <View style={styles.cardTop}>
        {/* Type dot + description */}
        <View style={styles.cardLeft}>
          <View
            style={[
              styles.dot,
              { backgroundColor: t.type === "income" ? COLORS.income : COLORS.expense },
            ]}
          />
          <Text style={styles.cardDesc} numberOfLines={1}>
            {t.description}
          </Text>
        </View>

        {/* Amount + delete */}
        <View style={styles.cardRight}>
          <Text
            style={[
              styles.cardAmount,
              { color: t.type === "income" ? COLORS.income : COLORS.expense },
            ]}
          >
            {t.type === "income" ? "+" : "−"}
            {fmt(Number(t.amount))}
          </Text>
          <TouchableOpacity
            onPress={() => onDelete(t)}
            style={styles.deleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={15} color={COLORS.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Badge row */}
      <View style={styles.cardBadges}>
        {/* Category */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t.category}</Text>
        </View>

        {/* Frequency */}
        <View style={styles.recurringBadge}>
          <Ionicons name="repeat" size={10} color={COLORS.purple} />
          <Text style={styles.recurringBadgeText}>
            {(t.recurring_frequency as RecurringFrequency).charAt(0).toUpperCase() +
              (t.recurring_frequency as RecurringFrequency).slice(1)}
          </Text>
        </View>

        {/* Overdue / today chips */}
        {(status === "overdue" || status === "today") && (
          <View style={[styles.statusChip, { backgroundColor: due.bg, borderColor: due.color + "50" }]}>
            <Text style={[styles.statusChipText, { color: due.color }]}>
              {status === "overdue" ? "Overdue" : "Today"}
            </Text>
          </View>
        )}
      </View>

      {/* Due date label */}
      <Text style={[styles.dueLabel, { color: due.color }]}>{due.text}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function RecurringScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [processing, setProcessing]     = useState(false);

  // ── Fetch all recurring transactions ─────────────────────────────────────────

  async function fetchData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_recurring", true)
      .order("next_due_date", { ascending: true });

    setTransactions((data ?? []) as Transaction[]);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  // ── Delete ────────────────────────────────────────────────────────────────────

  function confirmDelete(t: Transaction) {
    Alert.alert(
      "Delete Recurring Transaction",
      `Stop and delete "${t.description}"? This won't delete past occurrences.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await supabase.from("transactions").delete().eq("id", t.id);
            setTransactions((prev) => prev.filter((x) => x.id !== t.id));
          },
        },
      ]
    );
  }

  // ── Process due transactions (mirrors web app logic exactly) ─────────────────

  async function processDue() {
    setProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProcessing(false); return; }

    const today = todayStr();

    const { data: due } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_recurring", true)
      .lte("next_due_date", today);

    if (!due?.length) {
      setProcessing(false);
      Alert.alert("Nothing to process", "No transactions are currently due.");
      return;
    }

    let processed = 0;
    for (const tx of due) {
      // Insert a plain (non-recurring) occurrence
      const { error: insertError } = await supabase.from("transactions").insert({
        user_id:      user.id,
        type:         tx.type,
        amount:       tx.amount,
        category:     tx.category,
        description:  tx.description,
        is_recurring: false,
      });
      if (insertError) continue;

      // Advance next_due_date on the template
      const nextDate = advanceDate(tx.next_due_date, tx.recurring_frequency);
      await supabase
        .from("transactions")
        .update({ next_due_date: nextDate })
        .eq("id", tx.id);

      processed++;
    }

    setProcessing(false);
    await fetchData();
    Alert.alert(
      "Done",
      `Processed ${processed} transaction${processed !== 1 ? "s" : ""}.`
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const today = todayStr();

  // Due soon = overdue or due today or within 7 days
  const sevenDaysLater = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatDateLocal(d);
  })();

  const dueSoon = transactions.filter(
    (t) => t.next_due_date && t.next_due_date <= sevenDaysLater
  );
  const hasOverdue = transactions.some(
    (t) => t.next_due_date && t.next_due_date <= today
  );
  const upcoming = transactions.filter(
    (t) => !t.next_due_date || t.next_due_date > sevenDaysLater
  );

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.purple} />
      </View>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────────

  if (transactions.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View style={styles.centered}>
          <Ionicons name="repeat-outline" size={48} color={COLORS.muted} />
          <Text style={styles.emptyTitle}>No recurring transactions</Text>
          <Text style={styles.emptySub}>
            Add a transaction in the Transactions tab and mark it as recurring.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={COLORS.purple}
          />
        }
      >
        {/* ── Due Soon section ── */}
        {dueSoon.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="repeat" size={15} color="#f59e0b" />
                <Text style={styles.sectionTitle}>Due Soon</Text>
              </View>

              {/* Process button — only shown when something is actually overdue/due today */}
              {hasOverdue && (
                <TouchableOpacity
                  style={styles.processBtn}
                  onPress={processDue}
                  disabled={processing}
                  activeOpacity={0.8}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color={COLORS.text} />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={13} color={COLORS.text} />
                      <Text style={styles.processBtnText}>Process Due</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {dueSoon.map((t) => (
              <RecurringCard
                key={t.id}
                t={t}
                highlight
                onDelete={confirmDelete}
              />
            ))}
          </View>
        )}

        {/* ── All recurring / upcoming section ── */}
        {upcoming.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {dueSoon.length > 0 ? "Upcoming" : "All Recurring"}
            </Text>
            {upcoming.map((t) => (
              <RecurringCard
                key={t.id}
                t={t}
                onDelete={confirmDelete}
              />
            ))}
          </View>
        )}

        {/* Process button — also shown at the bottom if there are overdue and no due-soon section rendered it already at top */}
        {hasOverdue && dueSoon.length === 0 && (
          <TouchableOpacity
            style={[styles.processBtn, styles.processBtnFull]}
            onPress={processDue}
            disabled={processing}
            activeOpacity={0.8}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={15} color="#fff" />
                <Text style={[styles.processBtnText, { color: "#fff" }]}>
                  Process Due Transactions
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 40,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  processBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  processBtnFull: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purple,
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 10,
  },
  processBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
  },
  // ── Card ──
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  cardDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    flex: 1,
  },
  cardAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    backgroundColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    color: COLORS.muted,
    textTransform: "capitalize",
  },
  recurringBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: COLORS.purple + "18",
    borderWidth: 1,
    borderColor: COLORS.purple + "40",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recurringBadgeText: {
    fontSize: 11,
    color: COLORS.purple,
    textTransform: "capitalize",
  },
  statusChip: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  dueLabel: {
    fontSize: 12,
  },
  // ── Empty ──
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.muted,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 20,
  },
});
