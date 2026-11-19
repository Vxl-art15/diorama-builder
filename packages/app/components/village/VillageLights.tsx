"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SUN_DIRECTION } from "./atmosphere";

interface VillageLightsProps {
  /** World-space center (x, z) of the village: the shadow frustum is centered here */
  center: [number, number];
  /** Half-size of the area that casts/receives shadows, in world units */
  shadowExtent: number;
}

/**
 * Late-afternoon light: a warm low sun that casts soft shadows over the
 * village, plus a hemisphere fill (violet from the sky, green bounce from the
 * grass) so the shaded side stays luminous instead of going dark.
 */
export function VillageLights({ center, shadowExtent }: VillageLightsProps) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const [cx, cz] = center;
  const sunPos: [number, number, number] = [
    cx + SUN_DIRECTION[0] * 320,
    SUN_DIRECTION[1] * 320,
    cz + SUN_DIRECTION[2] * 320,
  ];

  // The shadow camera's bounds are set through props; refresh its projection.
  useLayoutEffect(() => {
    light.current?.shadow.camera.updateProjectionMatrix();
  }, [shadowExtent]);

  return (
    <>
      <hemisphereLight args={["#efe6ff", "#c8e8a4", 1.2]} />
      <primitive object={target} position={[cx, 0, cz]} />
      <directionalLight
        ref={light}
        position={sunPos}
        target={target as never}
        color="#ffdca8"
        intensity={1.25}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0005}
        shadow-normalBias={0.06}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={10}
        shadow-camera-far={720}
      />
    </>
  );
}
