import type { SceneName } from "./worldGraph"

/** Zone trigger — callback fires when player enters. */
export interface ZoneTrigger {
  x: number
  y: number
  width: number
  height: number
  type: "zone"
  onEnter(): void
}

/** Door trigger — resolved by scene manager via world graph. No constructor refs. */
export interface DoorTrigger {
  x: number
  y: number
  width: number
  height: number
  type: "door"
  toScene: SceneName
  toSpawn: string
}

export type Trigger = ZoneTrigger | DoorTrigger

/** True when two AABBs strictly overlap (touching edges do not count). */
function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

/**
 * Check player AABB against all triggers.
 * Returns the set of currently overlapping trigger indices.
 * Fires onEnter for zone triggers and doorHandler for door triggers when the
 * player just entered (wasn't in prevActive).
 */
export function checkTriggers(
  px: number,
  py: number,
  pw: number,
  ph: number,
  triggers: readonly Trigger[],
  prevActive: ReadonlySet<number>,
  doorHandler?: (trigger: DoorTrigger) => void,
): Set<number> {
  const active = new Set<number>()

  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i]
    if (overlaps(px, py, pw, ph, t.x, t.y, t.width, t.height)) {
      active.add(i)
      if (!prevActive.has(i)) {
        if (t.type === "zone") {
          t.onEnter()
        } else if (t.type === "door" && doorHandler) {
          doorHandler(t)
        }
      }
    }
  }

  return active
}
