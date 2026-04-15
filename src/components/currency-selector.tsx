"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { updateUserCurrency } from "@/app/actions/user-preferences";

interface CurrencySelectorProps {
  currentCurrency: string;
}

export function CurrencySelector({ currentCurrency }: CurrencySelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    startTransition(async () => {
      await updateUserCurrency(code);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={currentCurrency}
        onChange={handleChange}
        disabled={isPending}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
      >
        {SUPPORTED_CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.symbol} — {c.name} ({c.code})
          </option>
        ))}
      </select>
      {isPending && (
        <span className="text-xs text-muted-foreground">Saving…</span>
      )}
    </div>
  );
}
