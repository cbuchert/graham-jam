import { type InputState, isActionDown } from "../engine/input"
import type { SpriteDirection } from "../rendering/sprite"
import { isSolid, type Tilemap } from "../rendering/tilemap"

/**
 * Tile-aligned entity position.
 * tileX/tileY are the logical grid coordinates.
 * offsetX/offsetY animate from ±tileSize toward 0 during a move.
 */
export interface TileMovementState {
  tileX: number
  tileY: number
  offsetX: number
  offsetY: number
  moving: boolean
}

/** World-space position of the entity's top-left corner. */
export function worldPos(
  state: TileMovementState,
  tileSize: number,
): { x: number; y: number } {
  return {
    x: state.tileX * tileSize + state.offsetX,
    y: state.tileY * tileSize + state.offsetY,
  }
}

/** The tile one step ahead in the given facing direction. */
export function facingTile(
  state: TileMovementState,
  facing: SpriteDirection,
): { col: number; row: number } {
  return {
    col: state.tileX + (facing === "right" ? 1 : facing === "left" ? -1 : 0),
    row: state.tileY + (facing === "down" ? 1 : facing === "up" ? -1 : 0),
  }
}

/**
 * Advance the slide animation one frame toward the destination tile.
 * Returns updated state with reduced offsets and corrected moving flag.
 */
export function slideToward(
  state: TileMovementState,
  dt: number,
  moveSpeed: number,
): TileMovementState {
  const step = moveSpeed * dt
  const newOffX = approachZero(state.offsetX, step)
  const newOffY = approachZero(state.offsetY, step)
  const arrived = newOffX === 0 && newOffY === 0
  return { ...state, offsetX: newOffX, offsetY: newOffY, moving: !arrived }
}

/**
 * Read directional input and attempt a step to the adjacent tile.
 * Facing updates even when the target tile is solid — pressing into a wall
 * turns the character to face it, which is standard JRPG behaviour.
 * Returns both the updated movement state and the new facing direction.
 */
export function readInput(
  state: TileMovementState,
  facing: SpriteDirection,
  input: InputState,
  map: Tilemap,
): { state: TileMovementState; facing: SpriteDirection } {
  let dtileX = 0
  let dtileY = 0
  let newFacing = facing

  if (isActionDown(input, "up")) {
    dtileY = -1
    newFacing = "up"
  } else if (isActionDown(input, "down")) {
    dtileY = 1
    newFacing = "down"
  } else if (isActionDown(input, "left")) {
    dtileX = -1
    newFacing = "left"
  } else if (isActionDown(input, "right")) {
    dtileX = 1
    newFacing = "right"
  }

  if (dtileX === 0 && dtileY === 0) return { state, facing: newFacing }

  const nextTileX = state.tileX + dtileX
  const nextTileY = state.tileY + dtileY

  if (isSolid(map, nextTileX, nextTileY)) {
    // Blocked — update facing but don't move.
    return { state, facing: newFacing }
  }

  return {
    state: {
      tileX: nextTileX,
      tileY: nextTileY,
      offsetX: -dtileX * map.tileSize,
      offsetY: -dtileY * map.tileSize,
      moving: true,
    },
    facing: newFacing,
  }
}

/** Move a value toward zero by at most `step` without overshooting. */
export function approachZero(value: number, step: number): number {
  if (Math.abs(value) <= step) return 0
  return value - Math.sign(value) * step
}
