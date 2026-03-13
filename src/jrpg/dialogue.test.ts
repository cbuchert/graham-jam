import { describe, expect, it } from "vitest"
import { advanceDialogue, createDialogue, currentLine } from "./dialogue"

const LINES = ["Hello there!", "Watch your step.", "Good luck out there."]

describe("createDialogue", () => {
  it("starts at line 0", () => {
    const state = createDialogue(LINES)
    expect(state.currentLine).toBe(0)
  })

  it("stores the speaker when provided", () => {
    const state = createDialogue(LINES, "Villager")
    expect(state.speaker).toBe("Villager")
  })

  it("speaker is undefined when not provided", () => {
    const state = createDialogue(LINES)
    expect(state.speaker).toBeUndefined()
  })
})

describe("currentLine", () => {
  it("returns the first line at the start", () => {
    const state = createDialogue(LINES)
    expect(currentLine(state)).toBe("Hello there!")
  })

  it("returns the correct line after advancing", () => {
    const state = createDialogue(LINES)
    // biome-ignore lint/style/noNonNullAssertion: test asserts advance returns non-null
    const next = advanceDialogue(state)!
    expect(currentLine(next)).toBe("Watch your step.")
  })
})

describe("advanceDialogue", () => {
  it("moves to the next line", () => {
    const state = createDialogue(LINES)
    const next = advanceDialogue(state)
    expect(next?.currentLine).toBe(1)
  })

  it("returns null after the last line — dialogue is done", () => {
    const state = createDialogue(["Only line."])
    expect(advanceDialogue(state)).toBeNull()
  })

  it("returns null when advancing past the last of multiple lines", () => {
    const state = createDialogue(LINES)
    // biome-ignore lint/style/noNonNullAssertion: test asserts intermediate advances are non-null
    const s1 = advanceDialogue(state)!
    // biome-ignore lint/style/noNonNullAssertion: test asserts intermediate advances are non-null
    const s2 = advanceDialogue(s1)!
    const done = advanceDialogue(s2)
    expect(done).toBeNull()
  })

  it("preserves the speaker across advances", () => {
    const state = createDialogue(LINES, "Guard")
    // biome-ignore lint/style/noNonNullAssertion: test asserts advance returns non-null
    const next = advanceDialogue(state)!
    expect(next.speaker).toBe("Guard")
  })

  it("works with a single-line script", () => {
    const state = createDialogue(["One and done."])
    expect(currentLine(state)).toBe("One and done.")
    expect(advanceDialogue(state)).toBeNull()
  })
})
