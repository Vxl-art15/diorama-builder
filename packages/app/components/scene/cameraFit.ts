/** Farthest the camera may sit; sized so a multi-building village still fits. */
export const MAX_CAMERA_DISTANCE = 130;

/**
 * Distance the camera needs to frame a world of the given bounding radius.
 * Derived from the vertical FOV with a margin; clamped to the camera's
 * min/max distance range.
 */
export function fitCameraDistance(radius: number, fovDegrees: number): number {
  const fov = (fovDegrees * Math.PI) / 180;
  const distance = (radius * 1.25) / Math.tan(fov / 2);
  return Math.min(Math.max(distance, 8), MAX_CAMERA_DISTANCE);
}
