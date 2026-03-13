import { beforeEach, describe, expect, it, vi } from "vitest"
import { TILE_REGISTRY } from "../../src/world/tiles.ts"
import { app } from "./app.ts"

// ---------------------------------------------------------------------------
// Mock the filesystem — routes use node:fs/promises for all file I/O
vi.mock("node:fs/promises")

import * as fs from "node:fs/promises"

const access = vi.mocked(fs.access)
const readFile = vi.mocked(fs.readFile)
const readdir = vi.mocked(fs.readdir)
const writeFile = vi.mocked(fs.writeFile)

// ---------------------------------------------------------------------------
// Fixtures

const WORLD_GRAPH_CONTENT = `export const SCENE_NAMES = ['town', 'dungeon'] as const;`

const TOWN_SCENE_CONTENT = `\
// hand-authored above

// @map-editor:start
export const TILES = [[0,1],[1,0]] as number[][];
export const SPAWN_POINTS = {"entrance":{"x":1,"y":0}} as Record<string, { x: number; y: number }>;
// @map-editor:end

// hand-authored below
`

const NO_MARKERS_CONTENT = `export const TILES = [[0]] as number[][];`

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// GET /api/health (existing — keep it green)

describe("GET /api/health", () => {
  it("returns 200 with { ok: true }", async () => {
    const res = await app.request("/api/health")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it("sets CORS header for the Vite dev origin", async () => {
    const res = await app.request("/api/health", {
      headers: { Origin: "http://localhost:5173" },
    })
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    )
  })

  it("does not set CORS header for unknown origins", async () => {
    const res = await app.request("/api/health", {
      headers: { Origin: "http://evil.example.com" },
    })
    expect(res.headers.get("access-control-allow-origin")).not.toBe(
      "http://evil.example.com",
    )
  })
})

// ---------------------------------------------------------------------------
// GET /api/scenes

describe("GET /api/scenes", () => {
  it("returns the list of scene names from worldGraph.ts", async () => {
    readFile.mockResolvedValueOnce(WORLD_GRAPH_CONTENT as never)
    const res = await app.request("/api/scenes")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(["town", "dungeon"])
  })

  it("returns an empty array when SCENE_NAMES is not defined", async () => {
    readFile.mockResolvedValueOnce(`export type SceneName = never;` as never)
    const res = await app.request("/api/scenes")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// GET /api/scene/:name

describe("GET /api/scene/:name", () => {
  it("returns tiles and spawn points for a valid scene file", async () => {
    readFile.mockResolvedValueOnce(TOWN_SCENE_CONTENT as never)
    const res = await app.request("/api/scene/town")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      tiles: [
        [0, 1],
        [1, 0],
      ],
      spawnPoints: { entrance: { x: 1, y: 0 } },
    })
  })

  it("returns 404 when the scene file does not exist", async () => {
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    readFile.mockRejectedValueOnce(err)
    const res = await app.request("/api/scene/missing")
    expect(res.status).toBe(404)
  })

  it("returns 400 when the file exists but has no markers", async () => {
    readFile.mockResolvedValueOnce(NO_MARKERS_CONTENT as never)
    const res = await app.request("/api/scene/town")
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// POST /api/scene/:name

describe("POST /api/scene/:name", () => {
  it("writes the updated content back to the scene file", async () => {
    readFile.mockResolvedValueOnce(TOWN_SCENE_CONTENT as never)
    writeFile.mockResolvedValueOnce(undefined as never)

    const body = {
      tiles: [
        [1, 0],
        [0, 1],
      ],
      spawnPoints: { exit: { x: 0, y: 1 } },
    }
    const res = await app.request("/api/scene/town", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    expect(res.status).toBe(200)
    const written = writeFile.mock.calls[0][1] as string
    expect(written).toContain("TILES = [[1,0],[0,1]]")
    expect(written).toContain(`"exit":{"x":0,"y":1}`)
    expect(written).toContain("hand-authored above")
    expect(written).toContain("hand-authored below")
  })

  it("returns 404 when the scene file does not exist", async () => {
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    readFile.mockRejectedValueOnce(err)
    const res = await app.request("/api/scene/missing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiles: [], spawnPoints: {} }),
    })
    expect(res.status).toBe(404)
  })

  it("returns 400 when the file exists but has no markers", async () => {
    readFile.mockResolvedValueOnce(NO_MARKERS_CONTENT as never)
    const res = await app.request("/api/scene/town", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiles: [], spawnPoints: {} }),
    })
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// POST /api/scene/:name/create

describe("POST /api/scene/:name/create", () => {
  it("scaffolds a scene file and registers the name in worldGraph.ts", async () => {
    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    access.mockRejectedValueOnce(enoent)
    readFile.mockResolvedValueOnce(WORLD_GRAPH_CONTENT as never)
    writeFile.mockResolvedValue(undefined as never)

    const res = await app.request("/api/scene/dungeon/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width: 4, height: 3 }),
    })

    expect(res.status).toBe(201)

    // Scene file written with correct dimensions
    const [scenePath, sceneContent] = writeFile.mock.calls[0] as [
      string,
      string,
    ]
    expect(scenePath).toContain("dungeon.ts")
    expect(sceneContent).toContain("// @map-editor:start")
    const parsed = JSON.parse(
      sceneContent.match(/TILES = (\[[\s\S]*?\]) as/)?.[1],
    )
    expect(parsed).toHaveLength(3) // 3 rows
    expect(parsed[0]).toHaveLength(4) // 4 cols

    // worldGraph.ts written with new name appended
    const [wgPath, wgContent] = writeFile.mock.calls[1] as [string, string]
    expect(wgPath).toContain("worldGraph.ts")
    expect(wgContent).toContain("'dungeon'")
  })

  it("returns 409 when the scene file already exists", async () => {
    access.mockResolvedValueOnce(undefined as never)

    const res = await app.request("/api/scene/town/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width: 3, height: 2 }),
    })

    expect(res.status).toBe(409)
    expect(writeFile).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// GET /api/tiles

describe("GET /api/tiles", () => {
  it("returns 200 with an array of tile definitions", async () => {
    const res = await app.request("/api/tiles")
    expect(res.status).toBe(200)
    const body = (await res.json()) as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(4)
  })

  it("includes all four terrain types", async () => {
    const res = await app.request("/api/tiles")
    const body = (await res.json()) as Array<{ type: string }>
    const types = body.map((t) => t.type)
    expect(types).toContain("grass")
    expect(types).toContain("wall")
    expect(types).toContain("water")
    expect(types).toContain("road")
  })

  it("each entry has the required fields", async () => {
    const res = await app.request("/api/tiles")
    const body = (await res.json()) as Array<Record<string, unknown>>
    for (const entry of body) {
      expect(entry).toHaveProperty("id")
      expect(entry).toHaveProperty("type")
      expect(entry).toHaveProperty("name")
      expect(entry).toHaveProperty("solid")
      expect(entry).toHaveProperty("frames")
      expect(entry).toHaveProperty("baseCoords")
    }
  })
})

// ---------------------------------------------------------------------------
// POST /api/tiles/export

describe("POST /api/tiles/export", () => {
  it("writes tiles.ts and tilesheet.png and returns 200", async () => {
    writeFile.mockResolvedValue(undefined as never)

    const res = await app.request("/api/tiles/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registry: TILE_REGISTRY, pixelData: {} }),
    })

    expect(res.status).toBe(200)
    expect(writeFile).toHaveBeenCalledTimes(2)

    const paths = writeFile.mock.calls.map((call) => call[0] as string)
    expect(paths.some((p) => p.endsWith("tiles.ts"))).toBe(true)
    expect(paths.some((p) => p.endsWith("tilesheet.png"))).toBe(true)
  })

  it("tiles.ts content includes TILE_REGISTRY and getTileById", async () => {
    writeFile.mockResolvedValue(undefined as never)

    await app.request("/api/tiles/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registry: TILE_REGISTRY, pixelData: {} }),
    })

    const tilesCall = writeFile.mock.calls.find((c) =>
      (c[0] as string).endsWith("tiles.ts"),
    )
    const content = tilesCall?.[1] as string
    expect(content).toContain("TILE_REGISTRY")
    expect(content).toContain("getTileById")
  })

  it("tilesheet.png is written as a binary Buffer", async () => {
    writeFile.mockResolvedValue(undefined as never)

    await app.request("/api/tiles/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registry: TILE_REGISTRY, pixelData: {} }),
    })

    const pngCall = writeFile.mock.calls.find((c) =>
      (c[0] as string).endsWith("tilesheet.png"),
    )
    expect(Buffer.isBuffer(pngCall?.[1])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// GET /api/tiles/usage/:type

describe("GET /api/tiles/usage/:type", () => {
  it("returns inUse: true when a map contains the tile ID", async () => {
    // TOWN_SCENE_CONTENT has tiles [[0,1],[1,0]] — grass (id 0) is present
    readdir.mockResolvedValue(["town.ts"] as never)
    readFile.mockResolvedValue(TOWN_SCENE_CONTENT as never)

    const res = await app.request("/api/tiles/usage/grass")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { inUse: boolean; maps: string[] }
    expect(body.inUse).toBe(true)
    expect(body.maps).toContain("town")
  })

  it("returns inUse: false when no map uses that tile ID", async () => {
    // Water = id 2, not present in [[0,1],[1,0]]
    readdir.mockResolvedValue(["town.ts"] as never)
    readFile.mockResolvedValue(TOWN_SCENE_CONTENT as never)

    const res = await app.request("/api/tiles/usage/water")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { inUse: boolean; maps: string[] }
    expect(body.inUse).toBe(false)
    expect(body.maps).toHaveLength(0)
  })

  it("returns 404 for an unknown terrain type string", async () => {
    const res = await app.request("/api/tiles/usage/nonexistent")
    expect(res.status).toBe(404)
  })
})
