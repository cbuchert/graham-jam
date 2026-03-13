import type { PlayerStats } from "./stats"

export interface EquipmentItem {
  id: string
  name: string
  type: "equipment"
  slot: "weapon" | "armour" | "accessory"
  /** Stat changes granted while this item is equipped. */
  statDeltas: Partial<{ attack: number; defense: number; maxHp: number }>
}

export interface ConsumableItem {
  id: string
  name: string
  type: "consumable"
  /** One-line display summary shown in menus, e.g. "Restore 30 HP". */
  description: string
  /** Pure function — given current stats, returns updated stats after use. */
  effect: (stats: PlayerStats) => PlayerStats
}

export type Item = EquipmentItem | ConsumableItem

/** Read-only map of item ID → definition. Never mutated at runtime. */
export type ItemRegistry = Readonly<Record<string, Item>>

export const ITEM_REGISTRY: ItemRegistry = {
  potion: {
    id: "potion",
    name: "Potion",
    type: "consumable",
    description: "Restore 30 HP",
    // Heals 30 HP, capped at maxHp.
    effect: (stats) => ({ ...stats, hp: Math.min(stats.hp + 30, stats.maxHp) }),
  },
  "iron-sword": {
    id: "iron-sword",
    name: "Iron Sword",
    type: "equipment",
    slot: "weapon",
    statDeltas: { attack: 5 },
  },
  "leather-armour": {
    id: "leather-armour",
    name: "Leather Armour",
    type: "equipment",
    slot: "armour",
    statDeltas: { defense: 3 },
  },
}
