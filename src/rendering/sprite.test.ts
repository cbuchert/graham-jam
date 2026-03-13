import { describe, expect, it } from "vitest"
import {
  type AnimationState,
  advanceAnimation,
  FRAME_DURATION,
  WALK_CYCLE,
} from "./sprite"

const base: AnimationState = { frame: 0, accumulator: 0 }

describe("advanceAnimation", () => {
  it("does not advance the frame when accumulated time is below the threshold", () => {
    const next = advanceAnimation(base, FRAME_DURATION * 0.5, 4)
    expect(next.frame).toBe(0)
  })

  it("advances the frame when accumulated time meets the threshold", () => {
    const next = advanceAnimation(base, FRAME_DURATION, 4)
    expect(next.frame).toBe(1)
  })

  it("wraps the frame back to 0 when it reaches frameCount", () => {
    const atLastFrame: AnimationState = { frame: 3, accumulator: 0 }
    const next = advanceAnimation(atLastFrame, FRAME_DURATION, 4)
    expect(next.frame).toBe(0)
  })

  it("carries over the remainder rather than resetting accumulator to zero", () => {
    // Advance by 1.5× the frame duration — frame ticks once, ~0.5× carries over
    const next = advanceAnimation(base, FRAME_DURATION * 1.5, 4)
    expect(next.accumulator).toBeCloseTo(FRAME_DURATION * 0.5)
  })

  it("accumulates time when below the threshold", () => {
    const half = FRAME_DURATION * 0.5
    const next = advanceAnimation(base, half, 4)
    expect(next.accumulator).toBeCloseTo(half)
  })

  it("returns a new object, not the same reference", () => {
    const next = advanceAnimation(base, FRAME_DURATION * 0.1, 4)
    expect(next).not.toBe(base)
  })

  it("does not mutate the input state", () => {
    const frozen = Object.freeze({ frame: 0, accumulator: 0 })
    expect(() => advanceAnimation(frozen, FRAME_DURATION, 4)).not.toThrow()
  })
})

describe("WALK_CYCLE", () => {
  const directions = ["down", "left", "right", "up"] as const

  it("defines an entry for every direction", () => {
    for (const dir of directions) {
      expect(WALK_CYCLE[dir]).toBeDefined()
    }
  })

  it("gives each direction a unique spritesheet row", () => {
    const rows = directions.map((d) => WALK_CYCLE[d].row)
    const unique = new Set(rows)
    expect(unique.size).toBe(directions.length)
  })

  it("gives every direction at least one frame", () => {
    for (const dir of directions) {
      expect(WALK_CYCLE[dir].frameCount).toBeGreaterThanOrEqual(1)
    }
  })
})
