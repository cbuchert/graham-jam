export interface Trigger {
  x: number
  y: number
  width: number
  height: number
  onEnter(): void
}

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
 * Returns the set of currently overlapping trigger indices and fires onEnter
 * for any trigger the player just entered this frame (wasn't in prevActive).
 */
export function checkTriggers(
  px: number,
  py: number,
  pw: number,
  ph: number,
  triggers: readonly Trigger[],
  prevActive: ReadonlySet<number>,
): Set<number> {
  const active = new Set<number>()

  for (let i = 0; i < triggers.length; i++) {
    const t = triggers[i]
    if (overlaps(px, py, pw, ph, t.x, t.y, t.width, t.height)) {
      active.add(i)
      if (!prevActive.has(i)) {
        t.onEnter()
      }
    }
  }

  return active
}
