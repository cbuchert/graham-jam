import { describe, expect, it } from "vitest"
import { TILE_REGISTRY, getTileById } from "./tiles.ts"

// ---------------------------------------------------------------------------
// getTileById

describe("getTileById", () => {
  it("returns the Grass definition for id 0", () => {
    const tile = getTileById(0)
    expect(tile.id).toBe(0)
    expect(tile.type).toBe("grass")
    expect(tile.name).toBe("Grass")
  })

  it("throws on an unknown id", () => {
    expect(() => getTileById(999)).toThrow()
  })

  it("throws on a negative id", () => {
    expect(() => getTileById(-1)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// TILE_REGISTRY completeness

describe("TILE_REGISTRY", () => {
  it("every terrain type has all 16 blob configurations defined", () => {
    for (const tile of TILE_REGISTRY) {
      for (let mask = 0; mask < 16; mask++) {
        expect(
          tile.frames[mask],
          `${tile.type} is missing blob config for mask ${mask}`,
        ).toBeDefined()
      }
    }
  })

  it("grass (id 0) is not solid", () => {
    expect(getTileById(0).solid).toBe(false)
  })

  it("wall (id 1) is solid", () => {
    expect(getTileById(1).solid).toBe(true)
  })

  it("water (id 2) is solid", () => {
    expect(getTileById(2).solid).toBe(true)
  })

  it("road (id 3) is not solid", () => {
    expect(getTileById(3).solid).toBe(false)
  })
})
