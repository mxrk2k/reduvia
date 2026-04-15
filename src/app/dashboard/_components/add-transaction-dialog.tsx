"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil } from "lucide-react";

import { addTransaction, updateTransaction } from "@/app/actions/transactions";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/types";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Transaction, TransactionCategory, RecurringFrequency } from "@/types";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z
  .object({
    type:                z.enum(["income", "expense"]),
    amount:              z.coerce.number().positive("Amount must be greater than 0"),
    category:            z.string().min(1, "Please select a category"),
    description:         z.string().min(1, "Description is required").max(100),
    date:                z.string().min(1, "Date is required"),
    is_recurring:        z.boolean(),
    recurring_frequency: z.enum(["weekly", "monthly", "yearly"]).optional(),
  })
  .refine((d) => !d.is_recurring || !!d.recurring_frequency, {
    message: "Please select a frequency",
    path: ["recurring_frequency"],
  });

type FormValues = z.infer<typeof schema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateInputValue(isoString: string): string {
  // created_at may be a full ISO timestamp or a YYYY-MM-DD string
  return isoString.slice(0, 10);
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AddTransactionDialogProps {
  triggerClassName?: string;
  /** When provided the dialog operates in edit mode */
  transaction?: Transaction;
}

export function AddTransactionDialog({
  triggerClassName,
  transaction,
}: AddTransactionDialogProps) {
  const isEdit = !!transaction;
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: isEdit
      ? {
          type:                transaction.type,
          amount:              transaction.amount,
          category:            transaction.category,
          description:         transaction.description,
          date:                toDateInputValue(transaction.created_at),
          is_recurring:        transaction.is_recurring,
          recurring_frequency: transaction.recurring_frequency ?? undefined,
        }
      : {
          type:                "expense",
          amount:              0,
          category:            "",
          description:         "",
          date:                todayInputValue(),
          is_recurring:        false,
          recurring_frequency: undefined,
        },
  });

  const selectedType = form.watch("type");
  const isRecurring  = form.watch("is_recurring");
  const categories   = selectedType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const result = isEdit
      ? await updateTransaction(transaction.id, {
          type:                values.type,
          amount:              values.amount,
          category:            values.category as TransactionCategory,
          description:         values.description,
          date:                values.date,
          is_recurring:        values.is_recurring,
          recurring_frequency: values.is_recurring
            ? (values.recurring_frequency as RecurringFrequency)
            : undefined,
        })
      : await addTransaction({
          type:                values.type,
          amount:              values.amount,
          category:            values.category as TransactionCategory,
          description:         values.description,
          is_recurring:        values.is_recurring,
          recurring_frequency: values.is_recurring
            ? (values.recurring_frequency as RecurringFrequency)
            : undefined,
        });

    if (result?.error) {
      setServerError(result.error);
      return;
    }

    if (!isEdit) form.reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setServerError(null);
          // Reset edit form back to original values when closed without saving
          if (isEdit) form.reset();
        }
      }}
    >
      {isEdit ? (
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
            />
          }
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit transaction</span>
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" className={triggerClassName} />}>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {serverError && (
              <p className="text-sm font-medium text-destructive">{serverError}</p>
            )}

            {/* Type */}
            <Controller
              control={form.control}
              name="type"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      form.setValue("category", "");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.error && (
                    <p className="text-sm font-medium text-destructive">
                      {fieldState.error.message}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <Controller
              control={form.control}
              name="category"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && (
                    <p className="text-sm font-medium text-destructive">
                      {fieldState.error.message}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Monthly rent" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Recurring toggle */}
            <FormField
              control={form.control}
              name="is_recurring"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2.5">
                    <input
                      type="checkbox"
                      id="is_recurring"
                      checked={field.value}
                      onChange={(e) => {
                        field.onChange(e.target.checked);
                        if (!e.target.checked) {
                          form.setValue("recurring_frequency", undefined);
                        }
                      }}
                      className="h-4 w-4 accent-primary cursor-pointer"
                    />
                    <FormLabel
                      htmlFor="is_recurring"
                      className="cursor-pointer font-normal text-sm mb-0"
                    >
                      Make this recurring
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Frequency — shown only when recurring is checked */}
            {isRecurring && (
              <Controller
                control={form.control}
                name="recurring_frequency"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldState.error && (
                      <p className="text-sm font-medium text-destructive">
                        {fieldState.error.message}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "Saving..."
                  : isEdit
                  ? "Save Changes"
                  : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
