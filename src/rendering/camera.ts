export interface Camera {
  x: number
  y: number
}

/** World-to-screen: shift world coordinates by the camera's top-left position. */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
): { x: number; y: number } {
  return { x: worldX - camera.x, y: worldY - camera.y }
}

/** Clamp camera so it never scrolls beyond the map edges. */
export function clampCamera(
  camera: Camera,
  mapWidth: number,
  mapHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): Camera {
  return {
    x: Math.max(0, Math.min(camera.x, mapWidth - viewportWidth)),
    y: Math.max(0, Math.min(camera.y, mapHeight - viewportHeight)),
  }
}

/**
 * Center the camera on a world position, then clamp to map bounds.
 * Pass any entity's world coordinates to follow it; pass a fixed point for
 * a locked or cutscene camera.
 */
export function followTarget(
  targetX: number,
  targetY: number,
  viewportWidth: number,
  viewportHeight: number,
  mapWidth: number,
  mapHeight: number,
): Camera {
  return clampCamera(
    { x: targetX - viewportWidth / 2, y: targetY - viewportHeight / 2 },
    mapWidth,
    mapHeight,
    viewportWidth,
    viewportHeight,
  )
}

/**
 * Move `current` toward `target` by at most `maxStep` units.
 * Returns `target` exactly when within range — no overshoot.
 */
export function approachLinear(
  current: number,
  target: number,
  maxStep: number,
): number {
  const delta = target - current
  if (Math.abs(delta) <= maxStep) return target
  return current + Math.sign(delta) * maxStep
}

// ---------------------------------------------------------------------------
// CameraController

export interface CameraController {
  /**
   * World-space position getter to track each frame.
   * - Player: `() => playerWorldPos(player)`
   * - NPC:    `() => ({ x: npc.tileX * TILE_SIZE, y: npc.tileY * TILE_SIZE })`
   * - Fixed:  `() => ({ x: 400, y: 300 })`
   * - Frozen: `null` — camera does not move until target is set again.
   */
  target: (() => { x: number; y: number }) | null

  /**
   * How fast the camera moves toward the desired position, in px/s.
   * - `null` — snap instantly (classic RPG follow, hard cut)
   * - number — glide linearly (smooth pan, return to player after cutscene)
   */
  lerpSpeed: number | null

  /** Current camera position. Pass to `worldToScreen` for all rendering. */
  readonly camera: Camera

  /**
   * Advance camera position toward target. Call once per frame.
   * `dt` is delta time in seconds. Viewport and map dimensions are needed
   * to compute the desired position and clamp to map bounds.
   */
  update(
    dt: number,
    viewportWidth: number,
    viewportHeight: number,
    mapWidth: number,
    mapHeight: number,
  ): void
}

export function createCameraController(): CameraController {
  let _camera: Camera = { x: 0, y: 0 }

  return {
    target: null,
    lerpSpeed: null,

    get camera(): Camera {
      return _camera
    },

    update(dt, vpW, vpH, mapW, mapH) {
      if (this.target === null) return

      const { x, y } = this.target()
      const desired = followTarget(x, y, vpW, vpH, mapW, mapH)

      if (this.lerpSpeed === null) {
        // Snap — instant cut to target position.
        _camera = desired
      } else {
        // Linear approach — glides toward target at lerpSpeed px/s.
        const maxStep = this.lerpSpeed * dt
        _camera = {
          x: approachLinear(_camera.x, desired.x, maxStep),
          y: approachLinear(_camera.y, desired.y, maxStep),
        }
      }
    },
  }
}
