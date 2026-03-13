// Shared between the game and the map editor.
// This module is the single crossing point between the two systems — see ADR 0004.
//
// Tile definitions: the game uses sheetX/sheetY for rendering; the editor uses editorColour.
// Spawn point types: used by both the game (world layer) and the editor (sceneParser).

export interface TileDef {
  id: number
  name: string
  solid: boolean
  editorColour: string
}

export const TILE_DEFS: readonly TileDef[] = [
  { id: 0, name: "Grass", solid: false, editorColour: "#4a7c3f" },
  { id: 1, name: "Wall", solid: true, editorColour: "#5a5a5a" },
  { id: 2, name: "Water", solid: true, editorColour: "#3a6bc4" },
  { id: 3, name: "Door", solid: false, editorColour: "#8b5e3c" },
  { id: 4, name: "Chest", solid: false, editorColour: "#c8a820" },
]

export const TILE_DEF_MAP: Readonly<Record<number, TileDef>> =
  Object.fromEntries(TILE_DEFS.map((def) => [def.id, def]))

// Named tile coordinate within a scene. Used to position the player on arrival.
export interface SpawnPoint {
  x: number
  y: number
}

// All spawn points for a map, keyed by local name (e.g. "entrance", "fromDungeon").
export type SpawnPoints = Record<string, SpawnPoint>
