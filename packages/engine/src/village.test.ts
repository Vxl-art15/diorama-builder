import { describe, it, expect } from "vitest";
import { toWorld } from "./geometry";
import { mulberry32, buildingWorldRects, scatterScenery, type WorldRect } from "./village";

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

describe("scatterScenery", () => {
  const exclusions: WorldRect[] = [{ minX: -10, minZ: -10, maxX: 10, maxZ: 10 }];
  const base = { seed: 7, count: 80, center: [0, 0] as [number, number], radius: 60, exclusions };

  it("is deterministic for a seed", () => {
    expect(scatterScenery(base)).toEqual(scatterScenery(base));
  });

  it("changes with the seed", () => {
    expect(scatterScenery(base)).not.toEqual(scatterScenery({ ...base, seed: 8 }));
  });

  it("never exceeds the requested count and stays inside the disc", () => {
    const pts = scatterScenery(base);
    expect(pts.length).toBeGreaterThan(0);
    expect(pts.length).toBeLessThanOrEqual(80);
    for (const p of pts) expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(60 + 1e-6);
  });

  it("keeps clear of exclusions including the margin", () => {
    for (const p of scatterScenery({ ...base, margin: 2 })) {
      const inside = p.x > -12 && p.x < 12 && p.z > -12 && p.z < 12;
      expect(inside).toBe(false);
    }
  });

  it("respects the minimum spacing", () => {
    const pts = scatterScenery({ ...base, minSpacing: 4 });
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        expect(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z)).toBeGreaterThanOrEqual(4);
  });

  it("produces valid kinds, scales and tints", () => {
    for (const p of scatterScenery(base)) {
      expect([0, 1, 2]).toContain(p.kind);
      expect(p.scale).toBeGreaterThanOrEqual(0.8);
      expect(p.scale).toBeLessThanOrEqual(1.4);
      expect(p.tint).toBeGreaterThanOrEqual(0);
      expect(p.tint).toBeLessThan(1);
    }
  });

  it("gives up gracefully when there is no room", () => {
    const full: WorldRect[] = [{ minX: -100, minZ: -100, maxX: 100, maxZ: 100 }];
    expect(scatterScenery({ ...base, exclusions: full })).toEqual([]);
  });
});
