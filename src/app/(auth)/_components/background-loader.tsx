"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

// Load the Three.js canvas as a completely separate chunk.
// ssr: false — Three.js requires browser APIs.
const ThreeBackground = dynamic(
  () => import("./three-background").then((m) => m.ThreeBackground),
  { ssr: false, loading: () => null }
);

// Defers rendering Three.js until after the auth form has had time to
// fully render and become interactive. This ensures the Three.js bundle
// download and WebGL initialization never compete with the sign-in fetch.
export function BackgroundLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;
  return <ThreeBackground />;
}
