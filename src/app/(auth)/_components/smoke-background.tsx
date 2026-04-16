"use client";

import { useEffect, useRef } from "react";

// [r, g, b] tuples for soft smoke wisps
const SMOKE_COLORS: [number, number, number][] = [
  [70, 70, 75],   // dark grey
  [55, 55, 68],   // blue-grey
  [65, 48, 85],   // violet-grey
  [45, 45, 55],   // deep grey
];

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
  const maxLife = 280 + Math.random() * 160;
  return {
    x: Math.random() * width,
    y: height + 20 + Math.random() * 40,
    vx: (Math.random() - 0.5) * 0.35,
    vy: -(0.25 + Math.random() * 0.45),
    radius: 50 + Math.random() * 70,
    opacity: 0,
    maxOpacity: 0.055 + Math.random() * 0.07,
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

    // Seed initial particles spread across the canvas
    for (let i = 0; i < 14; i++) {
      const p = createParticle(width, height);
      p.y = Math.random() * height;
      p.life = Math.random() * p.maxLife * 0.6;
      p.opacity = p.maxOpacity * 0.4;
      particles.push(p);
    }

    let animId: number;
    let lastSpawn = 0;

    function tick(time: number) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      // Spawn a new particle every ~450 ms
      if (time - lastSpawn > 450) {
        particles.push(createParticle(width, height));
        lastSpawn = time;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.wobble += 0.018;
        p.x += p.vx + Math.sin(p.wobble) * 0.28;
        p.y += p.vy;

        const ratio = p.life / p.maxLife;
        if (ratio < 0.18) {
          p.opacity = (ratio / 0.18) * p.maxOpacity;
        } else if (ratio > 0.65) {
          p.opacity = ((1 - ratio) / 0.35) * p.maxOpacity;
        } else {
          p.opacity = p.maxOpacity;
        }

        if (p.life >= p.maxLife || p.y < -p.radius) {
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
