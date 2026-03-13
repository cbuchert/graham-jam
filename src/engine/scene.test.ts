import { describe, expect, it, vi } from "vitest"
import {
  activeScene,
  createSceneManagerState,
  pop,
  push,
  replace,
  type Scene,
} from "./scene"

function mockScene(overrides: Partial<Scene> = {}): Scene {
  return {
    update: vi.fn(),
    render: vi.fn(),
    onEnter: vi.fn(),
    onExit: vi.fn(),
    ...overrides,
  }
}

describe("createSceneManagerState", () => {
  it("starts with an empty stack", () => {
    const state = createSceneManagerState()
    expect(state.stack).toHaveLength(0)
  })
})

describe("activeScene", () => {
  it("returns undefined when the stack is empty", () => {
    expect(activeScene(createSceneManagerState())).toBeUndefined()
  })

  it("returns the topmost scene", () => {
    const a = mockScene()
    const b = mockScene()
    const state = push(push(createSceneManagerState(), a), b)
    expect(activeScene(state)).toBe(b)
  })
})

describe("push", () => {
  it("adds the scene to the top of the stack", () => {
    const scene = mockScene()
    const state = push(createSceneManagerState(), scene)
    expect(state.stack).toHaveLength(1)
    expect(state.stack[0]).toBe(scene)
  })

  it("calls onEnter on the pushed scene", () => {
    const scene = mockScene()
    push(createSceneManagerState(), scene)
    expect(scene.onEnter).toHaveBeenCalledOnce()
  })

  it("returns a new object, not the same reference", () => {
    const before = createSceneManagerState()
    const after = push(before, mockScene())
    expect(after).not.toBe(before)
  })

  it("does not mutate the input state", () => {
    const before = createSceneManagerState()
    push(before, mockScene())
    expect(before.stack).toHaveLength(0)
  })

  it("preserves scenes already on the stack", () => {
    const a = mockScene()
    const b = mockScene()
    const state = push(push(createSceneManagerState(), a), b)
    expect(state.stack).toHaveLength(2)
    expect(state.stack[0]).toBe(a)
  })

  it("works when onEnter is not defined", () => {
    const scene = mockScene({ onEnter: undefined })
    expect(() => push(createSceneManagerState(), scene)).not.toThrow()
  })
})

describe("pop", () => {
  it("removes the top scene from the stack", () => {
    const scene = mockScene()
    const after = pop(push(createSceneManagerState(), scene))
    expect(after.stack).toHaveLength(0)
  })

  it("calls onExit on the removed scene", () => {
    const scene = mockScene()
    pop(push(createSceneManagerState(), scene))
    expect(scene.onExit).toHaveBeenCalledOnce()
  })

  it("returns a new object, not the same reference", () => {
    const before = push(createSceneManagerState(), mockScene())
    const after = pop(before)
    expect(after).not.toBe(before)
  })

  it("preserves scenes below the top", () => {
    const a = mockScene()
    const b = mockScene()
    const after = pop(push(push(createSceneManagerState(), a), b))
    expect(after.stack).toHaveLength(1)
    expect(after.stack[0]).toBe(a)
  })

  it("does not crash when the stack is empty", () => {
    expect(() => pop(createSceneManagerState())).not.toThrow()
  })

  it("works when onExit is not defined", () => {
    const scene = mockScene({ onExit: undefined })
    expect(() => pop(push(createSceneManagerState(), scene))).not.toThrow()
  })
})

describe("replace", () => {
  it("swaps the top scene with the new scene", () => {
    const a = mockScene()
    const b = mockScene()
    const state = replace(push(createSceneManagerState(), a), b)
    expect(activeScene(state)).toBe(b)
    expect(state.stack).toHaveLength(1)
  })

  it("calls onExit on the scene being replaced", () => {
    const a = mockScene()
    replace(push(createSceneManagerState(), a), mockScene())
    expect(a.onExit).toHaveBeenCalledOnce()
  })

  it("calls onEnter on the incoming scene", () => {
    const b = mockScene()
    replace(push(createSceneManagerState(), mockScene()), b)
    expect(b.onEnter).toHaveBeenCalledOnce()
  })

  it("preserves scenes below the replaced scene", () => {
    const a = mockScene()
    const b = mockScene()
    const c = mockScene()
    const after = replace(push(push(createSceneManagerState(), a), b), c)
    expect(after.stack).toHaveLength(2)
    expect(after.stack[0]).toBe(a)
    expect(after.stack[1]).toBe(c)
  })
})
