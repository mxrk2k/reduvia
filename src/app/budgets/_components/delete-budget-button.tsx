"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteBudget } from "@/app/actions/budgets";

export function DeleteBudgetButton({ budgetId }: { budgetId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    await deleteBudget(budgetId);
    router.refresh();
    setLoading(false);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-11 w-11 text-muted-foreground hover:text-destructive sm:h-8 sm:w-8"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
