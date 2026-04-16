"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSavingsGoal } from "@/app/actions/savings-goals";

const PRESET_COLORS = [
  "#7c3aed", // violet
  "#2563eb", // blue
  "#059669", // emerald
  "#dc2626", // red
  "#d97706", // amber
  "#db2777", // pink
  "#0891b2", // cyan
  "#65a30d", // lime
];

export function CreateGoalDialog() {
  const [open, setOpen]         = useState(false);
  const [name, setName]         = useState("");
  const [target, setTarget]     = useState("");
  const [date, setDate]         = useState("");
  const [color, setColor]       = useState(PRESET_COLORS[0]);
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const router = useRouter();

  function reset() {
    setName("");
    setTarget("");
    setDate("");
    setColor(PRESET_COLORS[0]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amt = parseFloat(target);
    if (!name.trim())     return setError("Goal name is required");
    if (isNaN(amt) || amt <= 0) return setError("Enter a valid target amount");

    setSaving(true);
    const result = await createSavingsGoal({
      name:        name.trim(),
      target_amount: amt,
      target_date: date || null,
      color,
    });
    setSaving(false);

    if (result?.error) return setError(result.error);

    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" className="min-h-[44px] sm:min-h-0" />}>
        <Plus className="mr-2 h-4 w-4" />
        New Goal
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Savings Goal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="goal-name">
              Goal name
            </label>
            <Input
              id="goal-name"
              placeholder="e.g. Emergency Fund"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* Target amount */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="goal-target">
              Target amount ($)
            </label>
            <Input
              id="goal-target"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>

          {/* Target date (optional) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="goal-date">
              Target date{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              id="goal-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Color</p>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "white" : "transparent",
                    outline: color === c ? `2px solid ${c}` : "none",
                    outlineOffset: "2px",
                  }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? "Saving…" : "Create Goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
