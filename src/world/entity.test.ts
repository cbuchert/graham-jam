import { describe, expect, it, vi } from "vitest"
import { createInputState } from "../engine/input"
import { type Entity, updateEntities } from "./entity"

const input = createInputState()

describe("updateEntities", () => {
  it("calls update on an entity that has one", () => {
    const update = vi.fn()
    const entity: Entity = { x: 0, y: 0, width: 32, height: 32, update }
    updateEntities([entity], 0.016, input)
    expect(update).toHaveBeenCalledOnce()
  })

  it("passes dt and input to the entity update function", () => {
    const update = vi.fn()
    const entity: Entity = { x: 0, y: 0, width: 32, height: 32, update }
    updateEntities([entity], 0.016, input)
    expect(update).toHaveBeenCalledWith(0.016, input)
  })

  it("does not crash for entities without an update function", () => {
    const entity: Entity = { x: 0, y: 0, width: 32, height: 32 }
    expect(() => updateEntities([entity], 0.016, input)).not.toThrow()
  })

  it("calls update on every entity in the list", () => {
    const updateA = vi.fn()
    const updateB = vi.fn()
    const entities: Entity[] = [
      { x: 0, y: 0, width: 32, height: 32, update: updateA },
      { x: 32, y: 0, width: 32, height: 32, update: updateB },
    ]
    updateEntities(entities, 0.016, input)
    expect(updateA).toHaveBeenCalledOnce()
    expect(updateB).toHaveBeenCalledOnce()
  })

  it("handles an empty entity list without crashing", () => {
    expect(() => updateEntities([], 0.016, input)).not.toThrow()
  })
})
