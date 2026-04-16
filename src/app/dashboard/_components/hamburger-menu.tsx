"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, PiggyBank, Building2, Upload, ChevronRight, CreditCard, Zap, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BankAccountSummary } from "@/app/actions/bank-statements";

interface HamburgerMenuProps {
  bankAccounts: BankAccountSummary[];
}

export function HamburgerMenu({ bankAccounts }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        data-tour="nav-hamburger"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Overlay + slide-in panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-background shadow-xl"
          >
            {/* Panel header */}
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-base font-semibold">Finance Tracker</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-0.5">
                <li>
                  <Link
                    href="/dashboard"
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      pathname === "/dashboard"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/budgets"
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      pathname === "/budgets"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <PiggyBank className="h-4 w-4 shrink-0" />
                    Budgets
                  </Link>
                </li>
                <li>
                  <Link
                    href="/households"
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      pathname === "/households"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Home className="h-4 w-4 shrink-0" />
                    Households
                  </Link>
                </li>
              </ul>

              {/* Divider */}
              <div className="my-3 border-t" />

              {/* Bank accounts section */}
              <div className="mb-1.5 flex items-center gap-2 px-3">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bank Accounts
                </span>
              </div>

              {bankAccounts.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No accounts imported yet
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {bankAccounts.map((acct) => (
                    <li key={acct.id}>
                      <Link
                        href={`/bank/${acct.id}`}
                        className={`group flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                          pathname === `/bank/${acct.id}`
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <span className="truncate font-medium">{acct.bank_name}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-xs tabular-nums">
                            {acct.statement_count}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </nav>

            {/* Bottom links */}
            <div className="border-t p-3 space-y-0.5">
              <Link
                href="/import"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/import"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Upload className="h-4 w-4 shrink-0" />
                Import Statement
              </Link>
              <Link
                href="/pricing"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/pricing"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Zap className="h-4 w-4 shrink-0" />
                Pricing
              </Link>
              <Link
                href="/billing"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/billing"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <CreditCard className="h-4 w-4 shrink-0" />
                Billing
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
