import { isSolid, type Tilemap, worldToTile } from "../rendering/tilemap"

/**
 * Resolve an entity's desired movement against solid tiles.
 * X and Y axes are resolved separately to prevent corner-catching —
 * the entity can slide along a wall rather than stopping dead.
 *
 * Returns the new {x, y} position after collision is resolved.
 */
export function resolveMovement(
  x: number,
  y: number,
  width: number,
  height: number,
  dx: number,
  dy: number,
  map: Tilemap,
): { x: number; y: number } {
  const ts = map.tileSize
  let newX = x + dx
  let newY = y + dy

  // --- Resolve X axis ---
  if (dx > 0) {
    // Moving right: check the right edge of the entity
    const rightCol = worldToTile(newX + width - 1, y, ts).col
    const topRow = worldToTile(newX, y, ts).row
    const botRow = worldToTile(newX, y + height - 1, ts).row
    for (let row = topRow; row <= botRow; row++) {
      if (isSolid(map, rightCol, row)) {
        newX = rightCol * ts - width // snap left edge against wall
        break
      }
    }
  } else if (dx < 0) {
    // Moving left: check the left edge
    const leftCol = worldToTile(newX, y, ts).col
    const topRow = worldToTile(newX, y, ts).row
    const botRow = worldToTile(newX, y + height - 1, ts).row
    for (let row = topRow; row <= botRow; row++) {
      if (isSolid(map, leftCol, row)) {
        newX = (leftCol + 1) * ts // snap right edge against wall
        break
      }
    }
  }

  // --- Resolve Y axis (using corrected newX) ---
  if (dy > 0) {
    // Moving down: check the bottom edge
    const botRow = worldToTile(newX, newY + height - 1, ts).row
    const leftCol = worldToTile(newX, newY, ts).col
    const rightCol = worldToTile(newX + width - 1, newY, ts).col
    for (let col = leftCol; col <= rightCol; col++) {
      if (isSolid(map, col, botRow)) {
        newY = botRow * ts - height // snap top edge against wall
        break
      }
    }
  } else if (dy < 0) {
    // Moving up: check the top edge
    const topRow = worldToTile(newX, newY, ts).row
    const leftCol = worldToTile(newX, newY, ts).col
    const rightCol = worldToTile(newX + width - 1, newY, ts).col
    for (let col = leftCol; col <= rightCol; col++) {
      if (isSolid(map, col, topRow)) {
        newY = (topRow + 1) * ts // snap bottom edge against wall
        break
      }
    }
  }

  return { x: newX, y: newY }
}
