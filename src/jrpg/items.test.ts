import { describe, expect, it } from "vitest"
import { ITEM_REGISTRY } from "./items"
import { createPlayerStats } from "./stats"

describe("ITEM_REGISTRY", () => {
  it("contains a potion", () => {
    const item = ITEM_REGISTRY.potion
    expect(item).toBeDefined()
    expect(item?.type).toBe("consumable")
    expect(item?.name).toBe("Potion")
  })

  it("contains iron-sword as equipment", () => {
    const item = ITEM_REGISTRY["iron-sword"]
    expect(item).toBeDefined()
    expect(item?.type).toBe("equipment")
    if (item?.type === "equipment") {
      expect(item.slot).toBe("weapon")
      expect(item.statDeltas.attack).toBe(5)
    }
  })

  it("contains leather-armour as equipment", () => {
    const item = ITEM_REGISTRY["leather-armour"]
    expect(item).toBeDefined()
    expect(item?.type).toBe("equipment")
    if (item?.type === "equipment") {
      expect(item.slot).toBe("armour")
      expect(item.statDeltas.defense).toBe(3)
    }
  })

  it("returns undefined for unknown item ID", () => {
    expect(ITEM_REGISTRY["does-not-exist"]).toBeUndefined()
  })
})

describe("Potion effect", () => {
  it("heals 30 HP", () => {
    const stats = { ...createPlayerStats(), hp: 10 }
    const item = ITEM_REGISTRY.potion
    if (item?.type !== "consumable") throw new Error("expected consumable")
    const after = item.effect(stats)
    expect(after.hp).toBe(40)
  })

  it("does not overheal above maxHp", () => {
    const stats = { ...createPlayerStats(), hp: 45, maxHp: 50 }
    const item = ITEM_REGISTRY.potion
    if (item?.type !== "consumable") throw new Error("expected consumable")
    const after = item.effect(stats)
    expect(after.hp).toBe(50)
  })

  it("heals nothing when already at full HP", () => {
    const stats = createPlayerStats() // hp === maxHp === 50
    const item = ITEM_REGISTRY.potion
    if (item?.type !== "consumable") throw new Error("expected consumable")
    const after = item.effect(stats)
    expect(after.hp).toBe(50)
  })
})
