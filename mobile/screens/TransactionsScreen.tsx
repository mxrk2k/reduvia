import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "../lib/supabase";
import { COLORS } from "../lib/theme";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  type Transaction,
  type TransactionType,
  type TransactionCategory,
  type RecurringFrequency,
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  type: TransactionType;
  amount: string;
  category: TransactionCategory | "";
  description: string;
  is_recurring: boolean;
  recurring_frequency: RecurringFrequency | "";
}

const EMPTY_FORM: FormState = {
  type: "expense",
  amount: "",
  category: "",
  description: "",
  is_recurring: false,
  recurring_frequency: "",
};

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly",  label: "Yearly" },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

  // Modal
  const [modalVisible, setModalVisible]         = useState(false);
  const [form, setForm]                         = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]                     = useState(false);
  const [formError, setFormError]               = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showFreqPicker, setShowFreqPicker]         = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────────

  async function fetchTransactions(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setTransactions((data ?? []) as Transaction[]);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { fetchTransactions(); }, []));

  // ── Delete ────────────────────────────────────────────────────────────────────

  function confirmDelete(t: Transaction) {
    Alert.alert("Delete Transaction", `Delete "${t.description}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => handleDelete(t.id) },
    ]);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await supabase.from("transactions").delete().eq("id", id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(null);
  }

  // ── Add ───────────────────────────────────────────────────────────────────────

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowCategoryPicker(false);
    setShowFreqPicker(false);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setShowCategoryPicker(false);
    setShowFreqPicker(false);
  }

  function setType(t: TransactionType) {
    setForm((prev) => ({ ...prev, type: t, category: "" }));
    setShowCategoryPicker(false);
  }

  function toggleRecurring(value: boolean) {
    setForm((prev) => ({
      ...prev,
      is_recurring: value,
      recurring_frequency: value ? prev.recurring_frequency : "",
    }));
    if (!value) setShowFreqPicker(false);
  }

  async function handleSave() {
    setFormError(null);
    const amount = parseFloat(form.amount);
    if (!form.description.trim()) {
      setFormError("Description is required.");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setFormError("Enter a valid amount greater than 0.");
      return;
    }
    if (!form.category) {
      setFormError("Please select a category.");
      return;
    }
    if (form.is_recurring && !form.recurring_frequency) {
      setFormError("Please select a frequency.");
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const freq = form.is_recurring ? (form.recurring_frequency as RecurringFrequency) : null;

    const { error } = await supabase.from("transactions").insert({
      user_id:             user.id,
      type:                form.type,
      amount,
      category:            form.category,
      description:         form.description.trim(),
      is_recurring:        form.is_recurring,
      recurring_frequency: freq,
      next_due_date:       freq ? calculateNextDueDate(freq) : null,
    });

    setSaving(false);
    if (error) { setFormError(error.message); return; }
    closeModal();
    fetchTransactions();
  }

  const availableCategories =
    form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // ── Row renderer ──────────────────────────────────────────────────────────────

  function renderTransaction({ item: t }: { item: Transaction }) {
    const isDeleting = deletingId === t.id;
    return (
      <View style={styles.txRow}>
        {/* Colour dot */}
        <View
          style={[
            styles.dot,
            { backgroundColor: t.type === "income" ? COLORS.income : COLORS.expense },
          ]}
        />

        {/* Description + meta */}
        <View style={styles.txMeta}>
          <Text style={styles.txDesc} numberOfLines={1}>
            {t.description}
          </Text>
          <View style={styles.txSubRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t.category}</Text>
            </View>
            {t.is_recurring && t.recurring_frequency && (
              <View style={styles.recurringBadge}>
                <Ionicons name="repeat" size={10} color={COLORS.purple} />
                <Text style={styles.recurringBadgeText}>
                  {t.recurring_frequency.charAt(0).toUpperCase() +
                    t.recurring_frequency.slice(1)}
                </Text>
              </View>
            )}
            <Text style={styles.txDate}>{fmtDate(t.created_at)}</Text>
          </View>
        </View>

        {/* Amount */}
        <Text
          style={[
            styles.txAmount,
            { color: t.type === "income" ? COLORS.income : COLORS.expense },
          ]}
        >
          {t.type === "income" ? "+" : "−"}
          {fmt(Number(t.amount))}
        </Text>

        {/* Delete */}
        <TouchableOpacity
          onPress={() => confirmDelete(t)}
          disabled={isDeleting}
          style={styles.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={COLORS.muted} />
          ) : (
            <Ionicons name="trash-outline" size={16} color={COLORS.muted} />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.purple} />
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        renderItem={renderTransaction}
        contentContainerStyle={
          transactions.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTransactions(true)}
            tintColor={COLORS.purple}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={40} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySub}>Tap + to add your first transaction</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Add Transaction Modal ── */}
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
              <Text style={styles.modalTitle}>Add Transaction</Text>
              <TouchableOpacity
                onPress={closeModal}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            {formError && <Text style={styles.errorText}>{formError}</Text>}

            {/* Type */}
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {(["expense", "income"] as TransactionType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeBtn,
                    form.type === t && {
                      backgroundColor:
                        t === "income" ? COLORS.income + "25" : COLORS.expense + "25",
                      borderColor: t === "income" ? COLORS.income : COLORS.expense,
                    },
                  ]}
                  onPress={() => setType(t)}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      form.type === t && {
                        color: t === "income" ? COLORS.income : COLORS.expense,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount */}
            <Text style={styles.fieldLabel}>Amount ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              value={form.amount}
              onChangeText={(v) => setForm((p) => ({ ...p, amount: v }))}
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Monthly rent"
              placeholderTextColor={COLORS.muted}
              value={form.description}
              onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            />

            {/* Category */}
            <Text style={styles.fieldLabel}>Category</Text>
            <TouchableOpacity
              style={[styles.input, styles.pickerTrigger]}
              onPress={() => {
                setShowCategoryPicker((v) => !v);
                setShowFreqPicker(false);
              }}
            >
              <Text style={form.category ? styles.pickerValue : styles.pickerPlaceholder}>
                {form.category
                  ? form.category.charAt(0).toUpperCase() + form.category.slice(1)
                  : "Select a category"}
              </Text>
              <Ionicons
                name={showCategoryPicker ? "chevron-up" : "chevron-down"}
                size={16}
                color={COLORS.muted}
              />
            </TouchableOpacity>

            {showCategoryPicker && (
              <View style={styles.pickerList}>
                {availableCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.pickerItem,
                      form.category === cat && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setForm((p) => ({ ...p, category: cat }));
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        form.category === cat && styles.pickerItemTextActive,
                      ]}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                    {form.category === cat && (
                      <Ionicons name="checkmark" size={16} color={COLORS.purple} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Recurring toggle */}
            <View style={styles.recurringRow}>
              <View style={styles.recurringRowLeft}>
                <Ionicons name="repeat" size={16} color={COLORS.muted} />
                <Text style={styles.recurringLabel}>Make this recurring</Text>
              </View>
              <Switch
                value={form.is_recurring}
                onValueChange={toggleRecurring}
                trackColor={{ false: COLORS.border, true: COLORS.purple + "80" }}
                thumbColor={form.is_recurring ? COLORS.purple : COLORS.muted}
                ios_backgroundColor={COLORS.border}
              />
            </View>

            {/* Frequency picker — only when recurring is on */}
            {form.is_recurring && (
              <>
                <Text style={styles.fieldLabel}>Frequency</Text>
                <TouchableOpacity
                  style={[styles.input, styles.pickerTrigger]}
                  onPress={() => {
                    setShowFreqPicker((v) => !v);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text
                    style={
                      form.recurring_frequency
                        ? styles.pickerValue
                        : styles.pickerPlaceholder
                    }
                  >
                    {form.recurring_frequency
                      ? form.recurring_frequency.charAt(0).toUpperCase() +
                        form.recurring_frequency.slice(1)
                      : "Select frequency"}
                  </Text>
                  <Ionicons
                    name={showFreqPicker ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={COLORS.muted}
                  />
                </TouchableOpacity>

                {showFreqPicker && (
                  <View style={styles.pickerList}>
                    {FREQUENCIES.map((f) => (
                      <TouchableOpacity
                        key={f.value}
                        style={[
                          styles.pickerItem,
                          form.recurring_frequency === f.value &&
                            styles.pickerItemActive,
                        ]}
                        onPress={() => {
                          setForm((p) => ({ ...p, recurring_frequency: f.value }));
                          setShowFreqPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            form.recurring_frequency === f.value &&
                              styles.pickerItemTextActive,
                          ]}
                        >
                          {f.label}
                        </Text>
                        {form.recurring_frequency === f.value && (
                          <Ionicons name="checkmark" size={16} color={COLORS.purple} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

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
  listContent: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 44,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.bg,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  txMeta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
  },
  txSubRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  badge: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  txDate: {
    fontSize: 11,
    color: COLORS.muted,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 0,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.muted,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.muted,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.purple,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  // ── Modal ────────────────────────────────────────────────────────────────────
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
  typeRow: {
    flexDirection: "row",
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBtnText: {
    fontSize: 14,
    color: COLORS.muted,
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
  pickerList: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 4,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerItemActive: {
    backgroundColor: COLORS.purple + "18",
  },
  pickerItemText: {
    fontSize: 14,
    color: COLORS.text,
    textTransform: "capitalize",
  },
  pickerItemTextActive: {
    color: COLORS.purple,
    fontWeight: "500",
  },
  recurringRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
  },
  recurringRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recurringLabel: {
    fontSize: 14,
    color: COLORS.text,
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
