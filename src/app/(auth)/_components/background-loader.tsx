"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

// Load the canvas smoke animation as a separate chunk (browser-only APIs).
const SmokeBackground = dynamic(
  () => import("./smoke-background").then((m) => m.SmokeBackground),
  { ssr: false, loading: () => null }
);

// Defer mounting until the auth form is interactive so the canvas
// download never competes with the initial render.
export function BackgroundLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;
  return <SmokeBackground />;
}
