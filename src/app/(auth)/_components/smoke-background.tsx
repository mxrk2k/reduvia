"use client";

import { useEffect, useRef } from "react";

// [r, g, b] tuples for smoke wisps
const SMOKE_COLORS: [number, number, number][] = [
  [100, 100, 108],  // mid grey
  [80,  80,  100],  // blue-grey
  [95,  70,  130],  // violet
  [70,  70,   85],  // deep grey
  [115, 100, 145],  // soft violet-white
];

// Smoke only rises from the bottom up to this fraction of the viewport height
const SMOKE_CEIL = 0.5;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  maxOpacity: number;
  life: number;
  maxLife: number;
  colorIndex: number;
  wobble: number;
}

function createParticle(width: number, height: number): Particle {
  const maxLife = 320 + Math.random() * 180;
  return {
    x: Math.random() * width,
    y: height + 20 + Math.random() * 40,
    vx: (Math.random() - 0.5) * 0.5,
    vy: -(0.5 + Math.random() * 0.7),
    radius: 80 + Math.random() * 100,
    opacity: 0,
    maxOpacity: 0.18 + Math.random() * 0.16,
    life: 0,
    maxLife,
    colorIndex: Math.floor(Math.random() * SMOKE_COLORS.length),
    wobble: Math.random() * Math.PI * 2,
  };
}

export function SmokeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const particles: Particle[] = [];

    // Seed initial particles spread across the lower half
    for (let i = 0; i < 22; i++) {
      const p = createParticle(width, height);
      // Distribute y between the ceiling and the bottom
      p.y = height * SMOKE_CEIL + Math.random() * (height * (1 - SMOKE_CEIL));
      p.life = Math.random() * p.maxLife * 0.55;
      p.opacity = p.maxOpacity * 0.5;
      particles.push(p);
    }

    let animId: number;
    let lastSpawn = 0;

    function tick(time: number) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      // Spawn a new particle every ~220 ms for a denser effect
      if (time - lastSpawn > 220) {
        particles.push(createParticle(width, height));
        lastSpawn = time;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.wobble += 0.016;
        p.x += p.vx + Math.sin(p.wobble) * 0.38;
        p.y += p.vy;

        // Fade out as the particle approaches the ceiling
        const ceilY = height * SMOKE_CEIL;
        const fadeStart = ceilY + p.radius;
        let ceilFade = 1;
        if (p.y < fadeStart) {
          ceilFade = Math.max(0, (p.y - ceilY) / p.radius);
        }

        const ratio = p.life / p.maxLife;
        if (ratio < 0.15) {
          p.opacity = (ratio / 0.15) * p.maxOpacity * ceilFade;
        } else if (ratio > 0.6) {
          p.opacity = ((1 - ratio) / 0.4) * p.maxOpacity * ceilFade;
        } else {
          p.opacity = p.maxOpacity * ceilFade;
        }

        // Kill particle once it fully fades at the ceiling or exhausts its life
        if (p.life >= p.maxLife || p.y < ceilY - p.radius) {
          particles.splice(i, 1);
          continue;
        }

        const [r, g, b] = SMOKE_COLORS[p.colorIndex];
        const grad = ctx.createRadialGradient(
          p.x, p.y, 0,
          p.x, p.y, p.radius
        );
        grad.addColorStop(0, `rgba(${r},${g},${b},${p.opacity})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);

    function onResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
      }
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
