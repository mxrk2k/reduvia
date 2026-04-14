"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dismissImportPrompt } from "@/app/actions/user-preferences";

interface OnboardingPopupProps {
  /** Whether to show the popup on mount (determined server-side). */
  initialShow: boolean;
}

export function OnboardingPopup({ initialShow }: OnboardingPopupProps) {
  const [open, setOpen] = useState(initialShow);
  const [neverShow, setNeverShow] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleLater() {
    if (neverShow) {
      // Persist preference then close
      startTransition(async () => {
        await dismissImportPrompt();
        setOpen(false);
      });
    } else {
      setOpen(false);
    }
  }

  function handleImportNow() {
    if (neverShow) {
      // Fire and forget — don't block navigation
      startTransition(async () => { await dismissImportPrompt(); });
    }
    setOpen(false);
    router.push("/import");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleLater(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-lg">
            Get Complete Financial Insights
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            Import your bank statement (CSV or PDF) to see AI-powered analysis of
            your spending — automatic categorization, monthly trends, and more.
          </DialogDescription>
        </DialogHeader>

        {/* Action buttons */}
        <div className="mt-2 flex flex-col gap-2">
          <Button className="w-full" onClick={handleImportNow} disabled={isPending}>
            Import Now
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleLater}
            disabled={isPending}
          >
            Later
          </Button>
        </div>

        {/* "Do not remind me" checkbox */}
        <label className="flex cursor-pointer items-center justify-center gap-2 pt-1">
          <input
            type="checkbox"
            checked={neverShow}
            onChange={(e) => setNeverShow(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-xs text-muted-foreground">Do not remind me again</span>
        </label>
      </DialogContent>
    </Dialog>
  );
}
