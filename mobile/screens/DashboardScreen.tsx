import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
  VictoryChart,
  VictoryBar,
  VictoryGroup,
  VictoryAxis,
  VictoryLine,
  VictoryPie,
  VictoryLabel,
} from "victory-native";

import { supabase } from "../lib/supabase";
import { COLORS } from "../lib/theme";
import type { Transaction } from "../lib/types";

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return (
    "$" +
    Math.abs(n)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}

function fmtShort(n: number): string {
  if (n === 0) return "$0";
  if (Math.abs(n) >= 1000) return "$" + (n / 1000).toFixed(1) + "k";
  return "$" + Math.abs(n).toFixed(0);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Category colours (matches web app) ────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  housing:       "#f97316",
  food:          "#eab308",
  transport:     "#3b82f6",
  entertainment: "#a855f7",
  health:        "#ec4899",
  education:     "#06b6d4",
  shopping:      "#f43f5e",
  utilities:     "#64748b",
  other:         "#94a3b8",
};
const DEFAULT_COLOR = "#94a3b8";

// ── Data builders ──────────────────────────────────────────────────────────────

interface CategoryEntry {
  name: string;
  amount: number;
  color: string;
  pct: number;
}

function buildCategoryData(transactions: Transaction[]): CategoryEntry[] {
  const totals: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    totals[t.category] = (totals[t.category] ?? 0) + Number(t.amount);
  }
  const total = Object.values(totals).reduce((s, v) => s + v, 0);
  if (total === 0) return [];
  return Object.entries(totals)
    .map(([cat, amount]) => ({
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      amount,
      color: CATEGORY_COLORS[cat] ?? DEFAULT_COLOR,
      pct: Math.round((amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);
}

interface MonthEntry {
  month: string; // "Jan", "Feb" …
  income: number;
  expenses: number;
  x: number;    // 1–6 for Victory axis
}

function buildMonthlyData(transactions: Transaction[]): MonthEntry[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const label = date.toLocaleDateString("en-US", { month: "short" });
    const monthTxs = transactions.filter((t) => {
      const d = new Date(t.created_at);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return {
      month: label,
      income: monthTxs
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + Number(t.amount), 0),
      expenses: monthTxs
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0),
      x: i + 1,
    };
  });
}

// ── Chart section wrapper ──────────────────────────────────────────────────────

function ChartSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={chartStyles.section}>
      <View style={chartStyles.divider} />
      <Text style={chartStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <View style={chartStyles.empty}>
      <Ionicons name="bar-chart-outline" size={28} color={COLORS.muted} />
      <Text style={chartStyles.emptyText}>{message}</Text>
    </View>
  );
}

// ── Income vs Expenses bar chart ───────────────────────────────────────────────

function BarChart({
  income,
  expenses,
  width,
}: {
  income: number;
  expenses: number;
  width: number;
}) {
  if (income === 0 && expenses === 0) {
    return <ChartEmpty message="No data yet" />;
  }

  const chartWidth = width;
  const chartHeight = 180;
  const axisStyle = {
    axis: { stroke: COLORS.border },
    tickLabels: { fill: COLORS.muted, fontSize: 11 },
    grid: { stroke: "transparent" },
  };

  // Victory needs numeric x for grouped bars; labels on the axis
  const incomeData  = [{ x: 1, y: income }];
  const expenseData = [{ x: 1, y: expenses }];

  return (
    <View style={{ alignItems: "center" }}>
      <VictoryChart
        width={chartWidth}
        height={chartHeight}
        domainPadding={{ x: 80, y: [0, 30] }}
        padding={{ top: 30, bottom: 40, left: 55, right: 20 }}
      >
        <VictoryAxis
          tickValues={[1]}
          tickFormat={() => ""}
          style={axisStyle}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(v: number) => fmtShort(v)}
          style={axisStyle}
        />
        <VictoryGroup offset={28}>
          <VictoryBar
            data={incomeData}
            style={{ data: { fill: COLORS.income } }}
            cornerRadius={{ top: 4 }}
            labels={({ datum }: { datum: { y: number } }) => fmtShort(datum.y)}
            labelComponent={
              <VictoryLabel
                dy={-6}
                style={{ fill: COLORS.income, fontSize: 11, fontWeight: "600" }}
              />
            }
          />
          <VictoryBar
            data={expenseData}
            style={{ data: { fill: COLORS.expense } }}
            cornerRadius={{ top: 4 }}
            labels={({ datum }: { datum: { y: number } }) => fmtShort(datum.y)}
            labelComponent={
              <VictoryLabel
                dy={-6}
                style={{ fill: COLORS.expense, fontSize: 11, fontWeight: "600" }}
              />
            }
          />
        </VictoryGroup>
      </VictoryChart>

      {/* Legend */}
      <View style={chartStyles.legendRow}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: COLORS.income }]} />
          <Text style={chartStyles.legendText}>Income</Text>
          <Text style={[chartStyles.legendValue, { color: COLORS.income }]}>
            {fmt(income)}
          </Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: COLORS.expense }]} />
          <Text style={chartStyles.legendText}>Expenses</Text>
          <Text style={[chartStyles.legendValue, { color: COLORS.expense }]}>
            {fmt(expenses)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Spending by Category pie chart ─────────────────────────────────────────────

function PieChart({
  data,
  width,
}: {
  data: CategoryEntry[];
  width: number;
}) {
  if (data.length === 0) {
    return <ChartEmpty message="No expense transactions yet" />;
  }

  const pieSize = Math.min(width - 32, 220);
  const pieData = data.map((d) => ({
    x: d.name,
    y: d.amount,
    color: d.color,
  }));

  return (
    <View style={{ alignItems: "center" }}>
      <VictoryPie
        data={pieData}
        width={pieSize}
        height={pieSize}
        innerRadius={pieSize * 0.27}
        padAngle={2}
        style={{
          data: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fill: ({ datum }: any) => datum.color as string,
          },
          labels: { display: "none" },
        }}
        labels={() => ""}
        padding={12}
      />
      {/* Legend */}
      <View style={chartStyles.pieLegend}>
        {data.map((d) => (
          <View key={d.name} style={chartStyles.pieLegendRow}>
            <View style={[chartStyles.legendDot, { backgroundColor: d.color }]} />
            <Text style={chartStyles.pieLegendName} numberOfLines={1}>
              {d.name}
            </Text>
            <Text style={chartStyles.pieLegendPct}>{d.pct}%</Text>
            <Text style={chartStyles.pieLegendAmt}>{fmt(d.amount)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Monthly Trends line chart ──────────────────────────────────────────────────

function LineChart({
  data,
  width,
}: {
  data: MonthEntry[];
  width: number;
}) {
  const monthsWithData = data.filter(
    (m) => m.income > 0 || m.expenses > 0
  ).length;

  if (monthsWithData < 2) {
    return (
      <ChartEmpty message="Add transactions across 2+ months to see trends" />
    );
  }

  const chartHeight = 190;
  const incomePoints  = data.map((m) => ({ x: m.x, y: m.income }));
  const expensePoints = data.map((m) => ({ x: m.x, y: m.expenses }));
  const monthLabels   = data.map((m) => m.month);

  const axisStyle = {
    axis:       { stroke: COLORS.border },
    tickLabels: { fill: COLORS.muted, fontSize: 10 },
    grid:       { stroke: COLORS.border, strokeOpacity: 0.4 },
  };

  return (
    <View style={{ alignItems: "center" }}>
      <VictoryChart
        width={width}
        height={chartHeight}
        padding={{ top: 20, bottom: 40, left: 55, right: 20 }}
      >
        <VictoryAxis
          tickValues={[1, 2, 3, 4, 5, 6]}
          tickFormat={(x: number) => monthLabels[x - 1] ?? ""}
          style={axisStyle}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(v: number) => fmtShort(v)}
          style={axisStyle}
        />
        <VictoryLine
          data={incomePoints}
          style={{ data: { stroke: COLORS.income, strokeWidth: 2 } }}
          interpolation="monotoneX"
        />
        <VictoryLine
          data={expensePoints}
          style={{ data: { stroke: COLORS.expense, strokeWidth: 2 } }}
          interpolation="monotoneX"
        />
      </VictoryChart>

      {/* Legend */}
      <View style={chartStyles.legendRow}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendLine, { backgroundColor: COLORS.income }]} />
          <Text style={chartStyles.legendText}>Income</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendLine, { backgroundColor: COLORS.expense }]} />
          <Text style={chartStyles.legendText}>Expenses</Text>
        </View>
      </View>
    </View>
  );
}

// ── Financial Overview card ────────────────────────────────────────────────────

function FinancialOverview({
  transactions,
  chartWidth,
}: {
  transactions: Transaction[];
  chartWidth: number;
}) {
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const categoryData = buildCategoryData(transactions);
  const monthlyData  = buildMonthlyData(transactions);

  const hasAnyData = totalIncome > 0 || totalExpenses > 0;

  return (
    <View style={overviewStyles.card}>
      <Text style={overviewStyles.title}>Financial Overview</Text>

      {!hasAnyData ? (
        <View style={overviewStyles.globalEmpty}>
          <Ionicons name="bar-chart-outline" size={36} color={COLORS.muted} />
          <Text style={overviewStyles.globalEmptyText}>No data yet</Text>
          <Text style={overviewStyles.globalEmptySub}>
            Add a transaction to see your overview
          </Text>
        </View>
      ) : (
        <>
          {/* Income vs Expenses */}
          <ChartSection title="Income vs. Expenses">
            <BarChart
              income={totalIncome}
              expenses={totalExpenses}
              width={chartWidth}
            />
          </ChartSection>

          {/* Monthly Trends */}
          <ChartSection title="Monthly Trends">
            <LineChart data={monthlyData} width={chartWidth} />
          </ChartSection>

          {/* Spending by Category */}
          <ChartSection title="Spending by Category">
            <PieChart data={categoryData} width={chartWidth} />
          </ChartSection>
        </>
      )}
    </View>
  );
}

const overviewStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingTop: 14,
    paddingBottom: 4,
    overflow: "hidden",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  globalEmpty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  globalEmptyText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.muted,
  },
  globalEmptySub: {
    fontSize: 12,
    color: COLORS.muted,
  },
});

const chartStyles = StyleSheet.create({
  section: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  pieLegend: {
    width: "100%",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  pieLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pieLegendName: {
    flex: 1,
    fontSize: 13,
    color: COLORS.muted,
    textTransform: "capitalize",
  },
  pieLegendPct: {
    fontSize: 12,
    color: COLORS.muted,
    minWidth: 32,
    textAlign: "right",
  },
  pieLegendAmt: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
    minWidth: 72,
    textAlign: "right",
  },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { width: screenWidth } = useWindowDimensions();
  // Card has 16px padding each side; chart sits inside card (no extra inset needed)
  const chartWidth = screenWidth - 32;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  async function fetchData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const balance = totalIncome - totalExpenses;
  const recent  = transactions.slice(0, 5);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.purple} />
      </View>
    );
  }

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
        {/* ── Summary cards ── */}
        <View style={styles.cardsRow}>
          <View style={[styles.card, { borderColor: COLORS.income + "40" }]}>
            <Text style={styles.cardLabel}>Income</Text>
            <Text
              style={[styles.cardValue, { color: COLORS.income }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {fmt(totalIncome)}
            </Text>
          </View>

          <View style={[styles.card, { borderColor: COLORS.expense + "40" }]}>
            <Text style={styles.cardLabel}>Expenses</Text>
            <Text
              style={[styles.cardValue, { color: COLORS.expense }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {fmt(totalExpenses)}
            </Text>
          </View>

          <View style={[styles.card, { borderColor: COLORS.purple + "40" }]}>
            <Text style={styles.cardLabel}>Balance</Text>
            <Text
              style={[
                styles.cardValue,
                { color: balance >= 0 ? COLORS.income : COLORS.expense },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {balance < 0 ? "−" : ""}
              {fmt(balance)}
            </Text>
          </View>
        </View>

        {/* ── Financial Overview (charts) ── */}
        <FinancialOverview
          transactions={transactions}
          chartWidth={chartWidth}
        />

        {/* ── Recent transactions ── */}
        <Text style={styles.sectionTitle}>Recent Transactions</Text>

        {recent.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={32} color={COLORS.muted} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {recent.map((t, i) => (
              <View
                key={t.id}
                style={[
                  styles.txRow,
                  i < recent.length - 1 && styles.txRowBorder,
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        t.type === "income" ? COLORS.income : COLORS.expense,
                    },
                  ]}
                />
                <View style={styles.txMeta}>
                  <Text style={styles.txDesc} numberOfLines={1}>
                    {t.description}
                  </Text>
                  <View style={styles.txSubRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{t.category}</Text>
                    </View>
                    <Text style={styles.txDate}>{fmtDate(t.created_at)}</Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    {
                      color:
                        t.type === "income" ? COLORS.income : COLORS.expense,
                    },
                  ]}
                >
                  {t.type === "income" ? "+" : "−"}
                  {fmt(Number(t.amount))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Sign out ── */}
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.muted} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
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
  },
  content: {
    padding: 16,
    gap: 16,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 10,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  cardLabel: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: "700",
    minHeight: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  listCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  txRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    gap: 8,
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
  txDate: {
    fontSize: 11,
    color: COLORS.muted,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 0,
  },
  emptyBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  signOutText: {
    fontSize: 14,
    color: COLORS.muted,
  },
});
