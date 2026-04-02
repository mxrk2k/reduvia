import { Cinzel_Decorative } from "next/font/google";
import { BackgroundLoader } from "./_components/background-loader";

const cinzel = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-cinzel",
  display: "swap",
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cinzel.variable}
      style={{ background: "#0f0f1a", minHeight: "100vh" }}
    >
      {/* Animated Three.js canvas — deferred so auth form loads first */}
      <BackgroundLoader />

      {/* Radial gradient vignette over the canvas */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(9,9,26,0.75) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Page content */}
      <div
        className="relative flex min-h-screen flex-col items-center justify-center gap-5 p-4 sm:gap-7"
        style={{ zIndex: 2 }}
      >
        {/* ── Reduvia title ── */}
        <h1
          className="select-none text-center text-4xl font-bold tracking-[0.18em] text-white sm:text-5xl lg:text-6xl"
          style={{
            fontFamily: "var(--font-cinzel)",
            textShadow: [
              "0 0 12px rgba(139,92,246,1)",
              "0 0 30px rgba(139,92,246,0.7)",
              "0 0 60px rgba(139,92,246,0.4)",
              "0 0 90px rgba(6,182,212,0.25)",
            ].join(", "),
          }}
        >
          Reduvia
        </h1>

        {children}
      </div>
    </div>
  );
}
