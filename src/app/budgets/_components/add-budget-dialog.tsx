"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";

import { addBudget } from "@/app/actions/budgets";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { TransactionCategory } from "@/types";

const schema = z.object({
  category: z.string().min(1, "Please select a category"),
  monthly_limit: z.coerce.number().positive("Limit must be greater than 0"),
});

type FormValues = z.infer<typeof schema>;

export function AddBudgetDialog({
  existingCategories,
  triggerClassName,
}: {
  existingCategories: string[];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { category: "", monthly_limit: 0 },
  });

  const availableCategories = EXPENSE_CATEGORIES.filter(
    (cat) => !existingCategories.includes(cat)
  );

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await addBudget({
      category: values.category as TransactionCategory,
      monthly_limit: values.monthly_limit,
    });
    if (result?.error) {
      setServerError(result.error);
      return;
    }
    form.reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setServerError(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" className={triggerClassName} />}>
        <Plus className="mr-2 h-4 w-4" />
        Add Budget
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Budget</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-2"
          >
            {serverError && (
              <p className="text-sm font-medium text-destructive">
                {serverError}
              </p>
            )}

            {availableCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All expense categories already have a budget assigned.
              </p>
            ) : (
              <>
                <Controller
                  control={form.control}
                  name="category"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCategories.map((cat) => (
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

                <FormField
                  control={form.control}
                  name="monthly_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Limit ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Saving..." : "Save"}
                  </Button>
                </div>
              </>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
