"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Home } from "lucide-react";
import { createHousehold } from "@/app/actions/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateHouseholdForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createHousehold(name);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Home className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          Create a shared household
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Invite family or housemates to track budgets together. Combined
          spending from all members counts toward each shared budget.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
          <div>
            <label
              htmlFor="household-name"
              className="mb-1.5 block text-sm font-medium"
            >
              Household name
            </label>
            <Input
              id="household-name"
              placeholder="e.g. Smith Family"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              required
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !name.trim()}
          >
            {isPending ? "Creating…" : "Create Household"}
          </Button>
        </form>
      </div>
    </div>
  );
}
