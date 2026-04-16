import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { Transaction } from "@/types";

interface SummaryCardsProps {
  transactions: Transaction[];
  currency: string;
}

export function SummaryCards({ transactions, currency }: SummaryCardsProps) {
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const balance = totalIncome - totalExpenses;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Income
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold text-emerald-600 sm:text-2xl">
            {formatCurrency(totalIncome, currency)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold text-rose-600 sm:text-2xl">
            {formatCurrency(totalExpenses, currency)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-xl font-bold sm:text-2xl ${
              balance >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {formatCurrency(balance, currency)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
