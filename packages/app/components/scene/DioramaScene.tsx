"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { createSceneConfig } from "@diorama/engine";
import { applyTheme, neonDarkTheme, warmOfficeTheme, cyberpunkTheme, minimalTheme } from "@diorama/plugins";
import * as THREE from "three";
import { fitCameraDistance, MAX_CAMERA_DISTANCE } from "./cameraFit";
import { VILLAGE_FOV, VILLAGE_HORIZON, villageFog } from "../village/atmosphere";

// Re-exported so existing importers (the builder's 3D view) keep working.
export { fitCameraDistance };

const THEMES: Record<string, typeof neonDarkTheme> = {
  "neon-dark": neonDarkTheme,
  "warm-office": warmOfficeTheme,
  "cyberpunk": cyberpunkTheme,
  "minimal": minimalTheme,
};

/** Fit radius (world units) up to which the default fog range is kept as-is. */
const FOG_BASE_RADIUS = 14;

/** Syncs camera + OrbitControls to center on rooms and fit their extent */
function CameraSync({ center, fitRadius }: { center: [number, number, number]; fitRadius?: number }) {
  const { camera, controls } = useThree();
  const prevCenter = useRef<string>("");

  useEffect(() => {
    const key = `${center[0].toFixed(2)},${center[2].toFixed(2)},${(fitRadius ?? 0).toFixed(2)}`;
    if (key === prevCenter.current) return;
    prevCenter.current = key;

    const fov = "fov" in camera ? (camera as unknown as THREE.PerspectiveCamera).fov : 50;
    const d = fitCameraDistance(fitRadius ?? 12, fov);
    // Keep the classic 4:3 down-angle: height 0.8·d, pull-back 0.6·d.
    camera.position.set(center[0], d * 0.8, center[2] + d * 0.6);
    camera.lookAt(center[0], 0, center[2]);
    camera.updateProjectionMatrix();

    if (controls) {
      const c = controls as unknown as { target: THREE.Vector3; update: () => void };
      c.target.set(center[0], 0, center[2]);
      c.update();
    }
  }, [center, fitRadius, camera, controls]);

  return null;
}

interface DioramaSceneProps {
  theme: string;
  center?: [number, number, number];
  /** World-space bounding radius of the content — used to frame the camera. */
  fitRadius?: number;
  /**
   * "office" = the original dark, gridded scene with OrbitControls.
   * "village" = outdoors: the children supply their own lights, camera and
   * sky (see VillageEnvironment); this component only provides the canvas,
   * shadows and fog.
   */
  environment?: "office" | "village";
  children: React.ReactNode;
}

export function DioramaScene({ theme, center, fitRadius, environment = "office", children }: DioramaSceneProps) {
  const sceneConfig = useMemo(() => {
    const base = createSceneConfig();
    const themePlugin = THEMES[theme] ?? neonDarkTheme;
    return applyTheme(base, themePlugin);
  }, [theme]);

  // Large worlds sit farther from the camera: widen fog and the far plane in
  // proportion so distant buildings are not swallowed by fog.
  const fogScale = Math.max(1, (fitRadius ?? 0) / FOG_BASE_RADIUS);
  const isVillage = environment === "village";
  const villageFogRange = isVillage ? villageFog(fitRadius ?? 12) : null;

  const initPos = center
    ? [center[0], 20, center[2] + 15] as [number, number, number]
    : sceneConfig.camera.position;

  return (
    // `key`: switching Office <-> Village remounts the canvas, so shadows,
    // lights and camera framing always start clean for that view.
    <Canvas
      key={environment}
      shadows={isVillage ? "soft" : false}
      // The village is painted with its own palette: no tone mapping, so the
      // colors read as designed instead of being muted by ACES.
      flat={isVillage}
      camera={{
        position: initPos,
        fov: isVillage ? VILLAGE_FOV : sceneConfig.camera.fov,
        near: isVillage ? 0.5 : sceneConfig.camera.near,
        far: isVillage ? 2600 : Math.max(sceneConfig.camera.far, MAX_CAMERA_DISTANCE * 3),
      }}
      style={{ width: "100%", height: "100%" }}
    >
      {!isVillage && center && <CameraSync center={center} fitRadius={fitRadius} />}
      <color attach="background" args={[isVillage ? VILLAGE_HORIZON : sceneConfig.background]} />
      <fog
        attach="fog"
        args={
          villageFogRange
            ? [VILLAGE_HORIZON, villageFogRange.near, villageFogRange.far]
            : [sceneConfig.fog.color, sceneConfig.fog.near * fogScale, sceneConfig.fog.far * fogScale]
        }
      />
      {!isVillage && (
        <>
          <ambientLight color={sceneConfig.ambientLight.color} intensity={sceneConfig.ambientLight.intensity} />
          {sceneConfig.directionalLights.map((light, i) => (
            <directionalLight
              key={i}
              position={light.position}
              color={light.color}
              intensity={light.intensity}
            />
          ))}
          <OrbitControls
            target={center ?? [0, 0, 0]}
            maxPolarAngle={Math.PI / 2.2}
            minDistance={5}
            maxDistance={MAX_CAMERA_DISTANCE + 10}
          />
          <gridHelper args={[50, 50, "#222233", "#181828"]} position={[0, -0.01, 0]} />
        </>
      )}
      {children}
    </Canvas>
  );
}
