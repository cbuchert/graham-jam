import type { InputState } from "../engine/input"

export interface Entity {
  x: number
  y: number
  width: number
  height: number
  /** Optional: spritesheet grid position for this entity. */
  sprite?: { sheetX: number; sheetY: number }
  /** Optional: per-entity update logic (NPCs, animated objects). */
  update?(dt: number, input: InputState): void
}

/** Call update on every entity that has one. */
export function updateEntities(
  entities: readonly Entity[],
  dt: number,
  input: InputState,
): void {
  for (const entity of entities) {
    entity.update?.(dt, input)
  }
}
