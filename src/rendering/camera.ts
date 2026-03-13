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
 * Center the camera on the player, then clamp to map bounds.
 * This is the only camera update needed for a top-down RPG.
 */
export function followPlayer(
  playerX: number,
  playerY: number,
  viewportWidth: number,
  viewportHeight: number,
  mapWidth: number,
  mapHeight: number,
): Camera {
  return clampCamera(
    { x: playerX - viewportWidth / 2, y: playerY - viewportHeight / 2 },
    mapWidth,
    mapHeight,
    viewportWidth,
    viewportHeight,
  )
}
