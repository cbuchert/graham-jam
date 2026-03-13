import { describe, expect, it } from "vitest"
import { type GameState, update } from "./loop"

const baseState: GameState = { time: 0 }

describe("update", () => {
  it("advances time by dt", () => {
    const next = update(baseState, 0.016)
    expect(next.time).toBeCloseTo(0.016)
  })

  it("caps dt at 50ms (0.05s) when the tab was backgrounded", () => {
    // A 500ms gap would normally explode physics; it must be clamped to 0.05
    const next = update(baseState, 0.5)
    expect(next.time).toBeCloseTo(0.05)
  })

  it("does not mutate the input state", () => {
    const frozen = Object.freeze({ time: 1.0 })
    expect(() => update(frozen, 0.016)).not.toThrow()
  })

  it("returns a new object, not the same reference", () => {
    const next = update(baseState, 0.016)
    expect(next).not.toBe(baseState)
  })

  it("accumulates time correctly across multiple ticks", () => {
    const s1 = update(baseState, 0.016)
    const s2 = update(s1, 0.016)
    const s3 = update(s2, 0.016)
    expect(s3.time).toBeCloseTo(0.048)
  })
})
