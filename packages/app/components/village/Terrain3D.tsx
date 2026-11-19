"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { fbm2D, smoothstep, terrainHeight, GROUND_Y, type TerrainOptions } from "@diorama/engine";

const RINGS = 80;
const SEGMENTS = 144;

const GRASS_A = new THREE.Color("#a6e085");
const GRASS_B = new THREE.Color("#bdeb8c");
const MEADOW = new THREE.Color("#d6f4a0");
const DRY = new THREE.Color("#dde59a");
const HILL = new THREE.Color("#74bc84");
const HILL_LIGHT = new THREE.Color("#8ad08c");

const _c = new THREE.Color();

/** Grass color at a point: patchy lawn, a sunlit meadow near the village, cooler on the hills. */
function groundColor(x: number, z: number, d: number, rise: number, o: TerrainOptions, out: THREE.Color): THREE.Color {
  const patch = fbm2D(x * 0.028, z * 0.028, o.seed + 21, 3);
  out.copy(GRASS_A).lerp(GRASS_B, patch);
  const dry = smoothstep(0.6, 0.82, fbm2D(x * 0.05, z * 0.05, o.seed + 33, 2));
  out.lerp(DRY, dry * 0.45);
  const meadow = 1 - smoothstep(o.flatRadius * 0.85, o.flatRadius * 1.7, d);
  out.lerp(MEADOW, meadow * 0.55);
  const hill = smoothstep(1, 11, rise);
  _c.copy(HILL).lerp(HILL_LIGHT, patch);
  out.lerp(_c, hill * 0.8);
  return out;
}

/**
 * Polar grid: rings are dense near the village and spread out toward the
 * horizon, so detail goes where the camera looks. Heights come from the
 * engine's terrainHeight (flat core, rolling hills beyond).
 */
function buildTerrain(o: TerrainOptions, radius: number): THREE.BufferGeometry {
  const vertexCount = (RINGS + 1) * (SEGMENTS + 1);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const c = new THREE.Color();
  let v = 0;
  for (let i = 0; i <= RINGS; i++) {
    const r = radius * Math.pow(i / RINGS, 1.7);
    for (let j = 0; j <= SEGMENTS; j++) {
      const a = (j / SEGMENTS) * Math.PI * 2;
      const x = o.center[0] + r * Math.cos(a);
      const z = o.center[1] + r * Math.sin(a);
      const y = terrainHeight(x, z, o);
      positions.set([x, y, z], v * 3);
      groundColor(x, z, r, y - GROUND_Y, o, c);
      colors.set([c.r, c.g, c.b], v * 3);
      uvs.set([x / 7, z / 7], v * 2);
      v++;
    }
  }
  const indices: number[] = [];
  const stride = SEGMENTS + 1;
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      // Wound so the face normal points up (+y).
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Soft mottled grayscale: multiplies the vertex colors to break up flat color. */
function makeGrassTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, size, size);
  // Deterministic speckle (no Math.random → identical on every load).
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 1100; i++) {
    const dark = rand() > 0.45;
    ctx.fillStyle = dark ? "rgba(70,120,70,0.10)" : "rgba(255,255,255,0.5)";
    const r = 1 + rand() * 3.2;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

interface Terrain3DProps {
  options: TerrainOptions;
  /** Ground radius; larger than the fog distance so haze, not an edge, ends the world */
  radius: number;
}

/**
 * Village ground: flat under the buildings, rolling hills beyond, painted per
 * vertex (patchy lawn, sunlit meadow, cooler hillsides) with a faint mottled
 * texture. Purely decorative: no pointer handlers.
 */
export function Terrain3D({ options, radius }: Terrain3DProps) {
  const geometry = useMemo(() => buildTerrain(options, radius), [options, radius]);
  const grass = useMemo(makeGrassTexture, []);
  useEffect(
    () => () => {
      geometry.dispose();
      grass.dispose();
    },
    [geometry, grass],
  );

  return (
    <mesh geometry={geometry as never} receiveShadow>
      {/* `as never`: two copies of three's types are in play (same workaround as Room3D) */}
      <meshStandardMaterial vertexColors map={grass as never} roughness={1} />
    </mesh>
  );
}
