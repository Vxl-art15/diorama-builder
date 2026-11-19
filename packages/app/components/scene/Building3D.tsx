"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { toWorld, groupRoomsByBuilding, buildingBounds, type BuildingConfig, type RoomConfig } from "@diorama/engine";

const GRID_UNIT = 200;
/** Plaza margin around a building's rooms, in grid cells. */
const PADDING = 0.6;
/** Extra rim of accent color around the plaza, in world units. */
const RIM = 0.22;
const DEFAULT_COLOR = "#8090c0";

interface Building3DProps {
  rooms: Pick<RoomConfig, "building" | "position" | "size">[];
  buildings: BuildingConfig[];
}

/**
 * Village layer: one raised plaza + name sign per building, drawn under the
 * rooms that belong to it. Purely decorative (no pointer handlers), so it
 * never interferes with room selection or the editor's ground plane.
 * Renders nothing when no buildings are declared.
 */
export function Building3D({ rooms, buildings }: Building3DProps) {
  const plazas = useMemo(() => {
    if (buildings.length === 0) return [];
    const { groups } = groupRoomsByBuilding(rooms, buildings);
    return groups.flatMap((g) => {
      const b = buildingBounds(rooms, g.roomIndexes, PADDING);
      if (!b) return [];
      const [x0, , z0] = toWorld(b.minX * GRID_UNIT, b.minY * GRID_UNIT);
      const [x1, , z1] = toWorld(b.maxX * GRID_UNIT, b.maxY * GRID_UNIT);
      return [
        {
          key: g.building.id,
          name: g.building.name,
          color: g.building.color ?? DEFAULT_COLOR,
          center: [(x0 + x1) / 2, (z0 + z1) / 2] as [number, number],
          width: x1 - x0,
          depth: z1 - z0,
          // Sign sits above the front (z-max) edge's midpoint.
          signZ: z1,
        },
      ];
    });
  }, [rooms, buildings]);

  return (
    <group>
      {plazas.map((p) => (
        <group key={p.key}>
          {/* Accent rim */}
          <mesh position={[p.center[0], -0.06, p.center[1]]}>
            <boxGeometry args={[p.width + RIM * 2, 0.03, p.depth + RIM * 2]} />
            <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={0.35} roughness={0.8} />
          </mesh>
          {/* Plaza */}
          <mesh position={[p.center[0], -0.04, p.center[1]]}>
            <boxGeometry args={[p.width, 0.05, p.depth]} />
            <meshStandardMaterial color="#141c2b" roughness={0.95} />
          </mesh>
          <Html position={[p.center[0], 0.2, p.signZ + 0.4]} center style={{ pointerEvents: "none" }}>
            <div
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                background: "rgba(13,21,32,0.88)",
                border: `1.5px solid ${p.color}`,
                color: "#fff",
                fontSize: 15,
                fontWeight: 650,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
            >
              {p.name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
