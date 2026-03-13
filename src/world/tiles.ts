// src/world/tiles.ts
// New tile system with blob-tiling (autotile) support.
// See documents/tile-editor-spec.md for the full spec and spritesheet layout.

// Pixel dimensions of a single frame on the spritesheet grid.
// The renderer scales this up to match the world TILE_SIZE (32px).
export const SPRITE_TILE_SIZE = 16

export type TileType = "grass" | "wall" | "water" | "road"

// One blob variant for a given 4-bit neighbour mask.
// frameIndex: horizontal offset from baseCoords within the terrain's row.
export interface BlobFrame {
  frameIndex: number
  flipX: boolean
  flipY: boolean
}

// Full cardinal blob ruleset. Key is the 4-bit bitmask (0–15):
//   bit 0 = North neighbour is same terrain
//   bit 1 = East
//   bit 2 = South
//   bit 3 = West
// Every key 0–15 must be present.
export type BlobFrameSet = Record<number, BlobFrame>

// Location of a terrain type's first frame on the spritesheet (grid units, not px).
export interface SpriteCoords {
  col: number
  row: number
}

export interface TileDefinition {
  id: number
  type: TileType
  name: string
  solid: boolean
  editorColour: string   // hex colour used in the map editor canvas and any colour-fallback renderer
  frames: BlobFrameSet
  baseCoords: SpriteCoords
}

// Named tile coordinate within a scene. Used to position the player on arrival.
export interface SpawnPoint {
  x: number
  y: number
}

// All spawn points for a map, keyed by local name (e.g. "entrance", "fromDungeon").
export type SpawnPoints = Record<string, SpawnPoint>

// Placeholder blob ruleset — all 16 configurations point to frame 0, no flipping.
// Replaced with authored data once the tile editor UI is complete (Milestone 3).
function placeholder(): BlobFrameSet {
  return Object.fromEntries(
    Array.from({ length: 16 }, (_, mask) => [
      mask,
      { frameIndex: 0, flipX: false, flipY: false } satisfies BlobFrame,
    ]),
  ) as BlobFrameSet
}

export const TILE_REGISTRY: readonly TileDefinition[] = [
  { id: 0, type: "grass", name: "Grass", solid: false, editorColour: "#4a7c3f", frames: placeholder(), baseCoords: { col: 0, row: 0 } },
  { id: 1, type: "wall",  name: "Wall",  solid: true,  editorColour: "#5a5a5a", frames: placeholder(), baseCoords: { col: 0, row: 1 } },
  { id: 2, type: "water", name: "Water", solid: true,  editorColour: "#3a6bc4", frames: placeholder(), baseCoords: { col: 0, row: 2 } },
  { id: 3, type: "road",  name: "Road",  solid: false, editorColour: "#8b6b4a", frames: placeholder(), baseCoords: { col: 0, row: 3 } },
]

// O(1) lookup. A tile ID not in the registry is a data bug — no silent fallback.
export function getTileById(id: number): TileDefinition {
  const def = TILE_REGISTRY[id]
  if (def === undefined) {
    throw new Error(`Unknown tile id: ${id}. Valid range is 0–${TILE_REGISTRY.length - 1}.`)
  }
  return def
}
