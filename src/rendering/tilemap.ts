export const TILE_SIZE = 32

export interface TileDef {
  /** Column on the spritesheet grid. */
  sheetX: number
  /** Row on the spritesheet grid. */
  sheetY: number
  solid: boolean
}

export interface Tilemap {
  /** tiles[row][col] — row-major so tiles[0] is the top row. */
  tiles: readonly (readonly number[])[]
  tileSize: number
  defs: Readonly<Record<number, TileDef>>
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

export function getTileDef(
  map: Tilemap,
  col: number,
  row: number,
): TileDef | undefined {
  const id = getTileId(map, col, row)
  return id === -1 ? undefined : map.defs[id]
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
