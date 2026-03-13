import { describe, expect, it } from "vitest"
import { createInputState, isActionDown, isDown, keyDown, keyUp } from "./input"

describe("createInputState", () => {
  it("starts with no keys held", () => {
    const state = createInputState()
    expect(state.heldKeys.size).toBe(0)
  })
})

describe("keyDown", () => {
  it("adds the key to heldKeys", () => {
    const state = keyDown(createInputState(), "ArrowUp")
    expect(state.heldKeys.has("ArrowUp")).toBe(true)
  })

  it("returns a new object, not the same reference", () => {
    const before = createInputState()
    const after = keyDown(before, "ArrowUp")
    expect(after).not.toBe(before)
  })

  it("does not mutate the input state", () => {
    const before = createInputState()
    keyDown(before, "ArrowUp")
    expect(before.heldKeys.size).toBe(0)
  })

  it("can hold multiple keys simultaneously", () => {
    const s1 = keyDown(createInputState(), "ArrowUp")
    const s2 = keyDown(s1, "ArrowLeft")
    expect(s2.heldKeys.has("ArrowUp")).toBe(true)
    expect(s2.heldKeys.has("ArrowLeft")).toBe(true)
  })
})

describe("keyUp", () => {
  it("removes the key from heldKeys", () => {
    const pressed = keyDown(createInputState(), "ArrowUp")
    const released = keyUp(pressed, "ArrowUp")
    expect(released.heldKeys.has("ArrowUp")).toBe(false)
  })

  it("returns a new object, not the same reference", () => {
    const pressed = keyDown(createInputState(), "ArrowUp")
    const released = keyUp(pressed, "ArrowUp")
    expect(released).not.toBe(pressed)
  })

  it("is a no-op for keys that were not held", () => {
    const state = createInputState()
    const after = keyUp(state, "ArrowUp")
    expect(after.heldKeys.size).toBe(0)
  })
})

describe("isDown", () => {
  it("returns true when the key is held", () => {
    const state = keyDown(createInputState(), "KeyW")
    expect(isDown(state, "KeyW")).toBe(true)
  })

  it("returns false when the key is not held", () => {
    expect(isDown(createInputState(), "KeyW")).toBe(false)
  })
})

describe("isActionDown", () => {
  it("returns true for 'up' when ArrowUp is held", () => {
    const state = keyDown(createInputState(), "ArrowUp")
    expect(isActionDown(state, "up")).toBe(true)
  })

  it("returns true for 'up' when KeyW is held (WASD alias)", () => {
    const state = keyDown(createInputState(), "KeyW")
    expect(isActionDown(state, "up")).toBe(true)
  })

  it("returns true for 'confirm' when Enter is held", () => {
    const state = keyDown(createInputState(), "Enter")
    expect(isActionDown(state, "confirm")).toBe(true)
  })

  it("returns true for 'confirm' when KeyZ is held", () => {
    const state = keyDown(createInputState(), "KeyZ")
    expect(isActionDown(state, "confirm")).toBe(true)
  })

  it("returns true for 'cancel' when Escape is held", () => {
    const state = keyDown(createInputState(), "Escape")
    expect(isActionDown(state, "cancel")).toBe(true)
  })

  it("returns false when no bound key is held", () => {
    expect(isActionDown(createInputState(), "up")).toBe(false)
  })
})
