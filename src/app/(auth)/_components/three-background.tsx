"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface FloatingShape {
  mesh: THREE.Mesh;
  rotSpeed: THREE.Vector3;
  basePos: THREE.Vector3;
  oscAmp: THREE.Vector2;
  oscSpeed: THREE.Vector2;
  oscPhase: THREE.Vector2;
}

const SHAPES: Array<{
  type: "icosahedron" | "octahedron" | "torus";
  size: number;
  color: number;
  opacity: number;
  pos: [number, number, number];
}> = [
  { type: "icosahedron", size: 1.1,  color: 0x8b5cf6, opacity: 0.55, pos: [-5.5,  2.5, -1.5] },
  { type: "icosahedron", size: 0.65, color: 0x06b6d4, opacity: 0.60, pos: [ 4.5, -2.5,  0.0] },
  { type: "icosahedron", size: 0.42, color: 0xa78bfa, opacity: 0.50, pos: [ 6.5,  3.2, -2.0] },
  { type: "icosahedron", size: 0.35, color: 0x2dd4bf, opacity: 0.55, pos: [-1.5, -4.0, -1.5] },
  { type: "octahedron", size: 0.95,  color: 0x3b82f6, opacity: 0.55, pos: [ 3.0,  3.5, -1.0] },
  { type: "octahedron", size: 0.60,  color: 0x7c3aed, opacity: 0.60, pos: [-6.5, -2.5,  0.5] },
  { type: "octahedron", size: 0.75,  color: 0x0ea5e9, opacity: 0.50, pos: [-7.0,  1.0, -0.5] },
  { type: "octahedron", size: 0.38,  color: 0x818cf8, opacity: 0.55, pos: [ 1.5,  4.5, -2.5] },
  { type: "torus",      size: 0.72,  color: 0x06b6d4, opacity: 0.45, pos: [ 7.5, -0.5, -1.0] },
  { type: "torus",      size: 0.50,  color: 0x8b5cf6, opacity: 0.50, pos: [-4.0,  4.0, -1.0] },
  { type: "torus",      size: 0.38,  color: 0x38bdf8, opacity: 0.45, pos: [ 2.5, -4.5, -0.5] },
];

export function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Scene & camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 9;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Build shapes ──────────────────────────────────────────────────────────
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const floaters: FloatingShape[] = [];

    SHAPES.forEach(({ type, size, color, opacity, pos }) => {
      let geo: THREE.BufferGeometry;
      if (type === "icosahedron") {
        geo = new THREE.IcosahedronGeometry(size, 0);
      } else if (type === "octahedron") {
        geo = new THREE.OctahedronGeometry(size, 0);
      } else {
        geo = new THREE.TorusGeometry(size, size * 0.18, 8, 14);
      }

      const mat = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity,
      });

      geometries.push(geo);
      materials.push(mat);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      scene.add(mesh);

      floaters.push({
        mesh,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.006,
          (Math.random() - 0.5) * 0.009,
          (Math.random() - 0.5) * 0.004
        ),
        basePos: new THREE.Vector3(...pos),
        oscAmp: new THREE.Vector2(
          0.25 + Math.random() * 0.45,
          0.20 + Math.random() * 0.35
        ),
        oscSpeed: new THREE.Vector2(
          0.12 + Math.random() * 0.22,
          0.10 + Math.random() * 0.18
        ),
        oscPhase: new THREE.Vector2(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        ),
      });
    });

    // ── Animation loop ────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      floaters.forEach((s) => {
        s.mesh.rotation.x += s.rotSpeed.x;
        s.mesh.rotation.y += s.rotSpeed.y;
        s.mesh.rotation.z += s.rotSpeed.z;
        s.mesh.position.x =
          s.basePos.x + Math.sin(t * s.oscSpeed.x + s.oscPhase.x) * s.oscAmp.x;
        s.mesh.position.y =
          s.basePos.y + Math.cos(t * s.oscSpeed.y + s.oscPhase.y) * s.oscAmp.y;
      });

      renderer.render(scene, camera);
    }

    animate();

    // ── Resize ────────────────────────────────────────────────────────────────
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", onResize);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
      aria-hidden
    />
  );
}
