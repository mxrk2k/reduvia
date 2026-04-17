"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarClock,
  CreditCard,
  Check,
  X,
  Receipt,
} from "lucide-react";
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
  createSubscription,
  updateSubscription,
  deleteSubscription,
  detectSubscriptionsFromTransactions,
} from "@/app/actions/subscriptions";
import type { Subscription, SuggestedSubscription } from "@/app/actions/subscriptions";

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Entertainment",
  "Software & Apps",
  "Finance",
  "Health & Fitness",
  "Food & Drink",
  "News & Media",
  "Shopping",
  "Utilities",
  "Education",
  "Other",
];

const BILLING_CYCLES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMonthly(amount: number, cycle: string): number {
  if (cycle === "weekly")  return (amount * 52) / 12;
  if (cycle === "yearly")  return amount / 12;
  return amount;
}

function toAnnual(amount: number, cycle: string): number {
  if (cycle === "weekly")  return amount * 52;
  if (cycle === "monthly") return amount * 12;
  return amount;
}

type BillingStatus = "overdue" | "due_soon" | "upcoming";

function getBillingStatus(nextBillingDate: string): BillingStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const billing = new Date(nextBillingDate + "T00:00:00");
  const diffDays = Math.floor((billing.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0)  return "overdue";
  if (diffDays <= 7) return "due_soon";
  return "upcoming";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// ── Native Select ──────────────────────────────────────────────────────────────

function NativeSelect({
  id,
  value,
  onChange,
  children,
  className = "",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className}`}
    >
      {children}
    </select>
  );
}

// ── Subscription Form ──────────────────────────────────────────────────────────

interface FormState {
  name: string;
  amount: string;
  billing_cycle: "weekly" | "monthly" | "yearly";
  next_billing_date: string;
  category: string;
}

const defaultForm = (): FormState => ({
  name:              "",
  amount:            "",
  billing_cycle:     "monthly",
  next_billing_date: "",
  category:          "Other",
});

function SubscriptionForm({
  initial,
  onSubmit,
  onCancel,
  saving,
  error,
  submitLabel,
}: {
  initial: FormState;
  onSubmit: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="sub-name">Name</label>
        <Input
          id="sub-name"
          placeholder="e.g. Netflix"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={80}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="sub-amount">Amount ($)</label>
          <Input
            id="sub-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="sub-cycle">Billing cycle</label>
          <NativeSelect
            id="sub-cycle"
            value={form.billing_cycle}
            onChange={(v) => set("billing_cycle", v)}
          >
            {BILLING_CYCLES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="sub-date">Next billing date</label>
        <Input
          id="sub-date"
          type="date"
          value={form.next_billing_date}
          onChange={(e) => set("next_billing_date", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="sub-cat">Category</label>
        <NativeSelect
          id="sub-cat"
          value={form.category}
          onChange={(v) => set("category", v)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ── Add Dialog ─────────────────────────────────────────────────────────────────

function AddSubscriptionDialog({ prefill }: { prefill?: Partial<FormState> }) {
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const router = useRouter();

  const initial: FormState = { ...defaultForm(), ...prefill };

  async function handleSubmit(form: FormState) {
    setError(null);
    const amt = parseFloat(form.amount);
    if (!form.name.trim()) return setError("Name is required");
    if (isNaN(amt) || amt < 0) return setError("Enter a valid amount");
    if (!form.next_billing_date) return setError("Next billing date is required");

    setSaving(true);
    const result = await createSubscription({
      name:              form.name,
      amount:            amt,
      billing_cycle:     form.billing_cycle,
      next_billing_date: form.next_billing_date,
      category:          form.category,
    });
    setSaving(false);

    if (result?.error) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger render={<Button size="sm" className="min-h-[44px] sm:min-h-0" />}>
        <Plus className="mr-2 h-4 w-4" />
        Add Subscription
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Subscription</DialogTitle>
        </DialogHeader>
        <SubscriptionForm
          initial={initial}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
          saving={saving}
          error={error}
          submitLabel="Add"
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Dialog ────────────────────────────────────────────────────────────────

function EditSubscriptionDialog({ sub }: { sub: Subscription }) {
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const router = useRouter();

  const initial: FormState = {
    name:              sub.name,
    amount:            String(sub.amount),
    billing_cycle:     sub.billing_cycle,
    next_billing_date: sub.next_billing_date,
    category:          sub.category,
  };

  async function handleSubmit(form: FormState) {
    setError(null);
    const amt = parseFloat(form.amount);
    if (!form.name.trim()) return setError("Name is required");
    if (isNaN(amt) || amt < 0) return setError("Enter a valid amount");
    if (!form.next_billing_date) return setError("Next billing date is required");

    setSaving(true);
    const result = await updateSubscription(sub.id, {
      name:              form.name,
      amount:            amt,
      billing_cycle:     form.billing_cycle,
      next_billing_date: form.next_billing_date,
      category:          form.category,
    });
    setSaving(false);

    if (result?.error) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Edit subscription"
          />
        }
      >
        <Edit2 className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Subscription</DialogTitle>
        </DialogHeader>
        <SubscriptionForm
          initial={initial}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
          saving={saving}
          error={error}
          submitLabel="Save changes"
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BillingStatus }) {
  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <XCircle className="h-3 w-3" />
        Overdue
      </span>
    );
  }
  if (status === "due_soon") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Due soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />
      Paid
    </span>
  );
}

// ── Subscription Card ──────────────────────────────────────────────────────────

function SubscriptionCard({ sub }: { sub: Subscription }) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const status = getBillingStatus(sub.next_billing_date);

  async function handleDelete() {
    if (!confirm(`Delete "${sub.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await deleteSubscription(sub.id);
    router.refresh();
  }

  const cycleLabel =
    sub.billing_cycle === "weekly"
      ? "/wk"
      : sub.billing_cycle === "monthly"
      ? "/mo"
      : "/yr";

  return (
    <div
      className={`rounded-xl border bg-card p-4 shadow-sm space-y-3 ${
        !sub.is_active ? "opacity-60" : ""
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="truncate font-semibold leading-tight">{sub.name}</h3>
            {!sub.is_active && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub.category}</p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <EditSubscriptionDialog sub={sub} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete subscription"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Amount + billing cycle */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">
            {fmt(sub.amount)}
            <span className="ml-0.5 text-sm font-normal text-muted-foreground">
              {cycleLabel}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {fmt(toMonthly(sub.amount, sub.billing_cycle))}/mo ·{" "}
            {fmt(toAnnual(sub.amount, sub.billing_cycle))}/yr
          </p>
        </div>

        <StatusBadge status={status} />
      </div>

      {/* Next billing date */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
        Next billing: {formatDate(sub.next_billing_date)}
      </div>
    </div>
  );
}

// ── Summary Card ───────────────────────────────────────────────────────────────

function SummaryCard({ subscriptions }: { subscriptions: Subscription[] }) {
  const active = subscriptions.filter((s) => s.is_active);
  const totalMonthly = active.reduce(
    (sum, s) => sum + toMonthly(s.amount, s.billing_cycle),
    0
  );
  const totalAnnual = active.reduce(
    (sum, s) => sum + toAnnual(s.amount, s.billing_cycle),
    0
  );

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Subscription Overview</h2>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold tabular-nums">{active.length}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Active</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{fmt(totalMonthly)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Monthly</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{fmt(totalAnnual)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Annually</p>
        </div>
      </div>
    </div>
  );
}

// ── Suggestion Card ────────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  accepting,
}: {
  suggestion: SuggestedSubscription;
  onAccept: () => void;
  onDismiss: () => void;
  accepting: boolean;
}) {
  const cycleLabel =
    suggestion.billing_cycle === "weekly"
      ? "/wk"
      : suggestion.billing_cycle === "monthly"
      ? "/mo"
      : "/yr";

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{suggestion.name}</p>
        <p className="text-xs text-muted-foreground">
          {fmt(suggestion.amount)}{cycleLabel} · {suggestion.category}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={onAccept}
          disabled={accepting}
        >
          <Check className="h-3 w-3" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={onDismiss}
          disabled={accepting}
        >
          <X className="h-3 w-3" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
      <Receipt className="mb-3 h-10 w-10 text-muted-foreground/40" />
      <p className="font-medium text-muted-foreground">No subscriptions yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add one manually or detect them from your transactions.
      </p>
    </div>
  );
}

// ── Main Client Component ──────────────────────────────────────────────────────

export function SubscriptionsClient({
  initialSubscriptions,
}: {
  initialSubscriptions: Subscription[];
}) {
  const [subscriptions] = useState(initialSubscriptions);
  const [suggestions, setSuggestions]   = useState<SuggestedSubscription[]>([]);
  const [detecting, setDetecting]       = useState(false);
  const [detectError, setDetectError]   = useState<string | null>(null);
  const [acceptingIdx, setAcceptingIdx] = useState<number | null>(null);
  const router = useRouter();

  async function handleDetect() {
    setDetecting(true);
    setDetectError(null);
    setSuggestions([]);
    try {
      const results = await detectSubscriptionsFromTransactions();
      if (results.length === 0) {
        setDetectError("No recurring patterns found in your transactions.");
      } else {
        setSuggestions(results);
      }
    } catch {
      setDetectError("Something went wrong. Please try again.");
    } finally {
      setDetecting(false);
    }
  }

  async function handleAccept(idx: number) {
    const s = suggestions[idx];
    setAcceptingIdx(idx);
    const result = await createSubscription({ ...s, auto_detected: true });
    setAcceptingIdx(null);
    if (!result?.error) {
      setSuggestions((prev) => prev.filter((_, i) => i !== idx));
      router.refresh();
    }
  }

  function handleDismiss(idx: number) {
    setSuggestions((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <SummaryCard subscriptions={subscriptions} />

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        <AddSubscriptionDialog />
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] sm:min-h-0 gap-2"
          onClick={handleDetect}
          disabled={detecting}
        >
          <RefreshCw className={`h-4 w-4 ${detecting ? "animate-spin" : ""}`} />
          {detecting ? "Detecting…" : "Detect from transactions"}
        </Button>
      </div>

      {/* Detect error */}
      {detectError && (
        <p className="text-sm text-muted-foreground">{detectError}</p>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold">Detected Subscriptions</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {suggestions.length} recurring pattern{suggestions.length !== 1 ? "s" : ""} found — accept to start tracking.
            </p>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <SuggestionCard
                key={`${s.name}-${i}`}
                suggestion={s}
                onAccept={() => handleAccept(i)}
                onDismiss={() => handleDismiss(i)}
                accepting={acceptingIdx === i}
              />
            ))}
          </div>
          <div className="border-t" />
        </div>
      )}

      {/* Subscriptions list */}
      {subscriptions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {subscriptions.map((sub) => (
            <SubscriptionCard key={sub.id} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}
