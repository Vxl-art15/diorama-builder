import { describe, it, expect } from "vitest";
import { smoothstep, hash2, valueNoise2D, fbm2D } from "./noise";
import { terrainHeight, GROUND_Y, type TerrainOptions } from "./terrain";

describe("noise", () => {
  it("smoothstep clamps and eases", () => {
    expect(smoothstep(0, 10, -5)).toBe(0);
    expect(smoothstep(0, 10, 15)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5);
    expect(smoothstep(3, 3, 2)).toBe(0);
    expect(smoothstep(3, 3, 4)).toBe(1);
  });

  it("hash2 is deterministic and in [0, 1)", () => {
    expect(hash2(3, 9, 1)).toBe(hash2(3, 9, 1));
    expect(hash2(3, 9, 1)).not.toBe(hash2(3, 9, 2));
    for (let i = -20; i < 20; i++) {
      const v = hash2(i, i * 3, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("valueNoise2D and fbm2D stay in [0, 1] and are continuous", () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37 - 30;
      const y = i * 0.53 - 20;
      const a = valueNoise2D(x, y, 4);
      const f = fbm2D(x, y, 4, 3);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      expect(Math.abs(valueNoise2D(x + 0.001, y, 4) - a)).toBeLessThan(0.01);
    }
  });
});

describe("terrainHeight", () => {
  const o: TerrainOptions = { center: [0, 0], flatRadius: 50, blend: 40, amplitude: 12, seed: 3 };

  it("is perfectly flat inside the core", () => {
    for (const [x, z] of [[0, 0], [20, -10], [-35, 30], [49, 0], [0, -50]]) {
      expect(terrainHeight(x, z, o)).toBe(GROUND_Y);
    }
  });

  it("rises outside the core but never below the ground or above the amplitude", () => {
    let max = -Infinity;
    for (let i = 0; i < 400; i++) {
      const a = i * 0.7;
      const d = 55 + (i % 40) * 6;
      const h = terrainHeight(Math.cos(a) * d, Math.sin(a) * d, o);
      expect(h).toBeGreaterThanOrEqual(GROUND_Y);
      expect(h).toBeLessThanOrEqual(GROUND_Y + o.amplitude + 1e-9);
      max = Math.max(max, h);
    }
    expect(max).toBeGreaterThan(GROUND_Y + 1);
  });

  it("is deterministic, continuous and depends on the seed", () => {
    expect(terrainHeight(120, 80, o)).toBe(terrainHeight(120, 80, o));
    expect(Math.abs(terrainHeight(120.01, 80, o) - terrainHeight(120, 80, o))).toBeLessThan(0.05);
    expect(terrainHeight(120, 80, o)).not.toBe(terrainHeight(120, 80, { ...o, seed: 4 }));
  });

  it("follows the village center", () => {
    const moved: TerrainOptions = { ...o, center: [200, 200] };
    expect(terrainHeight(210, 195, moved)).toBe(GROUND_Y);
  });
});
