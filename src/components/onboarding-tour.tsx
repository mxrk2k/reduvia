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

// Spotlight padding around the target element
const PAD = 12;
// Border radius of the spotlight cutout
const CUTOUT_R = 10;

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingTour({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [winSize, setWinSize] = useState({ w: 0, h: 0 });
  const confettiRef = useRef<HTMLCanvasElement>(null);
  const confettiStarted = useRef(false);

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Track window size for tooltip placement
  useEffect(() => {
    function update() {
      setWinSize({ w: window.innerWidth, h: window.innerHeight });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Measure target element whenever step changes
  useEffect(() => {
    if (!visible) return;
    const targetId = currentStep.target;
    if (!targetId) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${targetId}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Small delay to allow scroll to settle before measuring
    const t = setTimeout(() => {
      setRect(el.getBoundingClientRect());
    }, 120);
    return () => clearTimeout(t);
  }, [step, visible, currentStep.target]);

  // Confetti on last step
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
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.06;
        f.rot += f.rotV;
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

  if (!visible) return null;

  const hasTarget = !!rect && !!currentStep.target;

  // Spotlight geometry
  const spotX = rect ? rect.left - PAD : 0;
  const spotY = rect ? rect.top - PAD : 0;
  const spotW = rect ? rect.width + PAD * 2 : 0;
  const spotH = rect ? rect.height + PAD * 2 : 0;

  // Tooltip placement: below spotlight if it fits, else above
  const tooltipW = 320;
  const tooltipH = 200; // approximate
  let tooltipTop: number | undefined;
  let tooltipLeft: number | undefined;
  let tooltipTransform: string | undefined;

  if (hasTarget) {
    const below = spotY + spotH + 16;
    const above = spotY - tooltipH - 12;
    tooltipTop = below + tooltipH < winSize.h ? below : Math.max(8, above);
    tooltipLeft = Math.max(
      8,
      Math.min(spotX + spotW / 2 - tooltipW / 2, winSize.w - tooltipW - 8)
    );
  } else {
    tooltipTransform = "translate(-50%, -50%)";
    tooltipTop = undefined;
    tooltipLeft = undefined;
  }

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: "all" }}>
      {/* Confetti canvas — last step only */}
      {isLast && (
        <canvas
          ref={confettiRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[51]"
          style={{ width: "100%", height: "100%" }}
        />
      )}

      {/* Dark overlay with spotlight cutout */}
      {hasTarget ? (
        <svg
          aria-hidden="true"
          className="fixed inset-0 z-50"
          style={{ width: "100%", height: "100%", pointerEvents: "all" }}
          onClick={(e) => e.stopPropagation()}
        >
          <defs>
            <mask id="tour-mask">
              {/* White = overlay visible, black = spotlight (transparent) */}
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={spotX}
                y={spotY}
                width={spotW}
                height={spotH}
                rx={CUTOUT_R}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.72)"
            mask="url(#tour-mask)"
          />
          {/* Violet glow ring around spotlight */}
          <rect
            x={spotX}
            y={spotY}
            width={spotW}
            height={spotH}
            rx={CUTOUT_R}
            fill="none"
            stroke="rgba(124,58,237,0.65)"
            strokeWidth="1.5"
          />
        </svg>
      ) : (
        <div className="fixed inset-0 z-50 bg-black/72" />
      )}

      {/* Tooltip card */}
      <div
        className="fixed z-[51] rounded-2xl p-5"
        style={{
          width: tooltipW,
          background: "rgba(12,12,20,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow:
            "0 0 40px rgba(124,58,237,0.18), 0 20px 60px rgba(0,0,0,0.65)",
          top: hasTarget ? tooltipTop : "50%",
          left: hasTarget ? tooltipLeft : "50%",
          transform: tooltipTransform,
        }}
      >
        {/* Progress bar */}
        <div className="mb-4 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Step counter */}
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">
          Step {step + 1} of {STEPS.length}
        </p>

        {/* Title */}
        <h3 className="mb-1.5 text-[15px] font-semibold text-white">
          {currentStep.title}
        </h3>

        {/* Body */}
        <p className="text-sm leading-relaxed text-white/50">
          {currentStep.description}
        </p>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between gap-3">
          {!isLast ? (
            <button
              onClick={skip}
              className="text-sm text-white/30 transition-colors hover:text-white/55"
            >
              Skip tour
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={advance}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
              boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
            }}
          >
            {currentStep.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
