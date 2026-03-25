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

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: TransactionCategory;
  description: string;
  created_at: string;
}

export interface Budget {
  id: string;
  category: TransactionCategory;
  limit: number;
  spent: number;
  period: "monthly" | "weekly" | "yearly";
}
