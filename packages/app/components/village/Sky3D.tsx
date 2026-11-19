"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@diorama/engine";
import { cloudGeometry } from "./sceneryGeometry";
import { SUN_VISUAL_DIRECTION, VILLAGE_HORIZON } from "./atmosphere";

const SKY_RADIUS = 900;

/** Vertical gradient stops: [height fraction, color]. Horizon matches the fog. */
const SKY_STOPS: Array<[number, string]> = [
  [-0.3, VILLAGE_HORIZON],
  [0.0, VILLAGE_HORIZON],
  [0.1, "#f6bdc3"],
  [0.3, "#cba8e4"],
  [0.62, "#9486da"],
  [1.0, "#6c62c6"],
];

function skyColor(t: number, out: THREE.Color): THREE.Color {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [t1, c1] = SKY_STOPS[i];
    if (t <= t1) {
      const [t0, c0] = SKY_STOPS[i - 1];
      const k = (t - t0) / (t1 - t0);
      return out.set(c0).lerp(new THREE.Color(c1), Math.min(1, Math.max(0, k)));
    }
  }
  return out.set(SKY_STOPS[SKY_STOPS.length - 1][1]);
}

function makeSkyGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(SKY_RADIUS, 32, 20);
  const pos = g.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    skyColor(pos.getY(i) / SKY_RADIUS, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function Clouds() {
  const geometry = useMemo(cloudGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const rand = mulberry32(77);
    const count = 10;
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.5;
      const r = 320 + rand() * 220;
      return { x: Math.cos(a) * r, y: 110 + rand() * 110, z: Math.sin(a) * r, s: 34 + rand() * 30, ry: rand() * Math.PI };
    });
  }, []);
  // Slow drift around the village.
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.005;
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <mesh key={i} geometry={geometry as never} position={[c.x, c.y, c.z]} rotation={[0, c.ry, 0]} scale={c.s}>
          <meshBasicMaterial vertexColors transparent opacity={0.94} fog={false} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

interface Sky3DProps {
  /** World-space center (x, z) the sky dome is centered on */
  center: [number, number];
}

/**
 * Gradient sky dome that blends into the fog at the horizon, a glowing low
 * sun in the same direction as the sunlight, and slow drifting clouds.
 */
export function Sky3D({ center }: Sky3DProps) {
  const geometry = useMemo(makeSkyGeometry, []);
  const glow = useMemo(makeGlowTexture, []);
  useEffect(
    () => () => {
      geometry.dispose();
      glow.dispose();
    },
    [geometry, glow],
  );
  const sunPos = SUN_VISUAL_DIRECTION.map((v) => v * 780) as [number, number, number];

  return (
    <group position={[center[0], 0, center[1]]}>
      <mesh geometry={geometry as never} renderOrder={-10}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
      {/* `as never`: two copies of three's types are in play (same workaround as Room3D) */}
      <sprite position={sunPos} scale={[520, 520, 1]} renderOrder={-9}>
        <spriteMaterial map={glow as never} color="#ffcf94" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </sprite>
      <sprite position={sunPos} scale={[120, 120, 1]} renderOrder={-8}>
        <spriteMaterial map={glow as never} color="#fff3d2" transparent opacity={1} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </sprite>
      <Clouds />
    </group>
  );
}
