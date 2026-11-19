import { toWorld } from "./geometry";
import { buildingBounds, groupRoomsByBuilding } from "./buildings";
import type { BuildingConfig, RoomConfig } from "./config";

/**
 * Pure helpers for the village exterior (terrain scenery, building footprints).
 * No React / Three.js: everything here is deterministic and unit-tested.
 */

const GRID_UNIT = 200;

/** Axis-aligned rectangle in world units (x/z plane). */
export interface WorldRect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/** Small, fast, seedable PRNG (mulberry32). Same seed → same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * World-space footprints that scenery must stay out of: one padded rectangle
 * per building (its rooms' bounds) plus one per room that belongs to no
 * building. `paddingGrid` is in grid cells, like the plaza padding.
 */
export function buildingWorldRects(
  rooms: Pick<RoomConfig, "building" | "position" | "size">[],
  buildings: BuildingConfig[],
  paddingGrid = 0.6,
): WorldRect[] {
  const { groups, unassigned } = groupRoomsByBuilding(rooms, buildings);
  const sets = [...groups.map((g) => g.roomIndexes), ...unassigned.map((i) => [i])];
  const rects: WorldRect[] = [];
  for (const indexes of sets) {
    const b = buildingBounds(rooms, indexes, paddingGrid);
    if (!b) continue;
    const [x0, , z0] = toWorld(b.minX * GRID_UNIT, b.minY * GRID_UNIT);
    const [x1, , z1] = toWorld(b.maxX * GRID_UNIT, b.maxY * GRID_UNIT);
    rects.push({ minX: Math.min(x0, x1), minZ: Math.min(z0, z1), maxX: Math.max(x0, x1), maxZ: Math.max(z0, z1) });
  }
  return rects;
}

/** What a scenery point is: 0 = pine, 1 = round tree, 2 = bush. */
export type SceneryKind = 0 | 1 | 2;

export interface SceneryPoint {
  x: number;
  z: number;
  /** Size multiplier, roughly 0.8–1.4 */
  scale: number;
  kind: SceneryKind;
  /** 0–1, stable per point: lets the renderer pick a color shade */
  tint: number;
}

export interface ScatterOptions {
  seed: number;
  /** Maximum number of points (fewer if space runs out) */
  count: number;
  center: [number, number];
  /** Scenery lives inside this disc */
  radius: number;
  exclusions: WorldRect[];
  /** Extra clearance kept around every exclusion (world units). Default 1.5 */
  margin?: number;
  /** Minimum distance between two points (world units). Default 2.2 */
  minSpacing?: number;
  /** Rejection-sampling budget per point. Default 30 */
  maxAttempts?: number;
}

function insideRect(x: number, z: number, r: WorldRect, margin: number): boolean {
  return x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin;
}

/**
 * Scatter trees and bushes over a disc, keeping clear of the exclusion
 * rectangles and of each other. Deterministic for a given seed.
 */
export function scatterScenery(opts: ScatterOptions): SceneryPoint[] {
  const { seed, count, center, radius, exclusions } = opts;
  const margin = opts.margin ?? 1.5;
  const minSpacing = opts.minSpacing ?? 2.2;
  const maxAttempts = opts.maxAttempts ?? 30;
  const rand = mulberry32(seed);
  const points: SceneryPoint[] = [];

  for (let n = 0; n < count; n++) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const r = radius * Math.sqrt(rand());
      const theta = rand() * Math.PI * 2;
      const x = center[0] + r * Math.cos(theta);
      const z = center[1] + r * Math.sin(theta);
      // Always consume the same random numbers per attempt for stability.
      const scale = 0.8 + rand() * 0.6;
      const kindRoll = rand();
      const tint = rand();

      if (exclusions.some((rect) => insideRect(x, z, rect, margin))) continue;
      if (points.some((p) => Math.hypot(p.x - x, p.z - z) < minSpacing)) continue;

      const kind: SceneryKind = kindRoll < 0.4 ? 0 : kindRoll < 0.75 ? 1 : 2;
      points.push({ x, z, scale, kind, tint });
      break;
    }
  }
  return points;
}
