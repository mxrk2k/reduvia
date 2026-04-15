"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";

// ── Initialise PostHog once at module load (client only) ──────────────────────
//
// Module-level initialisation runs exactly once per page load and ensures the
// singleton is ready before any component can call posthog.capture() directly.

if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY &&
  !posthog.__loaded
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host:         process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false, // handled manually in PageViewTracker
    capture_pageleave: true,
    person_profiles:  "identified_only",
  });
}

// ── Page-view tracker ─────────────────────────────────────────────────────────
//
// useSearchParams() requires a Suspense boundary in the Next.js App Router.
// We isolate it in a child component so the boundary can live here, not in
// layout.tsx (which would force the whole layout into Suspense).

function PageViewTracker() {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const ph          = usePostHog();

  useEffect(() => {
    if (!ph || !pathname) return;

    const qs  = searchParams.toString();
    const url = window.origin + pathname + (qs ? `?${qs}` : "");

    ph.capture("$pageview", { $current_url: url });
  }, [ph, pathname, searchParams]);

  return null;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      {/* Suspense required by useSearchParams in Next.js App Router */}
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
