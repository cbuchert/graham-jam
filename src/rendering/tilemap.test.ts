import { describe, expect, it } from "vitest"
import {
  getTileDef,
  getTileId,
  getVisibleTileRange,
  isSolid,
  type Tilemap,
  worldToTile,
} from "./tilemap"

// 3×3 map fixture: tile 0 = grass (walkable), tile 1 = wall (solid)
//   col: 0  1  2
// row 0: [0, 0, 0]
// row 1: [0, 1, 0]
// row 2: [0, 0, 0]
const map: Tilemap = {
  tiles: [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0],
  ],
  tileSize: 32,
}

describe("getTileId", () => {
  it("returns the tile ID at a valid grid position", () => {
    expect(getTileId(map, 1, 1)).toBe(1)
  })

  it("returns the tile ID at the top-left corner", () => {
    expect(getTileId(map, 0, 0)).toBe(0)
  })

  it("returns -1 for a column out of bounds", () => {
    expect(getTileId(map, 5, 0)).toBe(-1)
  })

  it("returns -1 for a row out of bounds", () => {
    expect(getTileId(map, 0, 5)).toBe(-1)
  })

  it("returns -1 for negative coordinates", () => {
    expect(getTileId(map, -1, 0)).toBe(-1)
  })
})

describe("getTileDef", () => {
  it("returns the def for a known tile ID", () => {
    const def = getTileDef(map, 1, 1)
    expect(def).toBeDefined()
    expect(def?.solid).toBe(true)
  })

  it("returns undefined for an out-of-bounds position", () => {
    expect(getTileDef(map, 99, 99)).toBeUndefined()
  })
})

describe("isSolid", () => {
  it("returns true for a solid tile", () => {
    expect(isSolid(map, 1, 1)).toBe(true)
  })

  it("returns false for a walkable tile", () => {
    expect(isSolid(map, 0, 0)).toBe(false)
  })

  it("returns false for out-of-bounds coordinates (safe default)", () => {
    expect(isSolid(map, 99, 99)).toBe(false)
  })
})

describe("worldToTile", () => {
  it("converts exact tile-boundary world coordinates", () => {
    expect(worldToTile(64, 32, 32)).toEqual({ col: 2, row: 1 })
  })

  it("floors fractional positions within a tile", () => {
    // world (50, 50) is still within tile (1, 1) at tileSize 32
    expect(worldToTile(50, 50, 32)).toEqual({ col: 1, row: 1 })
  })

  it("returns (0, 0) for the origin", () => {
    expect(worldToTile(0, 0, 32)).toEqual({ col: 0, row: 0 })
  })
})

describe("getVisibleTileRange", () => {
  it("returns the full map when camera is at origin and canvas matches map size", () => {
    // 3×3 tiles at 32px = 96×96 canvas
    const range = getVisibleTileRange(0, 0, 96, 96, map)
    expect(range.minCol).toBe(0)
    expect(range.minRow).toBe(0)
    expect(range.maxCol).toBe(2)
    expect(range.maxRow).toBe(2)
  })

  it("shifts visible columns when camera is offset by one full tile", () => {
    // Camera shifted right by 32px — column 0 is off the left edge
    const range = getVisibleTileRange(32, 0, 64, 96, map)
    expect(range.minCol).toBe(1)
    expect(range.maxCol).toBe(2)
  })

  it("shifts visible rows when camera is offset vertically", () => {
    const range = getVisibleTileRange(0, 32, 96, 64, map)
    expect(range.minRow).toBe(1)
    expect(range.maxRow).toBe(2)
  })

  it("clamps minCol and minRow to 0 when camera is at or before map origin", () => {
    const range = getVisibleTileRange(0, 0, 200, 200, map)
    expect(range.minCol).toBe(0)
    expect(range.minRow).toBe(0)
  })

  it("clamps maxCol and maxRow to the last tile index", () => {
    // Canvas far larger than the map — should not exceed tile index 2
    const range = getVisibleTileRange(0, 0, 500, 500, map)
    expect(range.maxCol).toBe(2)
    expect(range.maxRow).toBe(2)
  })
})
