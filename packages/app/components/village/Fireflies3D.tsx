"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FireflyPoint } from "@diorama/engine";

function makeSpriteTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,244,190,1)");
  g.addColorStop(0.35, "rgba(255,226,140,0.55)");
  g.addColorStop(1, "rgba(255,226,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface Fireflies3DProps {
  points: FireflyPoint[];
  heightAt: (x: number, z: number) => number;
}

/** Warm fireflies drifting in small loops: a soft glow that gives the village life. */
export function Fireflies3D({ points, heightAt }: Fireflies3DProps) {
  const ref = useRef<THREE.Points>(null);
  const sprite = useMemo(makeSpriteTexture, []);
  const base = useMemo(() => points.map((p) => ({ x: p.x, y: heightAt(p.x, p.z) + p.y, z: p.z })), [points, heightAt]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(points.length * 3), 3));
    return g;
  }, [points.length]);
  useEffect(
    () => () => {
      geometry.dispose();
      sprite.dispose();
    },
    [geometry, sprite],
  );

  useFrame(({ clock }) => {
    const pts = ref.current;
    if (!pts) return;
    const attr = pts.geometry.getAttribute("position") as THREE.BufferAttribute;
    const t = clock.getElapsedTime();
    for (let i = 0; i < points.length; i++) {
      const f = points[i];
      const b = base[i];
      const a = t * f.speed + f.phase;
      attr.setXYZ(i, b.x + Math.sin(a) * 0.9, b.y + Math.sin(a * 1.7) * 0.45, b.z + Math.cos(a * 0.8) * 0.9);
    }
    attr.needsUpdate = true;
  });

  return (
    // `as never`: two copies of three's types are in play (same workaround as Room3D)
    <points ref={ref} geometry={geometry as never} frustumCulled={false}>
      <pointsMaterial
        map={sprite as never}
        color="#ffeeb0"
        size={1.3}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        fog={false}
      />
    </points>
  );
}
