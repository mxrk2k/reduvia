"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCustomCategory,
  deleteCustomCategory,
} from "@/app/actions/categories";
import type { CustomCategory } from "@/app/actions/categories";

interface CustomCategoriesManagerProps {
  initialCategories: CustomCategory[];
}

export function CustomCategoriesManager({
  initialCategories,
}: CustomCategoriesManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName]             = useState("");
  const [type, setType]             = useState<"income" | "expense">("expense");
  const [error, setError]           = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = await createCustomCategory({ name, type });
    if (result?.error) {
      setError(result.error);
      return;
    }

    // Optimistic update — server revalidates /settings in the background
    const newCat: CustomCategory = {
      id:         crypto.randomUUID(),
      user_id:    "",
      name:       name.trim().toLowerCase(),
      type,
      created_at: new Date().toISOString(),
    };
    setCategories((prev) =>
      [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name))
    );
    setName("");
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCustomCategory(id);
      if (!result?.error) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
      }
    });
  }

  const income  = categories.filter((c) => c.type === "income");
  const expense = categories.filter((c) => c.type === "expense");

  return (
    <div className="space-y-6">
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            className="flex-1"
          />
          <Select value={type} onValueChange={(v) => v && setType(v as "income" | "expense")}>
            <SelectTrigger className="w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="sm" className="w-full sm:w-auto min-h-[44px] sm:min-h-0">
          Add
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Income categories */}
      {income.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Income
          </p>
          <div className="flex flex-wrap gap-2">
            {income.map((cat) => (
              <span
                key={cat.id}
                className="flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-sm"
              >
                {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                <button
                  type="button"
                  onClick={() => handleDelete(cat.id)}
                  disabled={isPending}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Delete ${cat.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expense categories */}
      {expense.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Expense
          </p>
          <div className="flex flex-wrap gap-2">
            {expense.map((cat) => (
              <span
                key={cat.id}
                className="flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-sm"
              >
                {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                <button
                  type="button"
                  onClick={() => handleDelete(cat.id)}
                  disabled={isPending}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Delete ${cat.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No custom categories yet. Add one above.
        </p>
      )}
    </div>
  );
}
