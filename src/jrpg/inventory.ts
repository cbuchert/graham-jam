import type { ItemRegistry } from "./items"
import type { PlayerStats } from "./stats"

export interface EquipmentSlots {
  weapon: string | null
  armour: string | null
  accessory: string | null
}

export interface InventoryState {
  /** Item ID → quantity held (unequipped). */
  items: Readonly<Record<string, number>>
  equipped: EquipmentSlots
}

export function createInventory(): InventoryState {
  return {
    items: {},
    equipped: { weapon: null, armour: null, accessory: null },
  }
}

export function addItem(inv: InventoryState, itemId: string): InventoryState {
  return {
    ...inv,
    items: { ...inv.items, [itemId]: (inv.items[itemId] ?? 0) + 1 },
  }
}

export function removeItem(inv: InventoryState, itemId: string): InventoryState {
  const qty = inv.items[itemId] ?? 0
  if (qty <= 0) throw new Error(`Cannot remove "${itemId}": not in inventory`)
  const { [itemId]: _, ...rest } = inv.items
  const newItems = qty > 1 ? { ...rest, [itemId]: qty - 1 } : rest
  return { ...inv, items: newItems }
}

/**
 * Move an equipment item from the bag into the appropriate slot.
 * If the slot is already occupied, the displaced item returns to the bag.
 * No-ops if the item isn't in the registry as equipment, or isn't in the bag.
 */
export function equip(
  inv: InventoryState,
  itemId: string,
  registry: ItemRegistry,
): InventoryState {
  const item = registry[itemId]
  if (!item || item.type !== "equipment") return inv

  const qty = inv.items[itemId] ?? 0
  if (qty <= 0) return inv

  const { slot } = item
  const displaced = inv.equipped[slot]

  // Remove equipped item from bag.
  const { [itemId]: _, ...rest } = inv.items
  let newItems: Record<string, number> =
    qty > 1 ? { ...rest, [itemId]: qty - 1 } : { ...rest }

  // Return displaced item to bag if slot was occupied.
  if (displaced !== null) {
    newItems = { ...newItems, [displaced]: (newItems[displaced] ?? 0) + 1 }
  }

  return { ...inv, items: newItems, equipped: { ...inv.equipped, [slot]: itemId } }
}

/** Move an equipped item back into the bag. No-op if the slot is empty. */
export function unequip(
  inv: InventoryState,
  slot: keyof EquipmentSlots,
): InventoryState {
  const itemId = inv.equipped[slot]
  if (itemId === null) return inv
  return {
    ...inv,
    items: { ...inv.items, [itemId]: (inv.items[itemId] ?? 0) + 1 },
    equipped: { ...inv.equipped, [slot]: null },
  }
}

/**
 * Compute effective stats by stacking base stats with all equipped item deltas.
 * Never cached — call this whenever you need the real combat or display values.
 */
export function derivedStats(
  base: PlayerStats,
  inv: InventoryState,
  registry: ItemRegistry,
): PlayerStats {
  let attack = base.attack
  let defense = base.defense
  let maxHp = base.maxHp

  for (const itemId of Object.values(inv.equipped)) {
    if (itemId === null) continue
    const item = registry[itemId]
    if (item?.type === "equipment") {
      attack += item.statDeltas.attack ?? 0
      defense += item.statDeltas.defense ?? 0
      maxHp += item.statDeltas.maxHp ?? 0
    }
  }

  return { ...base, attack, defense, maxHp }
}
