"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { upsertHouseholdBudget } from "@/app/actions/household";
import { EXPENSE_CATEGORIES } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UpsertBudgetDialogProps {
  householdId: string;
  /** When provided, the dialog is an "edit" dialog pre-filled with the existing budget. */
  existing?: {
    category: string;
    amount: number;
  };
  /** Categories that already have a budget set (hidden from the "add" dropdown). */
  usedCategories?: string[];
  currency: string;
}

export function UpsertBudgetDialog({
  householdId,
  existing,
  usedCategories = [],
  currency,
}: UpsertBudgetDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(existing);

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(existing?.category ?? "");
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableCategories = EXPENSE_CATEGORIES.filter(
    (c) => !usedCategories.includes(c) || c === existing?.category
  );

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (!o) {
      setError(null);
      if (!isEdit) {
        setCategory("");
        setAmount("");
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }
    startTransition(async () => {
      const result = await upsertHouseholdBudget(householdId, category, parsed);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger>
        {isEdit ? (
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Edit ${existing?.category} budget`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Budget
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Budget" : "Add Shared Budget"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Category */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Category</label>
            {isEdit ? (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm capitalize">
                {existing?.category}
              </p>
            ) : (
              <Select
                value={category}
                onValueChange={setCategory}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor="budget-amount"
              className="mb-1.5 block text-sm font-medium"
            >
              Monthly limit ({currency})
            </label>
            <Input
              id="budget-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !category || !amount}
            >
              {isPending ? "Saving…" : isEdit ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
