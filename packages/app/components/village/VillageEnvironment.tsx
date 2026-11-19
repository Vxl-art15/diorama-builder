"use client";

import { useMemo } from "react";
import { buildingWorldRects, scatterScenery, type BuildingConfig, type RoomConfig } from "@diorama/engine";
import { Terrain3D } from "./Terrain3D";
import { Scenery3D } from "./Scenery3D";

const SCENERY_SEED = 20260;

interface VillageEnvironmentProps {
  rooms: Pick<RoomConfig, "building" | "position" | "size">[];
  buildings: BuildingConfig[];
  /** World-space center of the village (x, y=0, z) */
  center: [number, number, number];
  /** World-space bounding radius of the rooms */
  fitRadius: number;
}

/**
 * Everything around the buildings: grass, clearing and trees. Scenery keeps
 * clear of every building footprint and of a reserved central area that the
 * plaza will occupy.
 */
export function VillageEnvironment({ rooms, buildings, center, fitRadius }: VillageEnvironmentProps) {
  const cx = center[0];
  const cz = center[2];
  const radius = fitRadius * 2.2 + 25;

  const points = useMemo(() => {
    const exclusions = buildingWorldRects(rooms, buildings);
    // Reserved for the central plaza: keep the middle of the village open.
    const reserve = fitRadius * 0.35;
    exclusions.push({ minX: cx - reserve, minZ: cz - reserve, maxX: cx + reserve, maxZ: cz + reserve });
    return scatterScenery({
      seed: SCENERY_SEED,
      count: Math.min(220, Math.max(60, Math.round((radius * radius) / 45))),
      center: [cx, cz],
      radius,
      exclusions,
    });
  }, [rooms, buildings, cx, cz, fitRadius, radius]);

  return (
    <>
      <Terrain3D center={[cx, cz]} clearingRadius={fitRadius * 1.5 + 18} />
      <Scenery3D points={points} />
    </>
  );
}
