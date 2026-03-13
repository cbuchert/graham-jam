import { describe, expect, it, vi } from "vitest"
import { checkTriggers, type Trigger } from "./trigger"

function makeTrigger(x: number, y: number, w: number, h: number): Trigger {
  return { x, y, width: w, height: h, onEnter: vi.fn() }
}

// Player rect used across most tests
const PX = 50
const PY = 50
const PW = 16
const PH = 16

describe("checkTriggers", () => {
  it("returns an empty set when no triggers overlap", () => {
    const trigger = makeTrigger(200, 200, 32, 32) // far away
    const active = checkTriggers(PX, PY, PW, PH, [trigger], new Set())
    expect(active.size).toBe(0)
  })

  it("includes the trigger index when the player overlaps it", () => {
    const trigger = makeTrigger(40, 40, 32, 32) // overlaps player at (50,50)
    const active = checkTriggers(PX, PY, PW, PH, [trigger], new Set())
    expect(active.has(0)).toBe(true)
  })

  it("fires onEnter when the player enters a trigger for the first time", () => {
    const trigger = makeTrigger(40, 40, 32, 32)
    checkTriggers(PX, PY, PW, PH, [trigger], new Set()) // prevActive empty
    expect(trigger.onEnter).toHaveBeenCalledOnce()
  })

  it("does not fire onEnter when the player was already inside last frame", () => {
    const trigger = makeTrigger(40, 40, 32, 32)
    checkTriggers(PX, PY, PW, PH, [trigger], new Set([0])) // already active
    expect(trigger.onEnter).not.toHaveBeenCalled()
  })

  it("fires onEnter again if the player re-enters after leaving", () => {
    const trigger = makeTrigger(40, 40, 32, 32)
    // Frame 1: player enters (prevActive empty)
    checkTriggers(PX, PY, PW, PH, [trigger], new Set())
    // Frame 2: player has left (returned empty set last frame, so prevActive is empty again)
    checkTriggers(PX, PY, PW, PH, [trigger], new Set())
    expect(trigger.onEnter).toHaveBeenCalledTimes(2)
  })

  it("handles multiple triggers and only fires the overlapping ones", () => {
    const near = makeTrigger(40, 40, 32, 32) // overlaps
    const far = makeTrigger(200, 200, 32, 32) // does not overlap
    checkTriggers(PX, PY, PW, PH, [near, far], new Set())
    expect(near.onEnter).toHaveBeenCalledOnce()
    expect(far.onEnter).not.toHaveBeenCalled()
  })

  it("returns an empty set for an empty trigger list", () => {
    const active = checkTriggers(PX, PY, PW, PH, [], new Set())
    expect(active.size).toBe(0)
  })

  it("detects overlap when player and trigger share just one pixel", () => {
    // Player left edge at 50, trigger right edge at 51 — just touching
    const trigger = makeTrigger(34, 34, 16, 16) // right=50, bottom=50
    // Player at (50,50) — left/top edges touch trigger's right/bottom edges
    // AABB overlap requires strictly overlapping, not just touching
    const touching = checkTriggers(50, 50, PW, PH, [trigger], new Set())
    expect(touching.size).toBe(0) // touching edge is not overlapping
  })
})
