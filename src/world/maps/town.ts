import { TILE_SIZE, type Tilemap } from "../../rendering/tilemap"
import { TILES } from "../../scenes/town"

// Tile IDs match src/world/tileDefinitions.ts — keep in sync if new tiles are added.
// sheetX/sheetY are spritesheet coordinates (game-only; editor uses editorColour instead).
export const TOWN_MAP: Tilemap = {
  tileSize: TILE_SIZE,
  defs: {
    0: { sheetX: 0, sheetY: 0, solid: false }, // Grass
    1: { sheetX: 1, sheetY: 0, solid: true  }, // Wall
    2: { sheetX: 2, sheetY: 0, solid: true  }, // Water
    3: { sheetX: 3, sheetY: 0, solid: false }, // Door
    4: { sheetX: 4, sheetY: 0, solid: false }, // Chest
  },
  tiles: TILES,
}
