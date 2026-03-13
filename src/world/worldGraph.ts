// Scene registry — the editor reads this file to populate the scene selector.
// To add a new scene: add its name to SCENE_NAMES and register a factory below.
// The create endpoint (POST /api/scene/:name/create) does both automatically.
//
// World graph is the single source of truth for valid scene names. Door triggers
// reference SceneName — invalid names are compile-time errors.

export type { SpawnPoint, SpawnPoints } from "./tiles"
import type { Scene } from "../engine/scene"
import type { SceneManager } from "../engine/scene"
import type { PlayerStats } from "../jrpg/stats"
import type { InventoryState } from "../jrpg/inventory"

export const SCENE_NAMES = ["town", "interior"] as const
export type SceneName = (typeof SCENE_NAMES)[number]

/** Context passed when transitioning between overworld scenes (e.g. door). */
export interface OverworldTransitionContext {
  playerStats: PlayerStats
  inventory: InventoryState
  chestCollected: boolean
}

/** Factory creates a scene given spawn point and optional context from previous scene. */
export type SceneFactory = (
  sceneManager: SceneManager,
  spawnPoint: string,
  context?: OverworldTransitionContext,
) => Scene

const registry: Record<SceneName, SceneFactory> = {} as Record<
  SceneName,
  SceneFactory
>

export function registerScene(name: SceneName, factory: SceneFactory): void {
  registry[name] = factory
}

export function createScene(
  name: SceneName,
  sceneManager: SceneManager,
  spawnPoint: string,
  context?: OverworldTransitionContext,
): Scene {
  const factory = registry[name]
  if (!factory) {
    throw new Error(`Unknown scene: ${name}. Register it in worldGraph.ts.`)
  }
  return factory(sceneManager, spawnPoint, context)
}

export function getSceneFactory(name: SceneName): SceneFactory {
  const factory = registry[name]
  if (!factory) {
    throw new Error(`Unknown scene: ${name}. Register it in worldGraph.ts.`)
  }
  return factory
}
