import { TILE_SIZE, type Tilemap } from "../../rendering/tilemap"

// @map-editor:start
export const TILES = [[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,0,1,1]] as number[][];
export const SPAWN_POINTS = {"entrance":{"x":2,"y":3}} as Record<string, { x: number; y: number }>;
// @map-editor:end

export const INTERIOR_MAP: Tilemap = {
  tileSize: TILE_SIZE,
  tiles: TILES,
}
