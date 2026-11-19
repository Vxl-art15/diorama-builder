import type { BuildingConfig, RoomConfig } from "./config";

/** Axis-aligned bounds in grid units (same space as `room.position` / `room.size`). */
export interface GridBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface BuildingGroup {
  building: BuildingConfig;
  /** Indexes into the `rooms` array, in original order */
  roomIndexes: number[];
}

/**
 * Group rooms by the building they belong to. Pure.
 *
 * Returns one group per declared building (in declaration order, including
 * buildings with no rooms) plus the indexes of rooms that belong to no
 * building (or to an unknown one) in `unassigned`.
 */
export function groupRoomsByBuilding(
  rooms: Pick<RoomConfig, "building">[],
  buildings: BuildingConfig[],
): { groups: BuildingGroup[]; unassigned: number[] } {
  const groups: BuildingGroup[] = buildings.map((building) => ({ building, roomIndexes: [] }));
  const byId = new Map(groups.map((g) => [g.building.id, g]));
  const unassigned: number[] = [];
  rooms.forEach((room, i) => {
    const group = room.building === undefined ? undefined : byId.get(room.building);
    if (group) group.roomIndexes.push(i);
    else unassigned.push(i);
  });
  return { groups, unassigned };
}

/**
 * Bounding box of the given rooms in grid units, grown by `padding` on every
 * side. Returns null when there are no rooms.
 */
export function buildingBounds(
  rooms: Pick<RoomConfig, "position" | "size">[],
  roomIndexes: number[],
  padding = 0,
): GridBounds | null {
  if (roomIndexes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const i of roomIndexes) {
    const r = rooms[i];
    if (!r) continue;
    minX = Math.min(minX, r.position[0]);
    minY = Math.min(minY, r.position[1]);
    maxX = Math.max(maxX, r.position[0] + r.size[0]);
    maxY = Math.max(maxY, r.position[1] + r.size[1]);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding };
}

/** The building a room belongs to, or null. */
export function findBuildingOfRoom(
  room: Pick<RoomConfig, "building">,
  buildings: BuildingConfig[],
): BuildingConfig | null {
  if (room.building === undefined) return null;
  return buildings.find((b) => b.id === room.building) ?? null;
}
