// Shared between the game and the scene editor.
// The game uses sheetX/sheetY for sprite rendering and ignores editorColour.
// The editor uses editorColour for the canvas grid and ignores sheet coords.

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
