import { describe, expect, it } from "vitest"
import {
  addSceneName,
  parseSceneFile,
  parseSceneNames,
  replaceMarkerBlock,
  resizeTileGrid,
  scaffoldSceneFile,
  serializeSceneBlock,
} from "./sceneParser.ts"

// ---------------------------------------------------------------------------
// Fixtures

const MINIMAL_SCENE = `\
import { something } from "../world/maps/town";

// hand-authored content above

// @map-editor:start
export const TILES = [[0,1],[1,0]] as number[][];
export const SPAWN_POINTS = {"entrance":{"x":1,"y":0}} as Record<string, { x: number; y: number }>;
// @map-editor:end

// hand-authored content below
export const triggers = [];
`

const NO_MARKERS_SCENE = `\
export const TILES = [[0,1],[1,0]] as number[][];
`

const WORLD_GRAPH = `\
export const SCENE_NAMES = ['town', 'dungeon'] as const;
export type SceneName = typeof SCENE_NAMES[number];
`

// ---------------------------------------------------------------------------
// parseSceneFile

describe("parseSceneFile", () => {
  it("extracts tiles from between the markers", () => {
    const result = parseSceneFile(MINIMAL_SCENE)
    expect(result?.tiles).toEqual([
      [0, 1],
      [1, 0],
    ])
  })

  it("extracts spawn points from between the markers", () => {
    const result = parseSceneFile(MINIMAL_SCENE)
    expect(result?.spawnPoints).toEqual({ entrance: { x: 1, y: 0 } })
  })

  it("returns null when markers are absent", () => {
    expect(parseSceneFile(NO_MARKERS_SCENE)).toBeNull()
  })

  it("returns empty spawn points when none are defined", () => {
    const content = `\
// @map-editor:start
export const TILES = [[0]] as number[][];
export const SPAWN_POINTS = {} as Record<string, { x: number; y: number }>;
// @map-editor:end
`
    expect(parseSceneFile(content)?.spawnPoints).toEqual({})
  })

  it("parses multiline TILES arrays correctly", () => {
    const content = `\
// @map-editor:start
export const TILES = [
  [1, 1, 1],
  [1, 0, 1],
  [1, 1, 1]
] as number[][];
export const SPAWN_POINTS = {} as Record<string, { x: number; y: number }>;
// @map-editor:end
`
    const result = parseSceneFile(content)
    expect(result?.tiles).toEqual([
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ])
  })
})

// ---------------------------------------------------------------------------
// serializeSceneBlock

describe("serializeSceneBlock", () => {
  it("round-trips tiles through serialize then parse", () => {
    const original = {
      tiles: [
        [0, 1],
        [1, 0],
      ],
      spawnPoints: {},
    }
    const block = serializeSceneBlock(original)
    const wrapper = `// @map-editor:start\n${block}\n// @map-editor:end\n`
    expect(parseSceneFile(wrapper)?.tiles).toEqual(original.tiles)
  })

  it("round-trips spawn points through serialize then parse", () => {
    const original = {
      tiles: [[0]],
      spawnPoints: { entrance: { x: 2, y: 3 } },
    }
    const block = serializeSceneBlock(original)
    const wrapper = `// @map-editor:start\n${block}\n// @map-editor:end\n`
    expect(parseSceneFile(wrapper)?.spawnPoints).toEqual(original.spawnPoints)
  })
})

// ---------------------------------------------------------------------------
// replaceMarkerBlock

describe("replaceMarkerBlock", () => {
  it("replaces only the content between the markers", () => {
    const newBlock =
      "\nexport const TILES = [[1]] as number[][];\nexport const SPAWN_POINTS = {} as Record<string, { x: number; y: number }>;\n"
    const result = replaceMarkerBlock(MINIMAL_SCENE, newBlock)
    expect(result).toContain("TILES = [[1]]")
    expect(result).toContain("hand-authored content above")
    expect(result).toContain("hand-authored content below")
  })

  it("returns null when markers are absent", () => {
    expect(replaceMarkerBlock(NO_MARKERS_SCENE, "anything")).toBeNull()
  })

  it("preserves content outside the markers exactly", () => {
    const newBlock =
      "\nexport const TILES = [[9]] as number[][];\nexport const SPAWN_POINTS = {} as Record<string, { x: number; y: number }>;\n"
    const result = replaceMarkerBlock(MINIMAL_SCENE, newBlock)
    if (!result) throw new Error("expected non-null result")
    const beforeStart = result.indexOf("// @map-editor:start")
    expect(result.slice(0, beforeStart)).toBe(
      MINIMAL_SCENE.slice(0, MINIMAL_SCENE.indexOf("// @map-editor:start")),
    )
  })
})

// ---------------------------------------------------------------------------
// parseSceneNames

describe("parseSceneNames", () => {
  it("returns all scene names from the SCENE_NAMES array", () => {
    expect(parseSceneNames(WORLD_GRAPH)).toEqual(["town", "dungeon"])
  })

  it("returns an empty array when SCENE_NAMES is not found", () => {
    expect(parseSceneNames("export type SceneName = never;")).toEqual([])
  })

  it("handles a single scene name", () => {
    const single = `export const SCENE_NAMES = ['town'] as const;`
    expect(parseSceneNames(single)).toEqual(["town"])
  })
})

// ---------------------------------------------------------------------------
// scaffoldSceneFile

describe("scaffoldSceneFile", () => {
  it("produces a file with the correct number of rows", () => {
    const file = scaffoldSceneFile(3, 2)
    const parsed = parseSceneFile(file)
    expect(parsed?.tiles).toHaveLength(2)
  })

  it("produces a file with the correct number of columns", () => {
    const file = scaffoldSceneFile(3, 2)
    const parsed = parseSceneFile(file)
    expect(parsed?.tiles[0]).toHaveLength(3)
  })

  it("fills every tile with zero", () => {
    const file = scaffoldSceneFile(3, 2)
    const parsed = parseSceneFile(file)
    expect(parsed?.tiles.flat().every((t) => t === 0)).toBe(true)
  })

  it("produces empty spawn points", () => {
    const file = scaffoldSceneFile(3, 2)
    const parsed = parseSceneFile(file)
    expect(parsed?.spawnPoints).toEqual({})
  })

  it("contains the marker start and end comments", () => {
    const file = scaffoldSceneFile(3, 2)
    expect(file).toContain("// @map-editor:start")
    expect(file).toContain("// @map-editor:end")
  })
})

// ---------------------------------------------------------------------------
// addSceneName

describe("addSceneName", () => {
  it("appends a name to an existing list", () => {
    const content = `export const SCENE_NAMES = ['town'] as const;`
    const result = addSceneName(content, "dungeon")
    expect(parseSceneNames(result)).toEqual(["town", "dungeon"])
  })

  it("adds a name to an empty list", () => {
    const content = `export const SCENE_NAMES = [] as const;`
    const result = addSceneName(content, "town")
    expect(parseSceneNames(result)).toEqual(["town"])
  })

  it("preserves content outside the SCENE_NAMES line", () => {
    const content = [
      `// Scene registry`,
      `export const SCENE_NAMES = ['town'] as const;`,
      `export type SceneName = typeof SCENE_NAMES[number];`,
    ].join("\n")
    const result = addSceneName(content, "dungeon")
    expect(result).toContain("// Scene registry")
    expect(result).toContain("export type SceneName")
  })
})

// ---------------------------------------------------------------------------
// resizeTileGrid

describe("resizeTileGrid", () => {
  const BASE = [
    [1, 2, 3],
    [4, 5, 6],
  ] // 3 wide × 2 tall

  it("returns the same content when dimensions are unchanged", () => {
    expect(resizeTileGrid(BASE, 3, 2)).toEqual(BASE)
  })

  it("expands width by padding new columns with 0", () => {
    const result = resizeTileGrid(BASE, 5, 2)
    expect(result[0]).toEqual([1, 2, 3, 0, 0])
    expect(result[1]).toEqual([4, 5, 6, 0, 0])
  })

  it("expands height by padding new rows with 0", () => {
    const result = resizeTileGrid(BASE, 3, 4)
    expect(result[2]).toEqual([0, 0, 0])
    expect(result[3]).toEqual([0, 0, 0])
  })

  it("shrinks width by truncating columns", () => {
    const result = resizeTileGrid(BASE, 2, 2)
    expect(result[0]).toEqual([1, 2])
    expect(result[1]).toEqual([4, 5])
  })

  it("shrinks height by truncating rows", () => {
    const result = resizeTileGrid(BASE, 3, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual([1, 2, 3])
  })

  it("handles simultaneous expand width and shrink height", () => {
    const result = resizeTileGrid(BASE, 5, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual([1, 2, 3, 0, 0])
  })

  it("preserves existing tile values exactly", () => {
    const result = resizeTileGrid(BASE, 3, 2)
    expect(result[0][1]).toBe(2)
    expect(result[1][2]).toBe(6)
  })
})
