import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadBuilderStateFromConfig, saveBuilderStateToConfig } from "./configSync";

describe("configSync: buildings", () => {
  let tmpDir: string;
  let configPath: string;

  const config = {
    name: "village",
    gateway: { url: "" },
    buildings: [{ id: "cafe", name: "Café" }],
    rooms: [
      { preset: "workspace", position: [0, 0], size: [5, 4], label: "Counter", building: "cafe" },
      { preset: "lab", position: [10, 0], size: [4, 4], label: "Lab" },
    ],
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "violet-sync-"));
    configPath = path.join(tmpDir, "diorama.config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads room.building into builder state", () => {
    const state = loadBuilderStateFromConfig(configPath);
    expect(state.rooms[0].building).toBe("cafe");
    expect(state.rooms[1].building).toBeUndefined();
  });

  it("round-trips room.building and keeps the buildings list untouched", () => {
    const state = loadBuilderStateFromConfig(configPath);
    saveBuilderStateToConfig(configPath, state);
    const saved = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    expect(saved.buildings).toEqual(config.buildings);
    expect(saved.rooms[0].building).toBe("cafe");
    expect("building" in saved.rooms[1]).toBe(false);
  });
});
