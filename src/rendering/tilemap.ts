import { getTileById, type TileDefinition } from "../world/tiles"

export const TILE_SIZE = 32

export interface Tilemap {
  /** tiles[row][col] — row-major so tiles[0] is the top row. */
  tiles: readonly (readonly number[])[]
  tileSize: number
}

export interface TileRange {
  minCol: number
  maxCol: number
  minRow: number
  maxRow: number
}

export function getTileId(map: Tilemap, col: number, row: number): number {
  return map.tiles[row]?.[col] ?? -1
}

// Returns the TileDefinition for the tile at (col, row), or undefined for
// out-of-bounds positions or unknown tile IDs.
export function getTileDef(
  map: Tilemap,
  col: number,
  row: number,
): TileDefinition | undefined {
  const id = getTileId(map, col, row)
  if (id === -1) return undefined
  try {
    return getTileById(id)
  } catch {
    return undefined
  }
}

export function isSolid(map: Tilemap, col: number, row: number): boolean {
  return getTileDef(map, col, row)?.solid ?? false
}

export function worldToTile(
  worldX: number,
  worldY: number,
  tileSize: number,
): { col: number; row: number } {
  return {
    col: Math.floor(worldX / tileSize),
    row: Math.floor(worldY / tileSize),
  }
}

export function getVisibleTileRange(
  cameraX: number,
  cameraY: number,
  canvasWidth: number,
  canvasHeight: number,
  map: Tilemap,
): TileRange {
  const { tileSize, tiles } = map
  const rowCount = tiles.length
  const colCount = rowCount > 0 ? tiles[0].length : 0

  return {
    minCol: Math.max(0, Math.floor(cameraX / tileSize)),
    maxCol: Math.min(
      colCount - 1,
      Math.ceil((cameraX + canvasWidth) / tileSize),
    ),
    minRow: Math.max(0, Math.floor(cameraY / tileSize)),
    maxRow: Math.min(
      rowCount - 1,
      Math.ceil((cameraY + canvasHeight) / tileSize),
    ),
  }
}
