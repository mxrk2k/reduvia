"use client";

import { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/formatters";
import type { Transaction } from "@/types";

interface SpendingChartProps {
  transactions: Transaction[];
}

// ── Colours ──────────────────────────────────────────────────────────────────

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

// ── Data helpers ──────────────────────────────────────────────────────────────

interface ChartEntry { name: string; value: number; color: string }

function buildCategoryData(transactions: Transaction[]): ChartEntry[] {
  const totals = transactions
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + Number(t.amount);
      return acc;
    }, {});

  return Object.entries(totals)
    .map(([cat, value]) => ({
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      value,
      color: CATEGORY_COLORS[cat] ?? DEFAULT_COLOR,
    }))
    .sort((a, b) => b.value - a.value);
}

interface MonthlyEntry {
  month: string;
  income: number;
  expenses: number;
}

function buildMonthlyTrends(transactions: Transaction[]): MonthlyEntry[] {
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
    };
  });
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-muted-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

function BarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; fill: string }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md space-y-1">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-medium tabular-nums">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
  isDark,
}: {
  active?: boolean;
  // Recharts TooltipPayload is ReadonlyArray<TooltipPayloadEntry>; use readonly any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  label?: string;
  isDark: boolean;
}) {
  if (!active || !payload?.length) return null;

  const income   = payload.find((p) => p.name === "income");
  const expenses = payload.find((p) => p.name === "expenses");

  return (
    <div
      style={{
        background:   isDark ? "#1e293b" : "#ffffff",
        border:       `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
        borderRadius: 8,
        padding:      "10px 14px",
        color:        isDark ? "#f1f5f9" : "#0f172a",
        fontSize:     13,
        minWidth:     140,
        boxShadow:    "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {income && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
          <span style={{ color: isDark ? "#6ee7b7" : "#059669" }}>Income</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: isDark ? "#10b981" : "#059669" }}>
            {formatCurrency(income.value)}
          </span>
        </div>
      )}
      {expenses && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: isDark ? "#fda4af" : "#e11d48" }}>Expenses</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: isDark ? "#f43f5e" : "#e11d48" }}>
            {formatCurrency(expenses.value)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Custom active dot (glow ring) ─────────────────────────────────────────────

function ActiveDot({
  cx,
  cy,
  fill,
}: {
  cx?: number;
  cy?: number;
  fill?: string;
}) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={fill} opacity={0.2} />
      <circle cx={cx} cy={cy} r={5} fill={fill} stroke="white" strokeWidth={1.5} />
    </g>
  );
}

// ── Monthly trends chart ──────────────────────────────────────────────────────

function MonthlyTrendsChart({
  trendData,
  isDark,
}: {
  trendData: MonthlyEntry[];
  isDark: boolean;
}) {
  const monthsWithData = trendData.filter(
    (m) => m.income > 0 || m.expenses > 0
  ).length;

  const incomeColor   = isDark ? "#10b981" : "#059669";
  const expenseColor  = isDark ? "#f43f5e" : "#e11d48";
  const gridOpacity   = isDark ? 0.10 : 0.08;
  const axisTextColor = isDark ? "#9ca3af" : "#6b7280";
  const fillOpacity   = isDark ? 0.20 : 0.15;

  if (monthsWithData < 2) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-muted-foreground">Not enough data yet</p>
        <p className="text-xs text-muted-foreground">
          Add transactions across at least 2 months to see trends
        </p>
      </div>
    );
  }

  const gridColor = isDark
    ? `rgba(255,255,255,${gridOpacity})`
    : `rgba(0,0,0,${gridOpacity})`;

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={trendData}
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={incomeColor}  stopOpacity={fillOpacity} />
              <stop offset="95%" stopColor={incomeColor}  stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={expenseColor} stopOpacity={fillOpacity} />
              <stop offset="95%" stopColor={expenseColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={gridColor}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fill: axisTextColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fill: axisTextColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            content={({ active, payload, label }) => (
              <TrendTooltip
                active={active}
                payload={payload}
                label={label !== undefined ? String(label) : undefined}
                isDark={isDark}
              />
            )}
            cursor={{ stroke: gridColor, strokeWidth: 1 }}
          />

          <Area
            type="monotone"
            dataKey="income"
            name="income"
            stroke={incomeColor}
            strokeWidth={2}
            fill="url(#gradIncome)"
            dot={{ r: 3, fill: incomeColor, strokeWidth: 0 }}
            activeDot={<ActiveDot fill={incomeColor} />}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            name="expenses"
            stroke={expenseColor}
            strokeWidth={2}
            fill="url(#gradExpenses)"
            dot={{ r: 3, fill: expenseColor, strokeWidth: 0 }}
            activeDot={<ActiveDot fill={expenseColor} />}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SpendingChart({ transactions }: SpendingChartProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const categoryData = buildCategoryData(transactions);
  const trendData    = buildMonthlyTrends(transactions);

  const totalIncome   = transactions.filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const hasAnyData = totalIncome > 0 || totalExpenses > 0;
  const hasExpenses = totalExpenses > 0;

  const barData = [{ name: "Overview", Income: totalIncome, Expenses: totalExpenses }];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Financial Overview</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {!hasAnyData ? (
          /* ── Global empty state ── */
          <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-muted-foreground">No data yet</p>
            <p className="text-xs text-muted-foreground">
              Add a transaction to see your overview
            </p>
          </div>
        ) : (
          <>
            {/* ── Income vs Expenses bar ── */}
            <div>
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                Income vs. Expenses
              </p>

              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barData}
                    margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" hide />
                    <YAxis
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: "transparent" }} />
                    <Bar dataKey="Income"   name="Income"   fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={72} />
                    <Bar dataKey="Expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={72} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary row below bars */}
              <div className="mt-3 flex gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Income</span>
                  <span className="font-semibold tabular-nums text-emerald-600">
                    {formatCurrency(totalIncome)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <span className="text-muted-foreground">Expenses</span>
                  <span className="font-semibold tabular-nums text-rose-600">
                    {formatCurrency(totalExpenses)}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Monthly trends ── */}
            <Separator />
            <div>
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                Monthly Trends
              </p>
              {/* Legend */}
              <div className="mb-3 flex gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="block h-0.5 w-4 rounded-full"
                    style={{ backgroundColor: isDark ? "#10b981" : "#059669" }}
                  />
                  Income
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="block h-0.5 w-4 rounded-full"
                    style={{ backgroundColor: isDark ? "#f43f5e" : "#e11d48" }}
                  />
                  Expenses
                </div>
              </div>
              <MonthlyTrendsChart trendData={trendData} isDark={isDark} />
            </div>

            {/* ── Spending by category ── */}
            {hasExpenses && (
              <>
                <Separator />
                <div>
                  <p className="mb-3 text-sm font-medium text-muted-foreground">
                    Spending by Category
                  </p>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {/* Donut */}
                    <div className="h-52 w-full shrink-0 sm:w-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius="52%"
                            outerRadius="78%"
                            paddingAngle={2}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {categoryData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Category legend */}
                    <ul className="flex flex-1 flex-col gap-2">
                      {categoryData.map((entry) => {
                        const pct = Math.round((entry.value / totalExpenses) * 100);
                        return (
                          <li key={entry.name} className="flex items-center gap-2 text-sm">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="flex-1 truncate text-muted-foreground">
                              {entry.name}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {pct}%
                            </span>
                            <span className="tabular-nums font-medium">
                              {formatCurrency(entry.value)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
