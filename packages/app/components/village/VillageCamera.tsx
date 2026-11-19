"use client";

import { useEffect, useRef, type ElementRef } from "react";
import { CameraControls } from "@react-three/drei";
import * as THREE from "three";
import { fitCameraDistance, MAX_CAMERA_DISTANCE } from "../scene/cameraFit";
import { VILLAGE_FOV } from "./atmosphere";

interface VillageCameraProps {
  /** World-space center (x, z) of the village */
  center: [number, number];
  /** World-space bounding radius of the rooms, used to frame the first view */
  fitRadius: number;
}

/**
 * The village camera. It uses drei's CameraControls (already installed)
 * instead of OrbitControls because it supports smooth, programmatic moves:
 * the next steps (focusing a building, entering it, leaving it) are
 * `setLookAt(..., true)` calls on this same controller. For now it frames the
 * whole village and lets you orbit, pan (right-drag) and zoom (wheel), kept
 * inside the village's bounds and above the ground.
 */
export function VillageCamera({ center, fitRadius }: VillageCameraProps) {
  const controls = useRef<ElementRef<typeof CameraControls>>(null);
  const [cx, cz] = center;

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const d = fitCameraDistance(fitRadius, VILLAGE_FOV) * 0.82;
    // ~26° above the horizon with a wide lens: the village is the focus, with
    // hills and a band of sky above it.
    void c.setLookAt(cx, d * 0.44, cz + d * 0.9, cx, 0, cz, false);
    const reach = fitRadius * 1.6 + 30;
    c.setBoundary(
      new THREE.Box3(new THREE.Vector3(cx - reach, -1, cz - reach), new THREE.Vector3(cx + reach, 60, cz + reach)) as never,
    );
  }, [cx, cz, fitRadius]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={6}
      maxDistance={MAX_CAMERA_DISTANCE + 10}
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI / 2.12}
      dollySpeed={0.7}
      smoothTime={0.14}
      draggingSmoothTime={0.07}
    />
  );
}
