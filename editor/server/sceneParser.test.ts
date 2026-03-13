import { describe, expect, it } from "vitest";
import {
  parseSceneFile,
  parseSceneNames,
  replaceMarkerBlock,
  serializeSceneBlock,
} from "./sceneParser.ts";

// ---------------------------------------------------------------------------
// Fixtures

const MINIMAL_SCENE = `\
import { something } from "../world/maps/town";

// hand-authored content above

// @scene-editor:start
export const TILES = [[0,1],[1,0]] as number[][];
export const SPAWN_POINTS = {"entrance":{"x":1,"y":0}} as Record<string, { x: number; y: number }>;
// @scene-editor:end

// hand-authored content below
export const triggers = [];
`;

const NO_MARKERS_SCENE = `\
export const TILES = [[0,1],[1,0]] as number[][];
`;

const WORLD_GRAPH = `\
export const SCENE_NAMES = ['town', 'dungeon'] as const;
export type SceneName = typeof SCENE_NAMES[number];
`;

// ---------------------------------------------------------------------------
// parseSceneFile

describe("parseSceneFile", () => {
  it("extracts tiles from between the markers", () => {
    const result = parseSceneFile(MINIMAL_SCENE);
    expect(result?.tiles).toEqual([[0, 1], [1, 0]]);
  });

  it("extracts spawn points from between the markers", () => {
    const result = parseSceneFile(MINIMAL_SCENE);
    expect(result?.spawnPoints).toEqual({ entrance: { x: 1, y: 0 } });
  });

  it("returns null when markers are absent", () => {
    expect(parseSceneFile(NO_MARKERS_SCENE)).toBeNull();
  });

  it("returns empty spawn points when none are defined", () => {
    const content = `\
// @scene-editor:start
export const TILES = [[0]] as number[][];
export const SPAWN_POINTS = {} as Record<string, { x: number; y: number }>;
// @scene-editor:end
`;
    expect(parseSceneFile(content)?.spawnPoints).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// serializeSceneBlock

describe("serializeSceneBlock", () => {
  it("round-trips tiles through serialize then parse", () => {
    const original = { tiles: [[0, 1], [1, 0]], spawnPoints: {} };
    const block = serializeSceneBlock(original);
    const wrapper = `// @scene-editor:start\n${block}\n// @scene-editor:end\n`;
    expect(parseSceneFile(wrapper)?.tiles).toEqual(original.tiles);
  });

  it("round-trips spawn points through serialize then parse", () => {
    const original = {
      tiles: [[0]],
      spawnPoints: { entrance: { x: 2, y: 3 } },
    };
    const block = serializeSceneBlock(original);
    const wrapper = `// @scene-editor:start\n${block}\n// @scene-editor:end\n`;
    expect(parseSceneFile(wrapper)?.spawnPoints).toEqual(original.spawnPoints);
  });
});

// ---------------------------------------------------------------------------
// replaceMarkerBlock

describe("replaceMarkerBlock", () => {
  it("replaces only the content between the markers", () => {
    const newBlock = "\nexport const TILES = [[1]] as number[][];\nexport const SPAWN_POINTS = {} as Record<string, { x: number; y: number }>;\n";
    const result = replaceMarkerBlock(MINIMAL_SCENE, newBlock);
    expect(result).toContain("TILES = [[1]]");
    expect(result).toContain("hand-authored content above");
    expect(result).toContain("hand-authored content below");
  });

  it("returns null when markers are absent", () => {
    expect(replaceMarkerBlock(NO_MARKERS_SCENE, "anything")).toBeNull();
  });

  it("preserves content outside the markers exactly", () => {
    const newBlock = "\nexport const TILES = [[9]] as number[][];\nexport const SPAWN_POINTS = {} as Record<string, { x: number; y: number }>;\n";
    const result = replaceMarkerBlock(MINIMAL_SCENE, newBlock)!;
    const beforeStart = result.indexOf("// @scene-editor:start");
    expect(result.slice(0, beforeStart)).toBe(MINIMAL_SCENE.slice(0, MINIMAL_SCENE.indexOf("// @scene-editor:start")));
  });
});

// ---------------------------------------------------------------------------
// parseSceneNames

describe("parseSceneNames", () => {
  it("returns all scene names from the SCENE_NAMES array", () => {
    expect(parseSceneNames(WORLD_GRAPH)).toEqual(["town", "dungeon"]);
  });

  it("returns an empty array when SCENE_NAMES is not found", () => {
    expect(parseSceneNames("export type SceneName = never;")).toEqual([]);
  });

  it("handles a single scene name", () => {
    const single = `export const SCENE_NAMES = ['town'] as const;`;
    expect(parseSceneNames(single)).toEqual(["town"]);
  });
});
