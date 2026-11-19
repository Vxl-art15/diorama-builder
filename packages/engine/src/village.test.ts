import { describe, it, expect } from "vitest";
import { toWorld } from "./geometry";
import {
  mulberry32,
  buildingWorldRects,
  composeScenery,
  FIREFLY_COUNT,
  type WorldRect,
  type ComposeOptions,
} from "./village";

const room = (building: string | undefined, position: [number, number], size: [number, number]) => ({
  building,
  position,
  size,
});

describe("mulberry32", () => {
  it("is deterministic and in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("differs between seeds", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("buildingWorldRects", () => {
  const buildings = [{ id: "a", name: "A" }];

  it("covers each building's rooms plus padding, matching toWorld", () => {
    const rooms = [room("a", [0, 0], [4, 3]), room("a", [4, 0], [5, 4])];
    const [rect] = buildingWorldRects(rooms, buildings, 0.6);
    const [x0, , z0] = toWorld(-0.6 * 200, -0.6 * 200);
    const [x1, , z1] = toWorld(9.6 * 200, 4.6 * 200);
    expect(rect.minX).toBeCloseTo(x0);
    expect(rect.minZ).toBeCloseTo(z0);
    expect(rect.maxX).toBeCloseTo(x1);
    expect(rect.maxZ).toBeCloseTo(z1);
  });

  it("adds a rect for rooms that belong to no building", () => {
    const rooms = [room("a", [0, 0], [2, 2]), room(undefined, [10, 10], [2, 2])];
    expect(buildingWorldRects(rooms, buildings)).toHaveLength(2);
  });

  it("returns nothing for no rooms", () => {
    expect(buildingWorldRects([], buildings)).toEqual([]);
  });
});

describe("composeScenery", () => {
  const buildingRects: WorldRect[] = [
    { minX: -30, minZ: -20, maxX: -8, maxZ: -2 },
    { minX: 10, minZ: -18, maxX: 30, maxZ: 0 },
    { minX: -12, minZ: 12, maxX: 14, maxZ: 30 },
  ];
  const reserveRects: WorldRect[] = [{ minX: -8, minZ: -6, maxX: 8, maxZ: 8 }];
  const base: ComposeOptions = {
    seed: 7,
    center: [0, 5],
    flatRadius: 50,
    outerRadius: 180,
    buildingRects,
    reserveRects,
  };
  const allRects = [...buildingRects, ...reserveRects];
  const inAny = (x: number, z: number) =>
    allRects.some((r) => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);

  it("is deterministic for a seed and changes with the seed", () => {
    expect(composeScenery(base)).toEqual(composeScenery(base));
    expect(composeScenery(base)).not.toEqual(composeScenery({ ...base, seed: 8 }));
  });

  it("fills every category", () => {
    const plan = composeScenery(base);
    expect(plan.trees.length).toBeGreaterThan(60);
    expect(plan.bushes.length).toBeGreaterThan(5);
    expect(plan.flowers.length).toBeGreaterThan(40);
    expect(plan.mushrooms.length).toBeGreaterThan(0);
    expect(plan.rocks.length).toBeGreaterThan(5);
    expect(plan.tufts.length).toBeGreaterThan(100);
    expect(plan.fireflies).toHaveLength(FIREFLY_COUNT);
  });

  it("places five hero umbrella trees as landmarks", () => {
    const heroes = composeScenery(base).trees.filter((t) => t.type === "umbrella" && t.scale >= 1.2);
    expect(heroes.length).toBeGreaterThanOrEqual(4);
    expect(heroes.length).toBeLessThanOrEqual(5);
  });

  it("keeps trees, bushes, rocks and tufts off buildings and the reserved plaza", () => {
    const plan = composeScenery(base);
    for (const p of [...plan.trees, ...plan.bushes, ...plan.rocks, ...plan.tufts]) {
      expect(inAny(p.x, p.z)).toBe(false);
    }
  });

  it("keeps trees from overlapping each other", () => {
    const trees = composeScenery(base).trees;
    for (let i = 0; i < trees.length; i++)
      for (let j = i + 1; j < trees.length; j++)
        expect(Math.hypot(trees[i].x - trees[j].x, trees[i].z - trees[j].z)).toBeGreaterThan(1);
  });

  it("stays inside the outer radius (plus rounding of clusters)", () => {
    const plan = composeScenery(base);
    for (const t of plan.trees) expect(Math.hypot(t.x - 0, t.z - 5)).toBeLessThanOrEqual(180 + 1e-6);
  });

  it("plants bushes or flowers right next to buildings (foundation planting)", () => {
    const plan = composeScenery(base);
    const near = [...plan.bushes, ...plan.flowers].filter((p) =>
      buildingRects.some(
        (r) => p.x > r.minX - 3 && p.x < r.maxX + 3 && p.z > r.minZ - 3 && p.z < r.maxZ + 3,
      ),
    );
    expect(near.length).toBeGreaterThan(10);
  });

  it("leaves the front entrance (z-max side, centered) free of foundation plants", () => {
    const plan = composeScenery(base);
    const r = buildingRects[2];
    const mx = (r.minX + r.maxX) / 2;
    const atDoor = [...plan.bushes].filter(
      (p) => Math.abs(p.x - mx) < 3 && p.z > r.maxZ && p.z < r.maxZ + 2,
    );
    expect(atDoor).toHaveLength(0);
  });

  it("gives fireflies a sensible height and phase", () => {
    for (const f of composeScenery(base).fireflies) {
      expect(f.y).toBeGreaterThanOrEqual(0.8);
      expect(f.y).toBeLessThanOrEqual(3.2);
      expect(f.phase).toBeGreaterThanOrEqual(0);
      expect(f.phase).toBeLessThan(Math.PI * 2);
    }
  });

  it("works with no buildings at all", () => {
    const plan = composeScenery({ ...base, buildingRects: [], reserveRects: [] });
    expect(plan.trees.length).toBeGreaterThan(0);
    expect(plan.fireflies).toHaveLength(FIREFLY_COUNT);
  });
});
