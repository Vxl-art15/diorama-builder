import { toWorld } from "./geometry";
import { buildingBounds, groupRoomsByBuilding } from "./buildings";
import { fbm2D, smoothstep } from "./noise";
import type { BuildingConfig, RoomConfig } from "./config";

/**
 * Pure helpers for the village exterior: building footprints and a
 * deterministic "scenery plan" (where every tree, bush, flower, mushroom,
 * rock, grass tuft and firefly goes). No React / Three.js here, so the
 * composition rules are unit-tested and the renderer only draws the plan.
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

// ---------------------------------------------------------------------------
// Scenery plan
// ---------------------------------------------------------------------------

export type TreeType = "pine" | "round" | "blossom" | "violet" | "umbrella";

export interface TreePoint {
  x: number;
  z: number;
  scale: number;
  rot: number;
  type: TreeType;
  /** 0–1, stable per point: brightness variation */
  tint: number;
}
export interface BushPoint {
  x: number;
  z: number;
  scale: number;
  rot: number;
  tint: number;
}
/** color: 0 yellow, 1 pink, 2 white, 3 lilac */
export interface FlowerPoint {
  x: number;
  z: number;
  scale: number;
  color: 0 | 1 | 2 | 3;
}
/** cap: 0 rose, 1 amber, 2 lilac */
export interface MushroomPoint {
  x: number;
  z: number;
  scale: number;
  cap: 0 | 1 | 2;
}
export interface RockPoint {
  x: number;
  z: number;
  scale: number;
  rot: number;
}
export interface TuftPoint {
  x: number;
  z: number;
  scale: number;
  rot: number;
  tint: number;
}
export interface FireflyPoint {
  x: number;
  z: number;
  /** Height above the ground */
  y: number;
  phase: number;
  speed: number;
}

export interface SceneryPlan {
  trees: TreePoint[];
  bushes: BushPoint[];
  flowers: FlowerPoint[];
  mushrooms: MushroomPoint[];
  rocks: RockPoint[];
  tufts: TuftPoint[];
  fireflies: FireflyPoint[];
}

export interface ComposeOptions {
  seed: number;
  center: [number, number];
  /** Radius of the flat, built-up core (also where meadow details live) */
  flatRadius: number;
  /** Outermost radius that receives vegetation */
  outerRadius: number;
  /** Footprints of buildings: nothing may be placed on them */
  buildingRects: WorldRect[];
  /** Areas kept completely free (e.g. the future central plaza) */
  reserveRects?: WorldRect[];
}

function insideRect(x: number, z: number, r: WorldRect, pad: number): boolean {
  return x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad;
}

const TWO_PI = Math.PI * 2;
/** Few and soft: a hint of life, not a swarm. */
export const FIREFLY_COUNT = 40;

/**
 * Compose the village scenery. The rules give it intention instead of
 * uniform randomness:
 *  - a few large "hero" umbrella trees as landmarks around the village;
 *  - groves: trees cluster where noise is high and thicken toward the edge,
 *    pines far away and softer blossom/violet trees near the village;
 *  - foundation planting: bushes and flower beds hugging each building,
 *    leaving a gap on the front (z-max) side for the future entrance;
 *  - meadow flower patches, fantasy mushroom rings, rock clusters;
 *  - grass tufts for lawn texture and fireflies for atmosphere.
 * Deterministic for a given seed.
 */
export function composeScenery(opts: ComposeOptions): SceneryPlan {
  const { seed, center, flatRadius, outerRadius } = opts;
  const [cx, cz] = center;
  const rects = [...opts.buildingRects, ...(opts.reserveRects ?? [])];
  const rand = mulberry32(seed);

  const occupied: Array<{ x: number; z: number; r: number }> = [];
  const blocked = (x: number, z: number, pad: number) => rects.some((r) => insideRect(x, z, r, pad));
  const free = (x: number, z: number, r: number) =>
    !blocked(x, z, r) && !occupied.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + r) ** 2);
  const take = (x: number, z: number, r: number) => occupied.push({ x, z, r });

  const plan: SceneryPlan = { trees: [], bushes: [], flowers: [], mushrooms: [], rocks: [], tufts: [], fireflies: [] };

  // --- Hero trees: big umbrella trees as landmarks -------------------------
  // They frame the back and the sides of the village (angles from -150° to
  // +30°, z-up is toward the default camera) and never stand in front of it,
  // where a giant tree would block the view of the buildings.
  const heroCount = 5;
  for (let i = 0; i < heroCount; i++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const theta = ((-150 + i * 45) * Math.PI) / 180 + (rand() - 0.5) * 0.4;
      const rho = flatRadius * (0.8 + rand() * 0.45);
      const x = cx + rho * Math.cos(theta);
      const z = cz + rho * Math.sin(theta);
      const scale = 1.2 + rand() * 0.35;
      const r = 3.4 * scale;
      if (!free(x, z, r)) continue;
      plan.trees.push({ x, z, scale, rot: rand() * TWO_PI, type: "umbrella", tint: rand() });
      take(x, z, r);
      break;
    }
  }

  // --- Groves: clustered by noise, denser toward the edge -----------------
  const inner = flatRadius * 0.62;
  const maxTrees = 320;
  for (let i = 0; i < 8000 && plan.trees.length < maxTrees; i++) {
    const rho = Math.sqrt(inner * inner + rand() * (outerRadius * outerRadius - inner * inner));
    const theta = rand() * TWO_PI;
    const x = cx + rho * Math.cos(theta);
    const z = cz + rho * Math.sin(theta);
    const n = fbm2D(x * 0.065, z * 0.065, seed + 11, 3);
    const ramp = smoothstep(inner, flatRadius * 1.5, rho);
    const density = smoothstep(0.33, 0.56, n) * (0.4 + 0.6 * ramp);
    // Always consume the same random numbers per attempt for stability.
    const gate = rand();
    const scale = 0.75 + rand() * 0.45;
    const typeRoll = rand();
    const tint = rand();
    const rot = rand() * TWO_PI;
    if (gate > density) continue;
    const r = 1.6 * scale + 0.5;
    if (!free(x, z, r)) continue;

    const far = smoothstep(flatRadius * 1.2, flatRadius * 2.3, rho);
    const pPine = 0.12 + 0.46 * far;
    let type: TreeType;
    if (typeRoll < pPine) type = "pine";
    else if (typeRoll < pPine + 0.27) type = "round";
    else if (typeRoll < pPine + 0.27 + 0.18) type = "blossom";
    else if (typeRoll < pPine + 0.27 + 0.18 + 0.12) type = "violet";
    else type = "round";
    plan.trees.push({ x, z, scale, rot, type, tint });
    take(x, z, r);
  }

  // --- Foundation planting: bushes and flower beds hugging each building ---
  const flowerCluster = (x: number, z: number, count: number, spread: number, c1: number, c2: number) => {
    for (let k = 0; k < count; k++) {
      const a = rand() * TWO_PI;
      const d = Math.sqrt(rand()) * spread;
      const color = (rand() < 0.7 ? c1 : c2) as 0 | 1 | 2 | 3;
      plan.flowers.push({ x: x + d * Math.cos(a), z: z + d * Math.sin(a), scale: 0.8 + rand() * 0.6, color });
    }
  };
  for (const r of opts.buildingRects) {
    const off = 0.9;
    const x0 = r.minX - off;
    const x1 = r.maxX + off;
    const z0 = r.minZ - off;
    const z1 = r.maxZ + off;
    const mx = (r.minX + r.maxX) / 2;
    const step = 3.2;
    const spots: Array<[number, number]> = [];
    for (let x = x0; x <= x1; x += step) {
      spots.push([x, z0]);
      if (Math.abs(x - mx) >= 3.6) spots.push([x, z1]); // keep the front entrance open
    }
    for (let z = z0 + step; z < z1; z += step) {
      spots.push([x0, z]);
      spots.push([x1, z]);
    }
    for (const [sx, sz] of spots) {
      const x = sx + (rand() - 0.5) * 0.7;
      const z = sz + (rand() - 0.5) * 0.7;
      const roll = rand();
      const scale = 0.8 + rand() * 0.5;
      const rot = rand() * TWO_PI;
      const tint = rand();
      const c1 = Math.floor(rand() * 4) as 0 | 1 | 2 | 3;
      const c2 = Math.floor(rand() * 4) as 0 | 1 | 2 | 3;
      if (roll < 0.38) {
        if (!free(x, z, 0.7 * scale)) continue;
        plan.bushes.push({ x, z, scale, rot, tint });
        take(x, z, 0.7 * scale);
      } else if (roll < 0.8) {
        if (!free(x, z, 0.8)) continue;
        flowerCluster(x, z, 4 + Math.floor(rand() * 3), 0.7, c1, c2);
        take(x, z, 0.8);
      }
    }
  }

  // --- Meadow flower patches ----------------------------------------------
  for (let i = 0; i < 34; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const rho = Math.sqrt(rand()) * flatRadius * 1.25;
      const theta = rand() * TWO_PI;
      const x = cx + rho * Math.cos(theta);
      const z = cz + rho * Math.sin(theta);
      if (!free(x, z, 2.6)) continue;
      flowerCluster(x, z, 10 + Math.floor(rand() * 9), 2.5, Math.floor(rand() * 4) as 0 | 1 | 2 | 3, Math.floor(rand() * 4) as 0 | 1 | 2 | 3);
      take(x, z, 2.5);
      break;
    }
  }

  // --- Loose shrubs: single bushes and small thickets break up open lawn ----
  for (let i = 0; i < 44; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const rho = Math.sqrt(rand()) * flatRadius * 1.3;
      const theta = rand() * TWO_PI;
      const x = cx + rho * Math.cos(theta);
      const z = cz + rho * Math.sin(theta);
      if (!free(x, z, 1.3)) continue;
      const count = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < count; k++) {
        const bx = x + (rand() - 0.5) * 1.8;
        const bz = z + (rand() - 0.5) * 1.8;
        if (blocked(bx, bz, 0.6)) continue;
        plan.bushes.push({ x: bx, z: bz, scale: 0.8 + rand() * 0.7, rot: rand() * TWO_PI, tint: rand() });
      }
      take(x, z, 1.3);
      break;
    }
  }

  // --- Fantasy mushroom rings beside groves --------------------------------
  const grove = plan.trees.filter((t) => t.type !== "umbrella" && Math.hypot(t.x - cx, t.z - cz) > flatRadius * 0.9);
  let rings = 0;
  for (let attempt = 0; attempt < 40 && rings < 5 && grove.length > 0; attempt++) {
    const tree = grove[Math.floor(rand() * grove.length)];
    const a = rand() * TWO_PI;
    // Just outside the tree's own occupied radius, so the ring is never blocked by it.
    const off = 1.6 * tree.scale + 0.5 + 1.9;
    const mx = tree.x + off * Math.cos(a);
    const mz = tree.z + off * Math.sin(a);
    if (!free(mx, mz, 1.6)) continue;
    rings++;
    const cap = Math.floor(rand() * 3) as 0 | 1 | 2;
    const m = 6 + Math.floor(rand() * 3);
    for (let k = 0; k < m; k++) {
      const ang = (k / m) * TWO_PI + rand() * 0.3;
      plan.mushrooms.push({ x: mx + 1.0 * Math.cos(ang), z: mz + 1.0 * Math.sin(ang), scale: 0.8 + rand() * 0.6, cap });
    }
    take(mx, mz, 1.6);
  }

  // --- Rock clusters ---------------------------------------------------------
  for (let i = 0; i < 14; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const rho = flatRadius * (0.6 + rand() * 1.2);
      const theta = rand() * TWO_PI;
      const x = cx + rho * Math.cos(theta);
      const z = cz + rho * Math.sin(theta);
      if (!free(x, z, 1.8)) continue;
      const count = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < count; k++) {
        plan.rocks.push({
          x: x + (rand() - 0.5) * 1.8,
          z: z + (rand() - 0.5) * 1.8,
          scale: 0.5 + rand() * 0.9,
          rot: rand() * TWO_PI,
        });
      }
      take(x, z, 1.6);
      break;
    }
  }

  // --- Grass tufts: lawn texture where noise allows -----------------------
  for (let i = 0; i < 5000 && plan.tufts.length < 1100; i++) {
    const rho = Math.sqrt(rand()) * flatRadius * 1.5;
    const theta = rand() * TWO_PI;
    const x = cx + rho * Math.cos(theta);
    const z = cz + rho * Math.sin(theta);
    const n = fbm2D(x * 0.08, z * 0.08, seed + 5, 2);
    const scale = 0.7 + rand() * 0.6;
    const rot = rand() * TWO_PI;
    const tint = rand();
    if (n < 0.3 || blocked(x, z, 0.25)) continue;
    plan.tufts.push({ x, z, scale, rot, tint });
  }

  // --- Fireflies: around buildings and groves --------------------------------
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const nearBuilding = opts.buildingRects.length > 0 && rand() < 0.6;
    let x: number;
    let z: number;
    if (nearBuilding) {
      const r = opts.buildingRects[Math.floor(rand() * opts.buildingRects.length)];
      x = r.minX - 3 + rand() * (r.maxX - r.minX + 6);
      z = r.minZ - 3 + rand() * (r.maxZ - r.minZ + 6);
    } else if (plan.trees.length > 0) {
      const t = plan.trees[Math.floor(rand() * plan.trees.length)];
      x = t.x + (rand() - 0.5) * 6;
      z = t.z + (rand() - 0.5) * 6;
    } else {
      x = cx + (rand() - 0.5) * flatRadius * 2;
      z = cz + (rand() - 0.5) * flatRadius * 2;
    }
    plan.fireflies.push({ x, z, y: 0.8 + rand() * 2.4, phase: rand() * TWO_PI, speed: 0.4 + rand() * 0.7 });
  }

  return plan;
}
