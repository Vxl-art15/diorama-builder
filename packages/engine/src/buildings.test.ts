import { describe, it, expect } from "vitest";
import { parseConfig, DioramaConfigError } from "./config";
import { groupRoomsByBuilding, buildingBounds, findBuildingOfRoom } from "./buildings";

const base = { name: "Village", gateway: { url: "" } };
const room = (label: string, building?: string, position: [number, number] = [0, 0], size: [number, number] = [2, 2]) => ({
  preset: "workspace",
  position,
  size,
  label,
  ...(building ? { building } : {}),
});

describe("config: buildings", () => {
  it("defaults to no buildings (backwards compatible)", () => {
    const cfg = parseConfig({ ...base, rooms: [room("A")] });
    expect(cfg.buildings).toEqual([]);
    expect(cfg.rooms[0].building).toBeUndefined();
  });

  it("parses buildings and room.building references", () => {
    const cfg = parseConfig({
      ...base,
      buildings: [{ id: "cafe", name: "Café", color: "#ffaa00" }],
      rooms: [room("Counter", "cafe")],
    });
    expect(cfg.buildings[0]).toMatchObject({ id: "cafe", name: "Café" });
    expect(cfg.rooms[0].building).toBe("cafe");
  });

  it("rejects duplicate building ids", () => {
    expect(() =>
      parseConfig({ ...base, buildings: [{ id: "a", name: "A" }, { id: "a", name: "B" }] }),
    ).toThrow(DioramaConfigError);
  });

  it("rejects a room pointing at an unknown building", () => {
    expect(() => parseConfig({ ...base, rooms: [room("X", "ghost")] })).toThrow(/unknown building "ghost"/);
  });

  it("rejects an empty building name", () => {
    expect(() => parseConfig({ ...base, buildings: [{ id: "a", name: "" }] })).toThrow(DioramaConfigError);
  });
});

describe("groupRoomsByBuilding", () => {
  const buildings = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "empty", name: "Empty" },
  ];

  it("groups rooms and keeps empty buildings", () => {
    const rooms = [room("1", "a"), room("2", "b"), room("3", "a"), room("4")];
    const { groups, unassigned } = groupRoomsByBuilding(rooms, buildings);
    expect(groups.map((g) => g.roomIndexes)).toEqual([[0, 2], [1], []]);
    expect(unassigned).toEqual([3]);
  });

  it("treats an unknown building id as unassigned", () => {
    const { unassigned } = groupRoomsByBuilding([room("1", "nope")], buildings);
    expect(unassigned).toEqual([0]);
  });

  it("works with no buildings declared", () => {
    const { groups, unassigned } = groupRoomsByBuilding([room("1"), room("2")], []);
    expect(groups).toEqual([]);
    expect(unassigned).toEqual([0, 1]);
  });
});

describe("buildingBounds", () => {
  const rooms = [room("1", "a", [0, 0], [4, 3]), room("2", "a", [4, 1], [5, 4]), room("3", "b", [20, 20], [2, 2])];

  it("returns the union of the selected rooms", () => {
    expect(buildingBounds(rooms, [0, 1])).toEqual({ minX: 0, minY: 0, maxX: 9, maxY: 5 });
  });

  it("applies padding on every side", () => {
    expect(buildingBounds(rooms, [2], 1)).toEqual({ minX: 19, minY: 19, maxX: 23, maxY: 23 });
  });

  it("returns null for no rooms", () => {
    expect(buildingBounds(rooms, [])).toBeNull();
  });

  it("ignores out-of-range indexes", () => {
    expect(buildingBounds(rooms, [99])).toBeNull();
  });
});

describe("findBuildingOfRoom", () => {
  const buildings = [{ id: "a", name: "A" }];
  it("finds the building or null", () => {
    expect(findBuildingOfRoom(room("1", "a"), buildings)?.name).toBe("A");
    expect(findBuildingOfRoom(room("1"), buildings)).toBeNull();
    expect(findBuildingOfRoom(room("1", "zzz"), buildings)).toBeNull();
  });
});
