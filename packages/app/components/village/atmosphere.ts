import { fitCameraDistance } from "../scene/cameraFit";

/**
 * Shared look of the village: one palette and one sun, so sky, fog, lights and
 * terrain colors always agree. Warm late-afternoon light with a violet sky.
 */

/** Color of the horizon: the fog fades the ground into exactly this. */
export const VILLAGE_HORIZON = "#f1cdb9";

const unit = (v: [number, number, number]): [number, number, number] => {
  const len = Math.hypot(...v);
  return [v[0] / len, v[1] / len, v[2] / len];
};

/** Direction of the sunlight (about 22° above the horizon, behind-left): long but readable shadows. */
export const SUN_DIRECTION = unit([-0.42, 0.4, -0.88]);
/**
 * Where the sun is DRAWN in the sky: same side, lower, so its glow sits near
 * the horizon inside the default view instead of high above it.
 */
export const SUN_VISUAL_DIRECTION = unit([-0.42, 0.2, -0.88]);

/** Vertical field of view of the village camera: wide enough to include hills and sky. */
export const VILLAGE_FOV = 58;

/**
 * Fog range for a village of the given world-space radius. It starts just
 * beyond the default camera distance and fades everything out well before the
 * ground's edge, so the world ends in haze, never in an edge.
 */
export function villageFog(fitRadius: number): { near: number; far: number } {
  const d = fitCameraDistance(fitRadius, VILLAGE_FOV);
  return { near: d * 1.15, far: d * 3.3 };
}
