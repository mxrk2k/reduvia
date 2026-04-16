import { BackgroundLoader } from "./_components/background-loader";
import { PitchSequence } from "./_components/pitch-sequence";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "linear-gradient(to bottom, #000000, #111111)",
        minHeight: "100vh",
      }}
    >
      {/* Canvas smoke animation — deferred */}
      <BackgroundLoader />

      {/* Two-column on lg+, single column on mobile */}
      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {/* Left — pitch sequence, 55% on desktop */}
        <div className="flex items-center justify-center px-8 py-16 lg:py-0 lg:basis-[55%] lg:shrink-0">
          <PitchSequence />
        </div>

        {/* Right — auth form, 45% on desktop */}
        <div className="flex flex-1 items-center justify-center px-4 pb-16 lg:basis-[45%] lg:shrink-0 lg:pb-0 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
