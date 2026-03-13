/** Seconds per animation frame — ~6-7 fps, classic SNES RPG feel. */
export const FRAME_DURATION = 0.15

export interface AnimationState {
  /** Current frame index (column on the spritesheet row). */
  frame: number
  /** Seconds accumulated since the last frame advance. */
  accumulator: number
}

export type SpriteDirection = "down" | "left" | "right" | "up"

export interface WalkCycleDef {
  /** Row on the spritesheet for this direction. */
  row: number
  frameCount: number
}

/** Spritesheet layout: each direction occupies one row, frames go left to right. */
export const WALK_CYCLE: Record<SpriteDirection, WalkCycleDef> = {
  down: { row: 0, frameCount: 4 },
  left: { row: 1, frameCount: 4 },
  right: { row: 2, frameCount: 4 },
  up: { row: 3, frameCount: 4 },
}

/**
 * Advance the animation timer by dt seconds.
 * Frame index increments once per FRAME_DURATION and wraps at frameCount.
 * Remainder carries over so the timer stays accurate across variable-rate updates.
 */
export function advanceAnimation(
  state: AnimationState,
  dt: number,
  frameCount: number,
  frameDuration: number = FRAME_DURATION,
): AnimationState {
  const newAccumulator = state.accumulator + dt
  if (newAccumulator >= frameDuration) {
    return {
      frame: (state.frame + 1) % frameCount,
      accumulator: newAccumulator - frameDuration,
    }
  }
  return { ...state, accumulator: newAccumulator }
}

/**
 * Draw a single sprite frame from a spritesheet.
 * frameX/frameY are grid positions on the sheet, not pixel offsets.
 * Untested — canvas side effect.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  frameX: number,
  frameY: number,
  destX: number,
  destY: number,
  tileSize: number,
): void {
  ctx.drawImage(
    sheet,
    frameX * tileSize,
    frameY * tileSize,
    tileSize,
    tileSize,
    Math.round(destX),
    Math.round(destY),
    tileSize,
    tileSize,
  )
}
