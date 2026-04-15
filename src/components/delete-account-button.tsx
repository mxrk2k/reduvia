"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { deleteAccount } from "@/app/actions/account";

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const result = await deleteAccount();
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    // Account deleted — hard redirect so auth state is fully cleared
    router.push("/login");
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete Account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This will permanently delete all your data — transactions,
              budgets, recurring transactions, and account settings. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={loading} />
              }
            >
              Cancel
            </DialogClose>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="inline-flex h-8 items-center justify-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? "Deleting…" : "Delete My Account"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
