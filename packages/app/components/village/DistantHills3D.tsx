"use client";

import { useEffect, useMemo } from "react";
import { hillRingGeometry } from "./sceneryGeometry";

interface DistantHills3DProps {
  /** World-space center (x, z) of the village */
  center: [number, number];
  /** Fog far distance: hills sit inside it so haze softens them */
  fogFar: number;
}

/**
 * Two rings of far-off hills: a nearer green ring and a fainter violet ring.
 * The scene fog tints them, giving the horizon atmospheric depth so the
 * village reads as part of a wider valley rather than a patch of ground.
 */
export function DistantHills3D({ center, fogFar }: DistantHills3DProps) {
  const near = useMemo(
    () =>
      hillRingGeometry({
        radius: fogFar * 0.62,
        count: 26,
        seed: 31,
        width: [40, 90],
        height: [12, 30],
        bottomColor: "#68a877",
        topColor: "#8ecb8e",
      }),
    [fogFar],
  );
  const far = useMemo(
    () =>
      hillRingGeometry({
        radius: fogFar * 0.9,
        count: 20,
        seed: 53,
        width: [70, 140],
        height: [24, 56],
        bottomColor: "#9a8ed2",
        topColor: "#bfb2ec",
      }),
    [fogFar],
  );
  useEffect(
    () => () => {
      near.dispose();
      far.dispose();
    },
    [near, far],
  );

  return (
    <group position={[center[0], 0, center[1]]}>
      {/* `as never`: two copies of three's types are in play (same workaround as Room3D) */}
      <mesh geometry={near as never}>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>
      <mesh geometry={far as never}>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>
    </group>
  );
}
