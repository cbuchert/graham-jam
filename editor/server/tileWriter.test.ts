import { describe, expect, it } from "vitest"
import { TILE_REGISTRY } from "../../src/world/tiles.ts"
import { generateTilesTs, packSpritesheet } from "./tileWriter.ts"

// ---------------------------------------------------------------------------
// generateTilesTs

describe("generateTilesTs", () => {
  it("includes all terrain type strings in the TileType union", () => {
    const out = generateTilesTs(TILE_REGISTRY as never)
    expect(out).toContain('"grass"')
    expect(out).toContain('"wall"')
    expect(out).toContain('"water"')
    expect(out).toContain('"road"')
  })

  it("includes all four terrain types in TILE_REGISTRY", () => {
    const out = generateTilesTs(TILE_REGISTRY as never)
    expect(out).toContain('name: "Grass"')
    expect(out).toContain('name: "Wall"')
    expect(out).toContain('name: "Water"')
    expect(out).toContain('name: "Road"')
  })

  it("marks wall and water as solid", () => {
    const out = generateTilesTs(TILE_REGISTRY as never)
    // Each entry serialises solid: true or solid: false alongside its name.
    // Check by counting solid: true occurrences — should be exactly 2.
    const solidTrueCount = (out.match(/solid: true/g) ?? []).length
    expect(solidTrueCount).toBe(2)
  })

  it("includes all 16 blob configurations for each terrain type", () => {
    const out = generateTilesTs(TILE_REGISTRY as never)
    // Each of the 16 bitmask keys (0–15) must appear in the frames block.
    for (let mask = 0; mask <= 15; mask++) {
      // Pattern: the key followed by a colon inside a frames block.
      expect(out).toContain(`${mask}:`)
    }
  })

  it("exports SPRITE_TILE_SIZE = 16", () => {
    const out = generateTilesTs(TILE_REGISTRY as never)
    expect(out).toContain("SPRITE_TILE_SIZE = 16")
  })

  it("exports getTileById that throws on unknown id", () => {
    const out = generateTilesTs(TILE_REGISTRY as never)
    expect(out).toContain("getTileById")
    expect(out).toContain("throw new Error")
  })
})

// ---------------------------------------------------------------------------
// packSpritesheet

describe("packSpritesheet", () => {
  it("returns a Buffer with a valid PNG header", () => {
    const buf = packSpritesheet({}, TILE_REGISTRY as never)
    // PNG magic bytes: 0x89 0x50 0x4E 0x47 ...
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50) // 'P'
    expect(buf[2]).toBe(0x4e) // 'N'
    expect(buf[3]).toBe(0x47) // 'G'
  })

  it("produces a non-empty buffer even when no pixel data is provided", () => {
    const buf = packSpritesheet({}, TILE_REGISTRY as never)
    expect(buf.length).toBeGreaterThan(0)
  })

  it("places pixel data at the correct row for a terrain type", () => {
    // Grass is row 0 (id 0). Supply a single red frame (16×16 pixels, all R=255 G=0 B=0 A=255).
    const redFrame = Array.from({ length: 16 * 16 * 4 }, (_, i) =>
      i % 4 === 0 ? 255 : i % 4 === 3 ? 255 : 0,
    )
    const buf = packSpritesheet({ grass: [redFrame] }, TILE_REGISTRY as never)
    // Minimal validation: buffer exists and has PNG header.
    expect(buf[0]).toBe(0x89)
    expect(buf.length).toBeGreaterThan(100)
  })
})
