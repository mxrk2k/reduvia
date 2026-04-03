export const COLORS = {
  bg: "#0f0f1a",
  surface: "#1a1a2e",
  border: "#2a2a4a",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  text: "#f1f5f9",
  muted: "#64748b",
  income: "#10b981",
  expense: "#f43f5e",
} as const;

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Budgets: undefined;
  Recurring: undefined;
};
