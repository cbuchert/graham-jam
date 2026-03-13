import {
  getTileById,
  SPRITE_TILE_SIZE,
  type TileDefinition,
} from "../world/tiles"

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

// 4-bit cardinal bitmask for same-type neighbours.
// bit0=N, bit1=E, bit2=S, bit3=W (matches tiles.ts).
function computeBlobBitmask(
  map: Tilemap,
  col: number,
  row: number,
): number {
  const id = getTileId(map, col, row)
  if (id === -1) return 0
  let mask = 0
  if (getTileId(map, col, row - 1) === id) mask |= 1
  if (getTileId(map, col + 1, row) === id) mask |= 2
  if (getTileId(map, col, row + 1) === id) mask |= 4
  if (getTileId(map, col - 1, row) === id) mask |= 8
  return mask
}

/**
 * Renders the visible tilemap using the tilesheet and blob rules.
 * Falls back to editorColour fill when tilesheet is missing or not yet loaded.
 */
export function renderTilemap(
  ctx: CanvasRenderingContext2D,
  map: Tilemap,
  range: TileRange,
  cameraX: number,
  cameraY: number,
  tilesheet: HTMLImageElement | null,
): void {
  const { tileSize } = map
  // Use floored camera so all tiles align to the same pixel grid — avoids
  // 1px gaps from per-tile rounding when the camera has fractional values.
  const camX = Math.floor(cameraX)
  const camY = Math.floor(cameraY)
  ctx.imageSmoothingEnabled = false

  for (let row = range.minRow; row <= range.maxRow; row++) {
    for (let col = range.minCol; col <= range.maxCol; col++) {
      const tileId = getTileId(map, col, row)
      const sx = col * tileSize - camX
      const sy = row * tileSize - camY

      if (tileId < 0) {
        ctx.fillStyle = "#000"
        ctx.fillRect(sx, sy, tileSize, tileSize)
        continue
      }

      const def = getTileById(tileId)

      if (!tilesheet || !tilesheet.complete) {
        ctx.fillStyle = def.editorColour
        ctx.fillRect(sx, sy, tileSize, tileSize)
        continue
      }

      const bitmask = computeBlobBitmask(map, col, row)
      const frame = def.frames[bitmask] ?? {
        frameIndex: 0,
        flipX: false,
        flipY: false,
      }
      const srcX = (def.baseCoords.col + frame.frameIndex) * SPRITE_TILE_SIZE
      const srcY = def.baseCoords.row * SPRITE_TILE_SIZE

      ctx.save()
      ctx.translate(sx, sy)
      if (frame.flipX || frame.flipY) {
        ctx.translate(tileSize / 2, tileSize / 2)
        ctx.scale(frame.flipX ? -1 : 1, frame.flipY ? -1 : 1)
        ctx.translate(-tileSize / 2, -tileSize / 2)
      }
      ctx.drawImage(
        tilesheet,
        srcX,
        srcY,
        SPRITE_TILE_SIZE,
        SPRITE_TILE_SIZE,
        0,
        0,
        tileSize,
        tileSize,
      )
      ctx.restore()
    }
  }
}
