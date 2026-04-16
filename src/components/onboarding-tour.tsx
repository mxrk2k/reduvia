"use client";

import { useEffect, useRef } from "react";
import "driver.js/dist/driver.css";
import { completeOnboarding } from "@/app/actions/user-preferences";

export function OnboardingTour({ show }: { show: boolean }) {
  const driverRef = useRef<ReturnType<typeof import("driver.js")["driver"]> | null>(null);

  useEffect(() => {
    if (!show) return;

    let cancelled = false;

    async function start() {
      const { driver } = await import("driver.js");

      if (cancelled) return;

      const driverObj = driver({
        animate: true,
        showProgress: true,
        showButtons: ["next", "previous", "close"],
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: "Done",
        overlayColor: "rgba(0,0,0,0.78)",
        popoverClass: "reduvia-tour-popover",
        onDestroyStarted: async () => {
          await completeOnboarding();
          driverObj.destroy();
        },
        steps: [
          // Step 1 — welcome (no target, centred)
          {
            popover: {
              title: "Welcome to Reduvia!",
              description:
                "Let's take a quick tour to show you what's possible. It only takes about 30 seconds.",
              side: "over" as const,
              align: "center",
              nextBtnText: "Start tour →",
            },
          },
          // Step 2 — Add Transaction button
          {
            element: '[data-tour="add-transaction"]',
            popover: {
              title: "Log your first transaction",
              description:
                "Tap this button to add income, expenses, or recurring payments. Your dashboard updates instantly.",
              side: "bottom" as const,
              align: "start",
            },
          },
          // Step 3 — Budgets nav link
          {
            element: '[data-tour="nav-budgets"]',
            popover: {
              title: "Set spending limits",
              description:
                "Visit Budgets to define monthly limits per category. Reduvia tracks your spending against them automatically.",
              side: "bottom" as const,
              align: "start",
            },
          },
          // Step 4 — Hamburger / Import
          {
            element: '[data-tour="nav-hamburger"]',
            popover: {
              title: "Import bank statements",
              description:
                "Open the menu to import bank statements. Reduvia reads them and extracts categorised transactions for you.",
              side: "bottom" as const,
              align: "start",
            },
          },
          // Step 5 — completion (no target, centred)
          {
            popover: {
              title: "You're all set!",
              description:
                "Your dashboard is ready. Add your first transaction to get started.",
              side: "over" as const,
              align: "center",
              nextBtnText: "Done",
            },
          },
        ],
      });

      driverRef.current = driverObj;
      driverObj.drive();
    }

    start();

    return () => {
      cancelled = true;
      driverRef.current?.destroy();
    };
  }, [show]);

  return null;
}
