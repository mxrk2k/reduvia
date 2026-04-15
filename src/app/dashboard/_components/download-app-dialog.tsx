"use client";

import { useState } from "react";
import { Smartphone, QrCode, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// ── Trigger button (exported for use in the server-rendered header) ────────────

export function DownloadAppButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Download mobile app"
        className="flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-0"
      >
        <Smartphone className="h-4 w-4" />
        <span className="hidden sm:inline">App</span>
      </button>

      <DownloadAppDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

function DownloadAppDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    // Placeholder — wire up to a real waitlist endpoint later
    setSubmitted(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl">Get the Reduvia Mobile App</DialogTitle>
          <DialogDescription>Track your finances on the go</DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {/* App Store */}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-3 rounded-xl bg-black px-4 py-3 text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-black"
          >
            <Apple className="h-7 w-7 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] opacity-75">Download on the</p>
              <p className="text-base font-semibold">App Store</p>
            </div>
          </a>

          {/* Google Play */}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-colors hover:bg-muted"
          >
            {/* Simple Play triangle — no external SVG dependency */}
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7 shrink-0 text-green-500"
              fill="currentColor"
            >
              <path d="M3 20.5v-17c0-.83 1-.95 1.4-.4l15 8.5a.5.5 0 0 1 0 .8l-15 8.5c-.4.55-1.4.43-1.4-.4z" />
            </svg>
            <div className="leading-tight">
              <p className="text-[10px] text-muted-foreground">Get it on</p>
              <p className="text-base font-semibold">Google Play</p>
            </div>
          </a>
        </div>

        {/* QR code placeholder */}
        <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed p-4">
          <QrCode className="h-14 w-14 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">Scan to download</p>
        </div>

        {/* Waitlist */}
        <div className="mt-4 rounded-xl bg-muted/60 px-4 py-3">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            Mobile app coming soon — join the waitlist
          </p>
          {submitted ? (
            <p className="text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
              You&apos;re on the list! We&apos;ll notify you when it launches.
            </p>
          ) : (
            <form onSubmit={handleNotify} className="flex gap-2">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-sm"
                required
              />
              <Button type="submit" size="sm" className="h-8 shrink-0">
                Notify Me
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
