export type TransactionType = "income" | "expense";

export type TransactionCategory =
  | "salary"
  | "freelance"
  | "investment"
  | "gift"
  | "housing"
  | "food"
  | "transport"
  | "entertainment"
  | "health"
  | "education"
  | "shopping"
  | "utilities"
  | "other";

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: TransactionCategory;
  description: string;
  created_at: string;
  is_recurring: boolean;
  recurring_frequency: RecurringFrequency | null;
  next_due_date: string | null;
}

export interface Budget {
  id: string;
  user_id: string;
  category: TransactionCategory;
  monthly_limit: number;
  created_at: string;
}

export interface BudgetWithSpending extends Budget {
  spent: number;
}

export const INCOME_CATEGORIES: TransactionCategory[] = [
  "salary",
  "freelance",
  "investment",
  "gift",
  "other",
];

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  "housing",
  "food",
  "transport",
  "entertainment",
  "health",
  "education",
  "shopping",
  "utilities",
  "other",
];
