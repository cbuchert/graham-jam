# Scene Editor Spec

> Dev-only tile map authoring tool · Hono API server · TypeScript frontend · Part of the JRPG repo, not the game build

---


C4 architecture diagrams (system context, container, and component levels) live in [ARCHITECTURE.md](../ARCHITECTURE.md). Full rationale for structural decisions is in `documents/decisions/`.

---

## Goal

A browser-based tool for painting tile maps and placing spawn points, saving them directly to TypeScript scene source files. Replaces hand-editing 2D arrays and tile coordinates. Runs alongside the Vite dev server only — never ships with the game.

---

## Architecture

### Frontend

A dedicated Vite page at `/editor` — a separate entry point, not attached to the game. Owns its own HTML, its own TypeScript, and its own canvas-based UI. The game and the editor share no runtime code.

### Backend

A standalone Hono server running on a separate port (e.g. `localhost:3001`). Started independently from the Vite dev server. The editor frontend points its fetch calls at the Hono server via an env variable (`VITE_API_URL`). Dev only — not part of the game build or the Vite config.

### Dependency direction

```
Editor frontend → Hono API server (localhost:3001) → src/scenes/*.ts files
                                                    → src/world/worldGraph.ts
```

The editor has no import relationship with the game. It communicates only through the API. The game has no knowledge of the editor.

---

## API

All routes are mounted at the root of the Hono server. The server runs in dev only — it is never deployed.

| Method | Route | Description |
|---|---|---|
| GET | `/api/scenes` | Reads `worldGraph.ts` and returns all registered scene names |
| GET | `/api/scene/:name` | Reads the scene file, parses tile array and spawn points from between the markers, returns JSON |
| POST | `/api/scene/:name` | Replaces tile array and spawn points between the markers, writes the file back |
| POST | `/api/scene/:name/create` | Scaffolds a new scene file with empty tile array, empty spawn points, and markers — errors if file already exists; registers the scene name in `worldGraph.ts` |

---

## File Convention

Every scene file that participates in the editor must contain a clearly marked block. The backend reads and writes only what is between the markers — everything else in the file (imports, entity lists, trigger lists, comments) is untouched.

```
// @scene-editor:start
// @scene-editor:end
```

This is a convention, not a parser. The markers are the contract between the editor and the source file. Scene files without the markers are invisible to the editor. Adding the markers to an existing scene file opts it in.

The editor-managed block contains two things: the tile array and the spawn point map. Everything else is hand-authored.

**New scene scaffold** — when the create endpoint scaffolds a new file, it writes a minimal TypeScript file with the markers in place, an empty tile array, and an empty spawn point map. The developer fills in imports, entities, and triggers by hand afterward. The create endpoint also registers the new scene name in `worldGraph.ts`.

---

## Tile Palette

Tile definitions are the one thing shared between the editor and the game. They live in `src/world/tileDefinitions.ts` — a pure data module with no rendering or game logic — and are imported by both sides.

The editor imports tile definitions to populate the palette and label tiles on the grid. The game imports them for collision detection and tilemap rendering. Adding a new tile type means updating `tileDefinitions.ts` once; both sides pick it up automatically.

Each definition carries: `{ id, name, solid, editorColour }`. The `editorColour` field is editor-only metadata — the game ignores it and uses the spritesheet instead.

| ID | Name | Solid | Editor colour |
|---|---|---|---|
| 0 | Grass | No | Green |
| 1 | Wall | Yes | Grey |
| 2 | Water | Yes | Blue |
| 3 | Door | No | Brown |
| 4 | Chest | No | Yellow |

---

## Spawn Points

Spawn points are named tile coordinates within a scene. They are placed in the editor and referenced by door triggers in other scenes.

- Spawn point names are strings local to the scene (e.g. `entrance`, `fromDungeon`)
- A spawn point is a tile coordinate `{ x, y }` with a name
- Multiple spawn points per scene are supported
- Renaming or moving a spawn point in the editor updates the scene file; door triggers in other scenes that reference the old name become stale — this is a manual consistency responsibility for now

---

## UI

- **Scene selector** — dropdown populated from `GET /api/scenes`; scene names sourced from `worldGraph.ts`
- **New scene button** — prompts for name and grid dimensions (width × height in tiles), calls create endpoint, then loads the new scene
- **Mode toggle** — switch between Paint mode (tile palette) and Spawn mode (spawn point placement)
- **Tile palette** — visible in Paint mode; click a tile type to make it active
- **Spawn point panel** — visible in Spawn mode; list of named spawn points with add, rename, and delete; click a spawn point name to place it on the grid
- **Canvas grid** — in Paint mode: click or drag to paint the active tile type; in Spawn mode: click to place the selected spawn point marker
- **Load button** — explicit load from `GET /api/scene/:name`
- **Save button** — explicit save via `POST /api/scene/:name`; never auto-saves

---

## Decisions

| Decision | What we chose | Why |
|---|---|---|
| API framework | Hono, standalone server on `localhost:3001` | See [ADR 0006](decisions/0006-hono-editor-api-testability.md) |
| Backend integration | Standalone Hono server, not a Vite plugin | See [ADR 0006](decisions/0006-hono-editor-api-testability.md) |
| Scene name source | `worldGraph.ts` — not a filesystem scan | Scene names are a string union type in the world graph; the editor must stay in sync with that type. Scanning the filesystem would find files that aren't registered scenes. |
| New scene registration | Create endpoint writes to both the scene file and `worldGraph.ts` | A scene file without a world graph entry is unreachable in the game — both must be updated together |
| Marker convention | `@scene-editor:start / end` wraps both tile array and spawn points | See [ADR 0003](decisions/0003-editor-game-contract-marker-blocks.md) |
| Save behaviour | Explicit save button only | Auto-save risks writing a half-painted map; explicit save keeps the developer in control |
| Create guard | Error if file already exists | Prevents silently overwriting a scene that has hand-authored entity and trigger data below the markers |
| Grid dimensions | Set at create time, fixed for the life of the scene | Resizing a tile map mid-authoring is a separate problem; out of scope for now |
| Spawn point naming | Free-text string, local to the scene | Names are self-documenting; no global registry needed |
| Stale link detection | Not implemented — manual responsibility | Detecting broken spawn point references across scene files requires parsing all door triggers; out of scope for the editor's first version |
| Shared code with game | `src/world/tileDefinitions.ts` only | See [ADR 0004](decisions/0004-single-shared-module-boundary.md) |

---

## Out of Scope (for now)

- Entity and trigger placement — tiles and spawn points only
- Undo / redo
- Zoom
- Multi-layer maps
- Stale spawn point link detection
- Running outside of dev mode

---

## Build Order & Milestones

Each milestone ends with something **usably working**. Ship the milestone before starting the next one.

---

### Milestone 1 — Hono Server Scaffold
**Done when:** The API server starts, responds to a health check, and the editor frontend can reach it.

- [x] Hono server boots on `localhost:3001`
- [x] `GET /api/health` returns 200 — confirms server is reachable from the frontend
- [x] `VITE_API_URL` env variable wired into the editor frontend build
- [x] Server start script added to `package.json` — one command to run alongside `vite dev`
- [x] CORS configured for `localhost:5173` (Vite dev origin)

---

### Milestone 2 — Scene File API
**Done when:** The server can list, load, and save scene files via the marker convention.

#### 2.1 List Scenes
- [x] `GET /api/scenes` reads `src/world/worldGraph.ts` and returns all registered `SceneName` values as a JSON array
- [x] Returns an empty array (not an error) if no scenes are registered yet

#### 2.2 Load Scene
- [x] `GET /api/scene/:name` reads the named file from `src/scenes/`
- [x] Parses tile array and spawn points from between `// @scene-editor:start` and `// @scene-editor:end`
- [x] Returns `{ tiles: number[][], spawnPoints: Record<string, { x: number, y: number }> }` as JSON
- [x] Returns 404 if the file does not exist
- [x] Returns 400 if the file exists but has no markers

#### 2.3 Save Scene
- [x] `POST /api/scene/:name` accepts `{ tiles, spawnPoints }` as JSON
- [x] Replaces content between markers in the scene file — everything outside the markers is untouched
- [x] Returns 404 if the file does not exist
- [x] Returns 400 if the file has no markers

---

### Milestone 3 — Create Scene
**Done when:** A new scene file can be scaffolded and immediately loaded in the editor.

- [x] `POST /api/scene/:name/create` accepts `{ width: number, height: number }` as JSON
- [x] Scaffolds a new `.ts` file in `src/scenes/` with markers, empty tile array (all zeros), and empty spawn points
- [x] Registers the new scene name in `src/world/worldGraph.ts` — both the `SceneName` union and the factory registry
- [x] Returns 409 if the file already exists
- [x] New scene is immediately visible in `GET /api/scenes`

---

### Milestone 4 — Canvas Grid & Tile Palette
**Done when:** A developer can load a scene, paint tiles, and save back to the source file.

#### 4.1 Editor Page
- [x] Vite entry point at `/editor` — separate from the game's `index.html`
- [x] Scene selector dropdown populated from `GET /api/scenes`
- [x] Load button calls `GET /api/scene/:name` and populates the grid
- [x] Save button calls `POST /api/scene/:name` with current grid state — explicit, never auto-saves
- [x] Unsaved changes indicator — warns if navigating away or switching scenes with unsaved work

#### 4.2 Tile Palette
- [x] Palette populated from `src/world/tileDefinitions.ts` — no hardcoded tile list in the editor
- [x] Active tile highlighted on click
- [x] Tile name and solid/walkable flag shown on hover

#### 4.3 Canvas Grid — Paint Mode
- [x] Grid rendered to canvas — each cell sized to fit the viewport comfortably
- [x] Tile cells filled with `editorColour` from tile definitions
- [x] Click to paint active tile type
- [x] Click and drag to paint continuously
- [x] Grid dimensions match the loaded scene; grid resizes on load

---

### Milestone 5 — Spawn Point Placement
**Done when:** A developer can place, name, rename, and delete spawn points on the grid.

#### 5.1 Mode Toggle
- [x] Toggle between Paint mode and Spawn mode in the editor UI
- [x] Canvas grid behaviour changes based on active mode — no accidental tile painting while placing spawn points

#### 5.2 Spawn Point Panel
- [x] Lists all spawn points for the loaded scene by name
- [x] Add button — prompts for a name, creates a new spawn point awaiting placement
- [x] Rename — inline edit of spawn point name
- [x] Delete — removes spawn point from the list and the grid
- [x] Selected spawn point highlighted in the panel and on the grid

#### 5.3 Spawn Point Grid Placement
- [x] In Spawn mode, clicking a grid cell places the selected spawn point at that tile coordinate
- [x] Spawn points rendered as named markers on the grid — distinct from tile colours
- [x] A spawn point can be moved by selecting it in the panel and clicking a new cell
- [x] Spawn points saved as part of `POST /api/scene/:name`

---

### Milestone 6 — New Scene Dialog
**Done when:** A developer can create a new scene from within the editor without touching the filesystem manually.

- [x] New scene button opens a dialog prompting for scene name and grid dimensions (width × height in tiles)
- [x] Name validated against existing scene names — error if already taken
- [x] Calls `POST /api/scene/:name/create` on confirm
- [x] Editor loads the new scene immediately after creation
- [x] New scene appears in the scene selector dropdown

---

### Milestone 7 — Resize Scene
**Done when:** A developer can change the dimensions of a loaded scene's tile grid and save the result.

- [x] Resize button in toolbar — only enabled when a scene is loaded
- [x] Dialog prompts for new width and height (pre-filled with current dimensions)
- [x] Expanding: new rows/columns filled with tile 0 (Grass)
- [x] Shrinking: excess rows/columns truncated
- [x] Spawn points outside the new bounds are removed
- [x] Grid resizes immediately on confirm — marks scene dirty
- [x] No new API route — uses existing `POST /api/scene/:name` to save

---

## Progress Tracker

| Milestone | Status |
|---|---|
| 1 — Hono Server Scaffold | ✅ Done |
| 2 — Scene File API | ✅ Done |
| 3 — Create Scene | ✅ Done |
| 4 — Canvas Grid & Tile Palette | ✅ Done |
| 5 — Spawn Point Placement | ✅ Done |
| 6 — New Scene Dialog | ✅ Done |
| 7 — Resize Scene | ✅ Done |

Update statuses: ⬜ Not started · 🟡 In progress · ✅ Done
