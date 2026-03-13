/**
 * Overworld scene configs and trigger builders.
 * Each scene (town, interior) has a config; factories in worldGraph use these.
 */
import {
  addItem,
  derivedStats,
  removeItem,
} from "../jrpg/inventory"
import { ITEM_REGISTRY } from "../jrpg/items"
import { applyXp } from "../jrpg/stats"
import type { Tilemap } from "../rendering/tilemap"

const TILE_SIZE = 32
import type { SpawnPoints } from "../world/tiles"
import type { SceneName } from "../world/worldGraph"
import type { Trigger } from "../world/trigger"
import { INTERIOR_MAP, SPAWN_POINTS as INTERIOR_SPAWN_POINTS } from "../world/maps/interior"
import { SPAWN_POINTS as TOWN_SPAWN_POINTS, TOWN_MAP } from "../world/maps/town"
import type { BattleConsumable, BattleOutcome } from "./BattleScene"
import type { OverworldScene } from "./OverworldScene"
import { createDialogue } from "../jrpg/dialogue"
import type { PlayerStats } from "../jrpg/stats"

export interface OverworldSceneConfig {
  map: Tilemap
  spawnPoints: SpawnPoints
  getTriggers: (scene: OverworldScene) => Trigger[]
  npcs?: readonly { tileX: number; tileY: number; color: string; speaker: string; dialogue: readonly string[] }[]
  chest?: { tileX: number; tileY: number }
}

export const TOWN_CONFIG: OverworldSceneConfig = {
  map: TOWN_MAP,
  spawnPoints: TOWN_SPAWN_POINTS,
  getTriggers: (scene) => [
    // Battle encounter zone
    {
      x: 10 * TILE_SIZE,
      y: 10 * TILE_SIZE,
      width: 6 * TILE_SIZE,
      height: 2 * TILE_SIZE,
      type: "zone",
      onEnter: () => {
        const effective = derivedStats(
          scene.getPlayerStats(),
          scene.getInventory(),
          ITEM_REGISTRY,
        )
        const consumables: BattleConsumable[] = Object.entries(
          scene.getInventory().items,
        )
          .filter(
            ([id, qty]) =>
              qty > 0 && ITEM_REGISTRY[id]?.type === "consumable",
          )
          .map(([id, qty]) => {
            const item = ITEM_REGISTRY[id]
            return {
              name: item?.name ?? id,
              qty,
              description:
                item?.type === "consumable" ? item.description : "",
            }
          })
        scene.pushBattleScene(
          effective,
          consumables,
          (outcome: BattleOutcome, partial: PlayerStats, consumablesUsed: number) => {
          let inv = scene.getInventory()
          for (let i = 0; i < consumablesUsed; i++) {
            try {
              inv = removeItem(inv, "potion")
            } catch {
              break
            }
          }
          scene.setInventory(inv)
          if (outcome === "victory") {
            scene.setPlayerStats(
              applyXp(
                { ...scene.getPlayerStats(), hp: partial.hp },
                partial.xp,
              ),
            )
          } else {
            scene.setPlayerStats({ ...scene.getPlayerStats(), hp: partial.hp })
          }
        },
        )
      },
    },
    // Chest
    {
      x: 8 * TILE_SIZE,
      y: 7 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      type: "zone",
      onEnter: () => {
        if (scene.getChestCollected()) return
        scene.setChestCollected(true)
        scene.setInventory(addItem(scene.getInventory(), "potion"))
        scene.setDialogue(createDialogue(["You found a Potion!"], "Chest"))
      },
    },
    // Door to interior — building entrance at (8, 9)
    {
      x: 8 * TILE_SIZE,
      y: 9 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      type: "door",
      toScene: "interior" as SceneName,
      toSpawn: "entrance",
    },
  ],
  npcs: [
    {
      tileX: 15,
      tileY: 8,
      color: "#e8a838",
      speaker: "Villager",
      dialogue: [
        "Hey there, adventurer!",
        "Watch out for the tall grass to the east.",
        "Wild creatures lurk there...",
      ],
    },
  ],
  chest: { tileX: 8, tileY: 7 },
}

export const INTERIOR_CONFIG: OverworldSceneConfig = {
  map: INTERIOR_MAP,
  spawnPoints: INTERIOR_SPAWN_POINTS,
  getTriggers: () => [
    // Door back to town — bottom center tile (2, 4)
    {
      x: 2 * TILE_SIZE,
      y: 4 * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      type: "door",
      toScene: "town" as SceneName,
      toSpawn: "fromInterior",
    },
  ],
}
