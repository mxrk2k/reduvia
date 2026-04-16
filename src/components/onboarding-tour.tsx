"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { completeOnboarding } from "@/app/actions/user-preferences";

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  {
    id: "welcome",
    target: null as string | null,
    title: "Welcome to Reduvia!",
    description:
      "Let's take a quick tour to show you what's possible. It only takes about 30 seconds.",
    cta: "Start tour",
  },
  {
    id: "add-transaction",
    target: "add-transaction" as string | null,
    title: "Log your first transaction",
    description:
      "Tap this button to add income, expenses, or recurring payments. Your dashboard updates instantly.",
    cta: "Next",
  },
  {
    id: "budgets",
    target: "nav-budgets" as string | null,
    title: "Set spending limits",
    description:
      "Visit Budgets to define monthly limits per category. Reduvia tracks your spending against them automatically.",
    cta: "Next",
  },
  {
    id: "import",
    target: "nav-hamburger" as string | null,
    title: "Import bank statements",
    description:
      "Open the menu to import bank statements. Reduvia reads them and extracts categorised transactions for you.",
    cta: "Next",
  },
  {
    id: "done",
    target: null as string | null,
    title: "You're all set!",
    description:
      "Your financial picture gets clearer every day you track. Explore at your own pace.",
    cta: "Get started",
  },
] as const;

const PAD = 8;
const TOOLTIP_W = 320;
const TOOLTIP_H = 220;

type SpotRect = { top: number; left: number; width: number; height: number };

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingTour({ show }: { show: boolean }) {
  // Defer all rendering to the client to prevent hydration mismatches.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState<SpotRect | null>(null);

  const confettiRef = useRef<HTMLCanvasElement>(null);
  const confettiStarted = useRef(false);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Mount client-side only, then show if needed.
  useEffect(() => {
    setMounted(true);
    if (show) setVisible(true);
  }, [show]);

  // ── Spotlight measurement ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !visible) return;

    // Clear stale spotlight immediately so no wrong highlight flashes.
    setSpot(null);

    const targetId = STEPS[step].target;
    if (!targetId) return;

    const measure = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      setSpot({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour="${targetId}"]`
      );
      if (!el) return; // element not found — centred modal fallback

      const r = el.getBoundingClientRect();
      const inView = r.top >= 0 && r.bottom <= window.innerHeight;

      if (!inView) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Re-measure after scroll animation settles.
        setTimeout(() => {
          const fresh = document.querySelector<HTMLElement>(
            `[data-tour="${targetId}"]`
          );
          if (fresh) measure(fresh);
        }, 400);
      } else {
        measure(el);
      }
    }, 150);

    return () => clearTimeout(t);
  }, [step, mounted, visible]);

  // ── Confetti (last step) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isLast || confettiStarted.current) return;
    confettiStarted.current = true;

    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ec4899", "#fff"];
    type Flake = {
      x: number; y: number; vx: number; vy: number;
      color: string; w: number; h: number; rot: number; rotV: number;
    };
    const flakes: Flake[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 3.5,
      vy: 2.5 + Math.random() * 3.5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: 6 + Math.random() * 8,
      h: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.18,
    }));

    let alive = true;
    function tick() {
      if (!alive || !ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let any = false;
      for (const f of flakes) {
        f.x += f.vx; f.y += f.vy; f.vy += 0.06; f.rot += f.rotV;
        if (f.y < canvas.height + 20) any = true;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.fillStyle = f.color;
        ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
        ctx.restore();
      }
      if (any) requestAnimationFrame(tick);
      else alive = false;
    }
    requestAnimationFrame(tick);
    return () => { alive = false; };
  }, [isLast]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const advance = useCallback(async () => {
    if (isLast) {
      await completeOnboarding();
      setVisible(false);
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast]);

  const skip = useCallback(async () => {
    await completeOnboarding();
    setVisible(false);
  }, []);

  // Nothing on the server or before mount — prevents hydration mismatches.
  if (!mounted || !visible) return null;

  // Spotlight is valid only when we have a fresh rect AND this step has a target.
  const hasSpot = spot !== null && currentStep.target !== null;

  // Spotlight box geometry (fixed coords — getBoundingClientRect is viewport-relative).
  const spotTop    = hasSpot ? spot!.top  - PAD : 0;
  const spotLeft   = hasSpot ? spot!.left - PAD : 0;
  const spotWidth  = hasSpot ? spot!.width  + PAD * 2 : 0;
  const spotHeight = hasSpot ? spot!.height + PAD * 2 : 0;

  // Tooltip position: below spotlight when target is in top half, above when in bottom half.
  let tooltipStyle: React.CSSProperties;
  if (hasSpot) {
    const targetCenterY = spot!.top + spot!.height / 2;
    const inTopHalf = targetCenterY < window.innerHeight / 2;

    const top = inTopHalf
      ? spotTop + spotHeight + 16
      : Math.max(8, spotTop - TOOLTIP_H - 12);

    const left = Math.max(
      8,
      Math.min(
        spotLeft + spotWidth / 2 - TOOLTIP_W / 2,
        window.innerWidth - TOOLTIP_W - 8
      )
    );

    tooltipStyle = { position: "fixed", top, left, width: TOOLTIP_W };
  } else {
    tooltipStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: TOOLTIP_W,
    };
  }

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      {/* When there is no spotlight, render a plain dark overlay.
          When there IS a spotlight, the overlay is created by the highlight
          div's box-shadow spread — no separate backdrop needed. */}
      {!hasSpot && (
        <div
          className="fixed inset-0 z-50"
          style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
        />
      )}

      {/* ── Spotlight highlight box ───────────────────────────────────────── */}
      {/* A transparent fixed div positioned over the target element.
          box-shadow with a huge spread covers the rest of the screen dark,
          the outline ring and glow make the spotlight feel intentional. */}
      {hasSpot && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            zIndex: 50,
            top: spotTop,
            left: spotLeft,
            width: spotWidth,
            height: spotHeight,
            borderRadius: 10,
            pointerEvents: "none",
            boxShadow: [
              "0 0 0 9999px rgba(0,0,0,0.72)",          // dark overlay
              "0 0 0 2px rgba(124,58,237,0.75)",          // violet ring
              "0 0 24px 4px rgba(124,58,237,0.35)",       // violet glow
            ].join(", "),
          }}
        />
      )}

      {/* ── Confetti canvas (last step only) ─────────────────────────────── */}
      {isLast && (
        <canvas
          ref={confettiRef}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 51,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      )}

      {/* ── Tooltip card ─────────────────────────────────────────────────── */}
      <div
        style={{
          ...tooltipStyle,
          zIndex: 51,
          borderRadius: 16,
          padding: 20,
          background: "rgba(12,12,20,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow:
            "0 0 40px rgba(124,58,237,0.18), 0 20px 60px rgba(0,0,0,0.65)",
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            marginBottom: 16,
            height: 3,
            width: "100%",
            overflow: "hidden",
            borderRadius: 9999,
            backgroundColor: "rgba(255,255,255,0.1)",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 9999,
              backgroundColor: "#7c3aed",
              width: `${((step + 1) / STEPS.length) * 100}%`,
              transition: "width 0.5s ease",
            }}
          />
        </div>

        {/* Step counter */}
        <p
          style={{
            marginBottom: 8,
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          Step {step + 1} of {STEPS.length}
        </p>

        {/* Title */}
        <h3
          style={{
            marginBottom: 6,
            fontSize: 15,
            fontWeight: 600,
            color: "#fff",
          }}
        >
          {currentStep.title}
        </h3>

        {/* Body */}
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          {currentStep.description}
        </p>

        {/* Actions */}
        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {!isLast ? (
            <button
              onClick={skip}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontSize: 14,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Skip tour
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={advance}
            style={{
              borderRadius: 8,
              paddingInline: 16,
              paddingBlock: 8,
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
              boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
            }}
          >
            {currentStep.cta}
          </button>
        </div>
      </div>
    </>
  );
}
