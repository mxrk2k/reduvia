import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "../lib/supabase";
import { COLORS } from "../lib/theme";
import {
  EXPENSE_CATEGORIES,
  type Budget,
  type BudgetWithSpending,
  type TransactionCategory,
} from "../lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return (
    "$" +
    Math.abs(n)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}

// ── Pace logic (mirrors the web app exactly) ───────────────────────────────────

interface PaceInfo {
  barColor: string;
  statusLabel: string;
  statusColor: string;
  advisory: string | null;
}

function getPaceInfo(spent: number, limit: number): PaceInfo {
  const dayOfMonth = new Date().getDate();
  const expectedSpent = (limit / 30) * dayOfMonth;
  const paceRatio = expectedSpent > 0 ? spent / expectedSpent : 0;
  const monthProgress = Math.round((dayOfMonth / 30) * 100);

  if (spent >= limit) {
    return {
      barColor: COLORS.expense,
      statusLabel: "Exhausted",
      statusColor: COLORS.expense,
      advisory: "Budget exhausted. No more spending in this category.",
    };
  }
  if (paceRatio > 1.3) {
    const dailyRate = dayOfMonth > 0 ? spent / dayOfMonth : 0;
    let advisory: string;
    if (dailyRate > 0) {
      const daysLeft = (limit - spent) / dailyRate;
      const exhaustionDate = new Date();
      exhaustionDate.setDate(exhaustionDate.getDate() + Math.floor(daysLeft));
      const formatted = exhaustionDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      advisory = `At this pace you'll exhaust your budget by ${formatted}.`;
    } else {
      advisory = "Spending is significantly ahead of pace.";
    }
    return {
      barColor: COLORS.expense,
      statusLabel: "Alert",
      statusColor: COLORS.expense,
      advisory,
    };
  }
  if (paceRatio > 1.0) {
    const spentPct = Math.round((spent / limit) * 100);
    return {
      barColor: "#f97316",
      statusLabel: "Warning",
      statusColor: "#f97316",
      advisory: `${spentPct}% spent but only ${monthProgress}% of the month has passed.`,
    };
  }
  if (paceRatio > 0.8) {
    return {
      barColor: "#f59e0b",
      statusLabel: "Careful",
      statusColor: "#f59e0b",
      advisory: null,
    };
  }
  return {
    barColor: COLORS.income,
    statusLabel: "On track",
    statusColor: COLORS.income,
    advisory: null,
  };
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ spent, limit, barColor }: { spent: number; limit: number; barColor: string }) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  return (
    <View style={progressStyles.track}>
      <View
        style={[
          progressStyles.fill,
          { width: `${pct}%` as `${number}%`, backgroundColor: barColor },
        ]}
      />
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 99,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 99,
  },
});

// ── Main component ─────────────────────────────────────────────────────────────

export default function BudgetsScreen() {
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add-budget modal
  const [modalVisible, setModalVisible] = useState(false);
  const [category, setCategory] = useState<TransactionCategory | "">("");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────────

  async function fetchData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch budgets
    const { data: budgetRows } = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Fetch current-month expense transactions
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { data: txRows } = await supabase
      .from("transactions")
      .select("category, amount")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .gte("created_at", startOfMonth)
      .lt("created_at", startOfNextMonth);

    // Sum spending by category
    const spendingByCategory: Record<string, number> = {};
    for (const tx of txRows ?? []) {
      spendingByCategory[tx.category] =
        (spendingByCategory[tx.category] ?? 0) + Number(tx.amount);
    }

    const result: BudgetWithSpending[] = ((budgetRows ?? []) as Budget[]).map(
      (b) => ({ ...b, spent: spendingByCategory[b.category] ?? 0 })
    );

    setBudgets(result);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  // ── Delete ───────────────────────────────────────────────────────────────────

  function confirmDelete(b: BudgetWithSpending) {
    Alert.alert(
      "Delete Budget",
      `Remove the "${b.category}" budget?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await supabase.from("budgets").delete().eq("id", b.id);
            setBudgets((prev) => prev.filter((x) => x.id !== b.id));
          },
        },
      ]
    );
  }

  // ── Add budget ───────────────────────────────────────────────────────────────

  const existingCategories = budgets.map((b) => b.category);
  const availableCategories = EXPENSE_CATEGORIES.filter(
    (c) => !existingCategories.includes(c)
  );

  function openModal() {
    setCategory("");
    setLimit("");
    setFormError(null);
    setShowCategoryPicker(false);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setShowCategoryPicker(false);
  }

  async function handleSave() {
    setFormError(null);
    const limitNum = parseFloat(limit);
    if (!category) {
      setFormError("Please select a category.");
      return;
    }
    if (isNaN(limitNum) || limitNum <= 0) {
      setFormError("Enter a valid limit greater than 0.");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("budgets").insert({
      user_id: user.id,
      category,
      monthly_limit: limitNum,
    });

    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    closeModal();
    fetchData();
  }

  // ── Loading splash ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.purple} />
      </View>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
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
        <Text style={styles.sub}>Monthly spending limits</Text>

        {budgets.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="wallet-outline" size={40} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No budgets yet</Text>
            <Text style={styles.emptySub}>
              Tap "Add Budget" to start tracking your spending
            </Text>
          </View>
        ) : (
          budgets.map((b) => {
            const pct =
              b.monthly_limit > 0
                ? Math.round((b.spent / b.monthly_limit) * 100)
                : 0;
            const pace = getPaceInfo(b.spent, b.monthly_limit);

            return (
              <View key={b.id} style={styles.budgetCard}>
                {/* Top row */}
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetHeaderLeft}>
                    <Text style={styles.budgetCategory}>{b.category}</Text>
                    <Text style={styles.budgetMeta}>
                      {fmt(b.spent)} of {fmt(b.monthly_limit)} spent
                      {"  "}
                      <Text style={[styles.paceLabel, { color: pace.statusColor }]}>
                        · {pace.statusLabel}
                      </Text>
                    </Text>
                  </View>
                  <View style={styles.budgetHeaderRight}>
                    <Text
                      style={[styles.pctText, { color: pace.statusColor }]}
                    >
                      {pct}%
                    </Text>
                    <TouchableOpacity
                      onPress={() => confirmDelete(b)}
                      style={styles.deleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={COLORS.muted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Progress bar */}
                <ProgressBar
                  spent={b.spent}
                  limit={b.monthly_limit}
                  barColor={pace.barColor}
                />

                {/* Advisory */}
                {pace.advisory && (
                  <Text style={[styles.advisory, { color: pace.statusColor }]}>
                    {pace.advisory}
                  </Text>
                )}
              </View>
            );
          })
        )}

        {/* Add budget button */}
        {availableCategories.length > 0 && (
          <TouchableOpacity style={styles.addBtn} onPress={openModal} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add Budget</Text>
          </TouchableOpacity>
        )}

        {availableCategories.length === 0 && budgets.length > 0 && (
          <Text style={styles.allCoveredText}>
            All expense categories have a budget.
          </Text>
        )}
      </ScrollView>

      {/* ── Add Budget Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Budget</Text>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {formError && (
              <Text style={styles.errorText}>{formError}</Text>
            )}

            {/* Category picker */}
            <Text style={styles.fieldLabel}>Category</Text>
            <TouchableOpacity
              style={[styles.input, styles.pickerTrigger]}
              onPress={() => setShowCategoryPicker((v) => !v)}
            >
              <Text
                style={category ? styles.pickerValue : styles.pickerPlaceholder}
              >
                {category
                  ? category.charAt(0).toUpperCase() + category.slice(1)
                  : "Select a category"}
              </Text>
              <Ionicons
                name={showCategoryPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color={COLORS.muted}
              />
            </TouchableOpacity>

            {showCategoryPicker && (
              <View style={styles.categoryList}>
                {availableCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryItem,
                      category === cat && styles.categoryItemActive,
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryItemText,
                        category === cat && styles.categoryItemTextActive,
                      ]}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                    {category === cat && (
                      <Ionicons name="checkmark" size={16} color={COLORS.purple} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Monthly limit */}
            <Text style={styles.fieldLabel}>Monthly Limit ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              value={limit}
              onChangeText={setLimit}
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  sub: {
    fontSize: 13,
    color: COLORS.muted,
  },
  emptyBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 48,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  budgetCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  budgetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  budgetHeaderLeft: {
    flex: 1,
    gap: 3,
  },
  budgetCategory: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    textTransform: "capitalize",
  },
  budgetMeta: {
    fontSize: 12,
    color: COLORS.muted,
  },
  paceLabel: {
    fontWeight: "500",
  },
  budgetHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  pctText: {
    fontSize: 14,
    fontWeight: "700",
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  advisory: {
    fontSize: 12,
    lineHeight: 17,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.purple,
    borderRadius: 10,
    height: 48,
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  allCoveredText: {
    textAlign: "center",
    fontSize: 13,
    color: COLORS.muted,
    paddingVertical: 8,
  },
  // ── Modal ──
  modalRoot: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  modalContent: {
    padding: 20,
    gap: 4,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  errorText: {
    backgroundColor: "rgba(244,63,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.3)",
    borderRadius: 8,
    padding: 10,
    color: "#fb7185",
    fontSize: 13,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    color: "rgba(241,245,249,0.55)",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    height: 44,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 15,
  },
  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerValue: {
    fontSize: 15,
    color: COLORS.text,
    textTransform: "capitalize",
  },
  pickerPlaceholder: {
    fontSize: 15,
    color: COLORS.muted,
  },
  categoryList: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 4,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryItemActive: {
    backgroundColor: COLORS.purple + "18",
  },
  categoryItemText: {
    fontSize: 14,
    color: COLORS.text,
    textTransform: "capitalize",
  },
  categoryItemTextActive: {
    color: COLORS.purple,
    fontWeight: "500",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    color: COLORS.muted,
  },
  saveBtn: {
    flex: 1,
    height: 46,
    backgroundColor: COLORS.purple,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontSize: 15,
    color: "#fff",
    fontWeight: "600",
  },
});
