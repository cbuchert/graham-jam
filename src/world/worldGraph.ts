// Scene registry — the editor reads this file to populate the scene selector.
// To add a new scene: add its name to SCENE_NAMES and register a factory below.
// The create endpoint (POST /api/scene/:name/create) does both automatically.

export type { SpawnPoint, SpawnPoints } from "./tileDefinitions"

export const SCENE_NAMES = ["town"] as const
export type SceneName = (typeof SCENE_NAMES)[number]
