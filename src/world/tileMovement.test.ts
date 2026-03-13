import { describe, expect, it } from "vitest"
import { createInputState, keyDown } from "../engine/input"
import type { Tilemap } from "../rendering/tilemap"
import {
  approachZero,
  facingTile,
  readInput,
  slideToward,
  type TileMovementState,
  worldPos,
} from "./tileMovement"

// ---------------------------------------------------------------------------
// Test fixtures

const TILE_SIZE = 32

// All-open 3×3 map — every tile is walkable.
const OPEN_MAP: Tilemap = {
  tileSize: TILE_SIZE,
  tiles: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
}

// Walled 3×3 map — only the centre tile (1,1) is walkable.
const WALLED_MAP: Tilemap = {
  tileSize: TILE_SIZE,
  tiles: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
}

// Player standing still at the centre of any 3×3 map.
const AT_CENTRE: TileMovementState = {
  tileX: 1,
  tileY: 1,
  offsetX: 0,
  offsetY: 0,
  moving: false,
}

// ---------------------------------------------------------------------------

describe("worldPos", () => {
  it("returns tile origin when offsets are zero", () => {
    expect(
      worldPos(
        { tileX: 2, tileY: 3, offsetX: 0, offsetY: 0, moving: false },
        32,
      ),
    ).toEqual({
      x: 64,
      y: 96,
    })
  })

  it("adds offsets to the tile origin", () => {
    expect(
      worldPos(
        { tileX: 1, tileY: 1, offsetX: -16, offsetY: 8, moving: true },
        32,
      ),
    ).toEqual({
      x: 16,
      y: 40,
    })
  })
})

describe("facingTile", () => {
  it("returns tile above when facing up", () => {
    expect(facingTile(AT_CENTRE, "up")).toEqual({ col: 1, row: 0 })
  })

  it("returns tile below when facing down", () => {
    expect(facingTile(AT_CENTRE, "down")).toEqual({ col: 1, row: 2 })
  })

  it("returns tile to the left when facing left", () => {
    expect(facingTile(AT_CENTRE, "left")).toEqual({ col: 0, row: 1 })
  })

  it("returns tile to the right when facing right", () => {
    expect(facingTile(AT_CENTRE, "right")).toEqual({ col: 2, row: 1 })
  })
})

describe("approachZero", () => {
  it("reduces positive value by step", () => {
    expect(approachZero(10, 3)).toBe(7)
  })

  it("reduces negative value toward zero", () => {
    expect(approachZero(-10, 3)).toBe(-7)
  })

  it("returns 0 when value is within step", () => {
    expect(approachZero(2, 5)).toBe(0)
  })

  it("returns 0 exactly — does not overshoot", () => {
    expect(approachZero(3, 3)).toBe(0)
  })
})

describe("slideToward", () => {
  it("reduces offsetX toward zero", () => {
    const state: TileMovementState = {
      ...AT_CENTRE,
      offsetX: -32,
      moving: true,
    }
    const result = slideToward(state, 0.1, 160) // step = 16
    expect(result.offsetX).toBe(-16)
    expect(result.moving).toBe(true)
  })

  it("sets moving to false when both offsets reach zero", () => {
    const state: TileMovementState = {
      ...AT_CENTRE,
      offsetX: -8,
      offsetY: 0,
      moving: true,
    }
    const result = slideToward(state, 0.1, 160) // step = 16, clears the -8
    expect(result.offsetX).toBe(0)
    expect(result.moving).toBe(false)
  })

  it("does not overshoot zero", () => {
    const state: TileMovementState = {
      ...AT_CENTRE,
      offsetX: -4,
      offsetY: 0,
      moving: true,
    }
    const result = slideToward(state, 1.0, 160) // large step
    expect(result.offsetX).toBe(0)
  })
})

describe("readInput — no input", () => {
  it("returns state unchanged when no key is held", () => {
    const input = createInputState()
    const result = readInput(AT_CENTRE, "down", input, OPEN_MAP)
    expect(result.state).toEqual(AT_CENTRE)
    expect(result.facing).toBe("down")
  })
})

describe("readInput — movement onto walkable tile", () => {
  it("steps right onto walkable tile", () => {
    const input = keyDown(createInputState(), "ArrowRight")
    const result = readInput(AT_CENTRE, "down", input, OPEN_MAP)
    expect(result.state.tileX).toBe(2)
    expect(result.state.tileY).toBe(1)
    expect(result.state.moving).toBe(true)
    expect(result.state.offsetX).toBe(-TILE_SIZE)
    expect(result.facing).toBe("right")
  })

  it("steps up onto walkable tile", () => {
    const input = keyDown(createInputState(), "ArrowUp")
    const result = readInput(AT_CENTRE, "down", input, OPEN_MAP)
    expect(result.state.tileY).toBe(0)
    expect(result.state.offsetY).toBe(TILE_SIZE)
    expect(result.facing).toBe("up")
  })
})

describe("readInput — collision", () => {
  it("does not move when target tile is solid", () => {
    const input = keyDown(createInputState(), "ArrowRight")
    const result = readInput(AT_CENTRE, "down", input, WALLED_MAP)
    expect(result.state).toEqual(AT_CENTRE)
  })

  it("updates facing even when blocked by a solid tile", () => {
    const input = keyDown(createInputState(), "ArrowLeft")
    const result = readInput(AT_CENTRE, "down", input, WALLED_MAP)
    expect(result.state.tileX).toBe(1) // didn't move
    expect(result.facing).toBe("left") // but turned to face the wall
  })
})
