import { fbm2D, smoothstep } from "./noise";

/** Height of the flat ground under the buildings (just below the plaza slabs). */
export const GROUND_Y = -0.12;

export interface TerrainOptions {
  /** World-space center of the village (x, z) */
  center: [number, number];
  /** Inside this radius the ground is perfectly flat (the built-up core) */
  flatRadius: number;
  /** Distance over which the ground eases from flat into hills */
  blend: number;
  /** Maximum hill height above the flat ground, in world units */
  amplitude: number;
  seed: number;
}

/**
 * Ground height at a world position. Flat inside `flatRadius` so rooms,
 * plazas and (later) paths sit on level ground; beyond it, gentle rolling
 * hills rise smoothly. Pure and deterministic.
 */
export function terrainHeight(x: number, z: number, o: TerrainOptions): number {
  const d = Math.hypot(x - o.center[0], z - o.center[1]);
  const t = smoothstep(o.flatRadius, o.flatRadius + o.blend, d);
  if (t === 0) return GROUND_Y;
  const broad = fbm2D(x * 0.014, z * 0.014, o.seed, 3);
  const fine = fbm2D(x * 0.06, z * 0.06, o.seed + 7, 2);
  const shape = Math.pow(broad, 1.35) * 0.88 + fine * 0.12;
  return GROUND_Y + t * o.amplitude * shape;
}
