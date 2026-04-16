"use client";

import { Cormorant_Garamond } from "next/font/google";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300"],
  variable: "--font-cormorant",
  display: "swap",
});

const LINES = [
  { text: "Your finances.", delay: "0s" },
  { text: "Understood at a glance.", delay: "0.8s" },
  { text: "AI-powered insights, zero noise.", delay: "1.6s" },
];

export function PitchSequence() {
  return (
    <div className={`${cormorant.variable} select-none max-w-lg`}>
      <style>{`
        @keyframes pitchFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmerMove {
          from { background-position: 0% center; }
          to   { background-position: 300% center; }
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      {/* Lines 1–3 — weight 200 thin sans */}
      <div className="space-y-4 mb-10 lg:mb-12">
        {LINES.map(({ text, delay }) => (
          <p
            key={text}
            className="text-2xl sm:text-3xl lg:text-[2.15rem] leading-tight text-white/75"
            style={{
              fontWeight: 200,
              opacity: 0,
              animation: `pitchFadeUp 0.9s ease ${delay} forwards`,
            }}
          >
            {text}
          </p>
        ))}
      </div>

      {/* Reduvia. — Cormorant Garamond 300 with shimmer + cursor */}
      <div
        style={{
          opacity: 0,
          animation: "pitchFadeUp 1.2s ease 2.4s forwards",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-cormorant)",
            fontWeight: 300,
            fontSize: "clamp(3.25rem, 7vw, 4.75rem)",
            lineHeight: 1.1,
            background:
              "linear-gradient(90deg, #c4b5fd, #ffffff 35%, #7c3aed 60%, #ffffff 80%, #c4b5fd)",
            backgroundSize: "300% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            display: "inline",
            animation: "shimmerMove 5s linear 3.6s infinite",
          }}
        >
          Reduvia.
        </span>
        {/* Blinking cursor */}
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "3px",
            height: "0.72em",
            backgroundColor: "#a78bfa",
            marginLeft: "4px",
            verticalAlign: "middle",
            borderRadius: "1px",
            animation: "cursorBlink 1.1s step-end 3.6s infinite",
          }}
        />
      </div>
    </div>
  );
}
