import { describe, expect, it } from "vitest"
import { ITEM_REGISTRY } from "./items"
import {
  addItem,
  createInventory,
  derivedStats,
  equip,
  removeItem,
  unequip,
} from "./inventory"
import { createPlayerStats } from "./stats"

describe("createInventory", () => {
  it("starts with no items", () => {
    const inv = createInventory()
    expect(Object.keys(inv.items)).toHaveLength(0)
  })

  it("starts with all equipment slots empty", () => {
    const inv = createInventory()
    expect(inv.equipped.weapon).toBeNull()
    expect(inv.equipped.armour).toBeNull()
    expect(inv.equipped.accessory).toBeNull()
  })
})

describe("addItem", () => {
  it("creates a new entry with quantity 1", () => {
    const inv = addItem(createInventory(), "potion")
    expect(inv.items["potion"]).toBe(1)
  })

  it("increments an existing entry", () => {
    const inv = addItem(addItem(createInventory(), "potion"), "potion")
    expect(inv.items["potion"]).toBe(2)
  })
})

describe("removeItem", () => {
  it("decrements quantity", () => {
    const inv = removeItem(addItem(addItem(createInventory(), "potion"), "potion"), "potion")
    expect(inv.items["potion"]).toBe(1)
  })

  it("removes the key entirely when quantity reaches 0", () => {
    const inv = removeItem(addItem(createInventory(), "potion"), "potion")
    expect(inv.items["potion"]).toBeUndefined()
  })

  it("throws when item is not in inventory", () => {
    expect(() => removeItem(createInventory(), "potion")).toThrow()
  })
})

describe("equip", () => {
  it("moves item from bag into slot", () => {
    const inv = equip(addItem(createInventory(), "iron-sword"), "iron-sword", ITEM_REGISTRY)
    expect(inv.equipped.weapon).toBe("iron-sword")
    expect(inv.items["iron-sword"]).toBeUndefined()
  })

  it("returns unchanged inventory when item not in bag", () => {
    const inv = createInventory()
    const result = equip(inv, "iron-sword", ITEM_REGISTRY)
    expect(result).toEqual(inv)
  })

  it("returns unchanged inventory for unknown item ID", () => {
    const inv = addItem(createInventory(), "mythical-blade")
    const result = equip(inv, "mythical-blade", ITEM_REGISTRY)
    expect(result).toEqual(inv)
  })

  it("displaces the existing item back into bag when slot is occupied", () => {
    const base = addItem(addItem(createInventory(), "iron-sword"), "iron-sword")
    // Equip first copy
    const after1 = equip(base, "iron-sword", ITEM_REGISTRY)
    // Add a second weapon (pretend we had two swords)
    // Already have one in bag from the equip above — equip it
    const after2 = equip(after1, "iron-sword", ITEM_REGISTRY)
    // The displaced sword should be back in the bag
    expect(after2.equipped.weapon).toBe("iron-sword")
    expect(after2.items["iron-sword"]).toBe(1)
  })
})

describe("unequip", () => {
  it("moves equipped item back to bag", () => {
    const inv = equip(addItem(createInventory(), "leather-armour"), "leather-armour", ITEM_REGISTRY)
    const result = unequip(inv, "armour")
    expect(result.equipped.armour).toBeNull()
    expect(result.items["leather-armour"]).toBe(1)
  })

  it("is a no-op when slot is empty", () => {
    const inv = createInventory()
    const result = unequip(inv, "armour")
    expect(result).toEqual(inv)
  })
})

describe("derivedStats", () => {
  it("returns base stats when nothing is equipped", () => {
    const base = createPlayerStats()
    const result = derivedStats(base, createInventory(), ITEM_REGISTRY)
    expect(result).toEqual(base)
  })

  it("adds weapon attack delta", () => {
    const base = createPlayerStats()
    const inv = equip(addItem(createInventory(), "iron-sword"), "iron-sword", ITEM_REGISTRY)
    const result = derivedStats(base, inv, ITEM_REGISTRY)
    expect(result.attack).toBe(base.attack + 5)
  })

  it("adds armour defense delta", () => {
    const base = createPlayerStats()
    const inv = equip(addItem(createInventory(), "leather-armour"), "leather-armour", ITEM_REGISTRY)
    const result = derivedStats(base, inv, ITEM_REGISTRY)
    expect(result.defense).toBe(base.defense + 3)
  })

  it("stacks multiple equipment pieces", () => {
    const base = createPlayerStats()
    const inv = equip(
      equip(
        addItem(addItem(createInventory(), "iron-sword"), "leather-armour"),
        "iron-sword",
        ITEM_REGISTRY,
      ),
      "leather-armour",
      ITEM_REGISTRY,
    )
    const result = derivedStats(base, inv, ITEM_REGISTRY)
    expect(result.attack).toBe(base.attack + 5)
    expect(result.defense).toBe(base.defense + 3)
  })
})
