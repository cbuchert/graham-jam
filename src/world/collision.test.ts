import { describe, expect, it } from "vitest"
import type { Tilemap } from "../rendering/tilemap"
import { resolveMovement } from "./collision"

// 3×3 map: walls on border, open floor in center (tile col=1, row=1).
//   [W, W, W]
//   [W, _, W]
//   [W, W, W]
// Floor tile world rect: x 32–63, y 32–63.
const map: Tilemap = {
  tileSize: 32,
  defs: {
    0: { sheetX: 0, sheetY: 0, solid: false },
    1: { sheetX: 1, sheetY: 0, solid: true },
  },
  tiles: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
}

// 16×16 entity fits inside the floor tile.
const W = 16
const H = 16

// Starting position well inside the floor tile.
const START_X = 40
const START_Y = 40

// Movement large enough to cross into a wall but small enough
// to stay within the map (DT_CAP × PLAYER_SPEED ≈ 8px in practice).
const MOVE = 20

describe("resolveMovement — horizontal", () => {
  it("allows movement when no solid tile is in the way", () => {
    const result = resolveMovement(START_X, START_Y, W, H, 4, 0, map)
    expect(result.x).toBe(START_X + 4)
  })

  it("stops the entity at the right wall boundary", () => {
    // Right wall tile col=2 starts at x=64. Entity right edge must not exceed 64.
    const result = resolveMovement(START_X, START_Y, W, H, MOVE, 0, map)
    expect(result.x).toBe(64 - W) // 48 — snapped flush to wall
  })

  it("stops the entity at the left wall boundary", () => {
    // Left wall tile col=0 ends at x=31. Entity left edge must be >= 32.
    const result = resolveMovement(START_X, START_Y, W, H, -MOVE, 0, map)
    expect(result.x).toBe(32) // snapped flush against left wall
  })
})

describe("resolveMovement — vertical", () => {
  it("allows movement when no solid tile is in the way", () => {
    const result = resolveMovement(START_X, START_Y, W, H, 0, 4, map)
    expect(result.y).toBe(START_Y + 4)
  })

  it("stops the entity at the bottom wall boundary", () => {
    // Bottom wall tile row=2 starts at y=64.
    const result = resolveMovement(START_X, START_Y, W, H, 0, MOVE, map)
    expect(result.y).toBe(64 - H) // 48
  })

  it("stops the entity at the top wall boundary", () => {
    // Top wall tile row=0 ends at y=31. Entity top edge must be >= 32.
    const result = resolveMovement(START_X, START_Y, W, H, 0, -MOVE, map)
    expect(result.y).toBe(32)
  })
})

describe("resolveMovement — diagonal and sliding", () => {
  it("allows diagonal movement when both axes are clear", () => {
    const result = resolveMovement(START_X, START_Y, W, H, 2, 2, map)
    expect(result.x).toBe(START_X + 2)
    expect(result.y).toBe(START_Y + 2)
  })

  it("slides along a wall — Y moves freely when X is blocked", () => {
    // Move right into wall, also move up. Y should still resolve.
    const result = resolveMovement(START_X, START_Y, W, H, MOVE, -4, map)
    expect(result.x).toBe(64 - W) // blocked on X
    expect(result.y).toBe(START_Y - 4) // free on Y
  })

  it("slides along a wall — X moves freely when Y is blocked", () => {
    // Move down into wall, also move right a little. X should still resolve.
    const result = resolveMovement(START_X, START_Y, W, H, 4, MOVE, map)
    expect(result.x).toBe(START_X + 4) // free on X
    expect(result.y).toBe(64 - H) // blocked on Y
  })
})
