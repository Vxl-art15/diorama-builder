"use client";

import { useCallback, useMemo } from "react";
import {
  buildingWorldRects,
  composeScenery,
  terrainHeight,
  type BuildingConfig,
  type RoomConfig,
  type TerrainOptions,
} from "@diorama/engine";
import { Terrain3D } from "./Terrain3D";
import { Scenery3D } from "./Scenery3D";
import { Sky3D } from "./Sky3D";
import { DistantHills3D } from "./DistantHills3D";
import { Fireflies3D } from "./Fireflies3D";
import { VillageLights } from "./VillageLights";
import { VillageCamera } from "./VillageCamera";
import { villageFog } from "./atmosphere";

const TERRAIN_SEED = 4242;
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
 * Everything around the buildings, composed from small modules: sky and sun,
 * distant hills, terrain, scenery, fireflies, lighting and the camera.
 * Later steps (plaza, paths, building shells) add their own siblings here and
 * pass extra exclusion areas to the scenery plan.
 */
export function VillageEnvironment({ rooms, buildings, center, fitRadius }: VillageEnvironmentProps) {
  const cx = center[0];
  const cz = center[2];
  const fog = villageFog(fitRadius);
  const flatRadius = fitRadius + 12;

  const terrain = useMemo<TerrainOptions>(
    () => ({ center: [cx, cz], flatRadius, blend: 70, amplitude: 11, seed: TERRAIN_SEED }),
    [cx, cz, flatRadius],
  );
  const heightAt = useCallback((x: number, z: number) => terrainHeight(x, z, terrain), [terrain]);

  const plan = useMemo(() => {
    const reserve = fitRadius * 0.35; // central plaza area, kept open for the next step
    return composeScenery({
      seed: SCENERY_SEED,
      center: [cx, cz],
      flatRadius,
      outerRadius: flatRadius + 135,
      buildingRects: buildingWorldRects(rooms, buildings),
      reserveRects: [{ minX: cx - reserve, minZ: cz - reserve, maxX: cx + reserve, maxZ: cz + reserve }],
    });
  }, [rooms, buildings, cx, cz, fitRadius, flatRadius]);

  return (
    <>
      <VillageLights center={[cx, cz]} shadowExtent={flatRadius * 1.3 + 20} />
      <VillageCamera center={[cx, cz]} fitRadius={fitRadius} />
      <Sky3D center={[cx, cz]} />
      <DistantHills3D center={[cx, cz]} fogFar={fog.far} />
      <Terrain3D options={terrain} radius={fog.far * 1.25} />
      <Scenery3D plan={plan} heightAt={heightAt} />
      <Fireflies3D points={plan.fireflies} heightAt={heightAt} />
    </>
  );
}
