"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Ground disc, far larger than any view so the fog (not an edge) ends the world. */
const GROUND_RADIUS = 420;
const GROUND_Y = -0.12;
const GROUND_COLOR = "#9fd19a";

function makeGrassTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(0, 0, size, size);
  // Deterministic speckle (no Math.random → identical on every load).
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 900; i++) {
    const light = rand() > 0.5;
    ctx.fillStyle = light ? "rgba(255,255,255,0.10)" : "rgba(40,90,60,0.10)";
    const r = 1 + rand() * 3;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GROUND_RADIUS / 5, GROUND_RADIUS / 5);
  return tex;
}

function makeClearingTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(214,240,190,0.95)");
  g.addColorStop(0.65, "rgba(214,240,190,0.55)");
  g.addColorStop(1, "rgba(214,240,190,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface Terrain3DProps {
  /** World-space center of the village (x, z) */
  center: [number, number];
  /** Radius of the lighter clearing around the village, in world units */
  clearingRadius: number;
}

/**
 * Village ground: a huge grass disc with a soft lighter clearing under the
 * buildings. Purely decorative: no pointer handlers, so room selection and
 * editor interactions are unaffected.
 */
export function Terrain3D({ center, clearingRadius }: Terrain3DProps) {
  const grass = useMemo(makeGrassTexture, []);
  const clearing = useMemo(makeClearingTexture, []);
  useEffect(
    () => () => {
      grass.dispose();
      clearing.dispose();
    },
    [grass, clearing],
  );

  return (
    <group position={[center[0], 0, center[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]}>
        <circleGeometry args={[GROUND_RADIUS, 64]} />
        {/* `as never`: two copies of three's types are in play (same workaround as Room3D) */}
        <meshStandardMaterial map={grass as never} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y + 0.01, 0]}>
        <planeGeometry args={[clearingRadius * 2, clearingRadius * 2]} />
        <meshStandardMaterial map={clearing as never} transparent depthWrite={false} roughness={1} />
      </mesh>
    </group>
  );
}
