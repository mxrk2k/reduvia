"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/formatters";
import type { MonthlyTrend, CategorySpend } from "@/app/actions/bank-statements";

// ── Props ─────────────────────────────────────────────────────────────────────

interface BankChartsProps {
  monthlyTrends: MonthlyTrend[];
  spendingByCategory: CategorySpend[];
  totalExpenses: number;
}

// ── Colors ────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  housing:       "#f97316",
  food:          "#eab308",
  transport:     "#3b82f6",
  entertainment: "#a855f7",
  health:        "#ec4899",
  education:     "#06b6d4",
  shopping:      "#f43f5e",
  utilities:     "#64748b",
  salary:        "#10b981",
  freelance:     "#0ea5e9",
  investment:    "#8b5cf6",
  other:         "#94a3b8",
};
const DEFAULT_COLOR = "#94a3b8";

// ── Tooltip components ────────────────────────────────────────────────────────

function TrendTooltip({
  active,
  payload,
  label,
  isDark,
}: {
  active?: boolean;
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
        minWidth:     150,
        boxShadow:    "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {income && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3 }}>
          <span style={{ color: isDark ? "#6ee7b7" : "#059669" }}>Income</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: isDark ? "#10b981" : "#059669" }}>
            {formatCurrency(income.value)}
          </span>
        </div>
      )}
      {expenses && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: isDark ? "#fda4af" : "#e11d48" }}>Expenses</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: isDark ? "#f43f5e" : "#e11d48" }}>
            {formatCurrency(expenses.value)}
          </span>
        </div>
      )}
    </div>
  );
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium capitalize">{payload[0].name}</p>
      <p className="text-muted-foreground">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// ── Active dot ────────────────────────────────────────────────────────────────

function ActiveDot({ cx, cy, fill }: { cx?: number; cy?: number; fill?: string }) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={fill} opacity={0.2} />
      <circle cx={cx} cy={cy} r={5} fill={fill} stroke="white" strokeWidth={1.5} />
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BankCharts({
  monthlyTrends,
  spendingByCategory,
  totalExpenses,
}: BankChartsProps) {
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

  const incomeColor  = isDark ? "#10b981" : "#059669";
  const expenseColor = isDark ? "#f43f5e" : "#e11d48";
  const gridColor    = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const axisColor    = isDark ? "#9ca3af" : "#6b7280";
  const fillOpacity  = isDark ? 0.18 : 0.12;

  const hasMonthlyData = monthlyTrends.some((m) => m.income > 0 || m.expenses > 0);
  const hasCategoryData = spendingByCategory.length > 0;

  // Format YYYY-MM → short month label
  const trendData = monthlyTrends.map((m) => ({
    ...m,
    label: new Date(m.month + "-01T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
  }));

  const categoryData = spendingByCategory.map((c) => ({
    name: c.category,
    value: c.total,
    color: CATEGORY_COLORS[c.category] ?? DEFAULT_COLOR,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Financial Overview</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Monthly trends ── */}
        <div>
          <p className="mb-3 text-sm font-medium text-muted-foreground">Monthly Trends</p>

          {/* Legend */}
          <div className="mb-3 flex gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="block h-0.5 w-4 rounded-full"
                style={{ backgroundColor: incomeColor }}
              />
              Income
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="block h-0.5 w-4 rounded-full"
                style={{ backgroundColor: expenseColor }}
              />
              Expenses
            </div>
          </div>

          {!hasMonthlyData ? (
            <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm text-muted-foreground">No trend data available</p>
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bankGradIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={incomeColor}  stopOpacity={fillOpacity} />
                      <stop offset="95%" stopColor={incomeColor}  stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bankGradExpenses" x1="0" y1="0" x2="0" y2="1">
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
                    dataKey="label"
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fill: axisColor, fontSize: 11 }}
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
                    fill="url(#bankGradIncome)"
                    dot={{ r: 3, fill: incomeColor, strokeWidth: 0 }}
                    activeDot={<ActiveDot fill={incomeColor} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="expenses"
                    stroke={expenseColor}
                    strokeWidth={2}
                    fill="url(#bankGradExpenses)"
                    dot={{ r: 3, fill: expenseColor, strokeWidth: 0 }}
                    activeDot={<ActiveDot fill={expenseColor} />}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── Spending by category ── */}
        {hasCategoryData && (
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
                      <Tooltip content={<CategoryTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <ul className="flex flex-1 flex-col gap-2">
                  {categoryData.map((entry) => {
                    const pct =
                      totalExpenses > 0
                        ? Math.round((entry.value / totalExpenses) * 100)
                        : 0;
                    return (
                      <li key={entry.name} className="flex items-center gap-2 text-sm">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="flex-1 truncate capitalize text-muted-foreground">
                          {entry.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{pct}%</span>
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
      </CardContent>
    </Card>
  );
}
