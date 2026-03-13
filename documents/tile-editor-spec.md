# Tiles Spec
> Shared tile abstraction · Single source of truth for terrain types, blob rules, and tilesheet coordinates · Authored by the tile editor tool

---

## Purpose

`src/world/tiles.ts` is the shared tile module. It is the single source of truth for everything terrain-related: what tile types exist, which are solid, how they blob-tile against neighbours, and where their variants live on the tilesheet.

Every system that works with tiles imports from here. Nothing hardcodes tile behaviour inline.

This spec covers two things:
1. The data contract for `src/world/tiles.ts` — what the file contains and what consumers can rely on
2. The tile editor tool — the browser-based tool that authors and owns the file

The tile editor is the only writer. The game, map editor, and any other consumer are readers.

---

## Consumers

| Consumer | Uses |
|---|---|
| Game renderer | `getTileById` — tilesheet coords, flip flags, blob rules for rendering |
| Game collision | `getTileById` — solid flag |
| Map editor palette | `TILE_REGISTRY` — tile list for the paint palette |
| Map editor renderer | `getTileById` — blob-aware tile rendering in the editor canvas |
| Tile editor | Reads and writes `tiles.ts` directly — owns the file |

---

## Data Model

### Types and interfaces

`TileType` is a string union of all valid terrain type identifiers. Adding a terrain type means adding it here first — everything else derives from it.

`BlobFrame` describes one resolved blob variant: a frame index into the tilesheet row, and two flip flags (`flipX`, `flipY`).

`BlobFrameSet` maps all 16 cardinal bitmask configurations (keys 0–15) to a `BlobFrame`. Every key must be present — a missing key is a data bug.

`SpriteCoords` is a grid-unit location on the spritesheet (column and row, not pixels). Multiply by tile size to get pixel coordinates.

`TileDefinition` is the complete record for one terrain type: numeric `id`, string `type`, display `name`, `solid` flag, full `frames` blob ruleset, and `baseCoords` pointing to the first frame for that type on the tilesheet.

### Bitmask convention

The blob ruleset uses a 4-bit cardinal bitmask. Bit 0 is north, bit 1 is east, bit 2 is south, bit 3 is west. A set bit means the neighbour shares the same terrain type. This produces 16 possible configurations (0–15).

### Registry

`TILE_REGISTRY` is a read-only array of `TileDefinition` ordered by `id`. It is the authoritative list of all terrain types at runtime.

`getTileById` is the one function all consumers call. It is an O(1) array-index lookup. It throws a descriptive error on an unknown `id` — a map array referencing an unknown tile id is always a data bug, not a fallback case.

---

## Spritesheet Layout

Fixed grid — one row per terrain type, frames packed left-to-right in frame slot order. Every frame is `SPRITE_TILE_SIZE` × `SPRITE_TILE_SIZE` pixels (16px — distinct from the game's world-grid `TILE_SIZE` of 32px).

`baseCoords` in `TileDefinition` points to the first frame for that terrain type. `frameIndex` in `BlobFrame` is the column offset from `baseCoords` within the row.

The spritesheet image at `src/assets/tilesheet.png` is generated and owned by the tile editor. It is never hand-edited.

---

## File Ownership

`src/world/tiles.ts` is written by the tile editor and read by everything else. Before the tile editor exists it is hand-authored, but it must conform to the data model. The tile editor round-trips whatever it finds in the file on first load.

---

## Initial Tile Types

| ID | Type | Name | Solid |
|---|---|---|---|
| 0 | `grass` | Grass | No |
| 1 | `wall` | Wall | Yes |
| 2 | `water` | Water | Yes |
| 3 | `road` | Road | No |

Door and Chest are sprites, not terrain tiles — out of scope for this module.

---

## Out of Scope

- Sprite definitions (player, NPCs, animated objects)
- Diagonal neighbour blob rules (8-neighbour bitmask)
- Animated terrain tiles
- Multiple spritesheets
- Tile variants beyond blob rules (random variation, seasonal swaps)

---

## Decisions

| Decision | What we chose | Why |
|---|---|---|
| Numeric IDs in map arrays | `number[][]` map format unchanged | The problem was scattered inline mappings, not the ID format itself |
| String `TileType` in code | `'grass'` not `0` in logic and type signatures | Human-readable, self-documenting, type-safe |
| Single shared module | `src/world/tiles.ts` replaces all inline tile lookups | One place to add a terrain type; consumers import, they don't duplicate |
| `getTileById` throws on unknown ID | Error, not a fallback tile | A map array referencing an unknown ID is a data bug — silent fallback hides it |
| Fixed grid tilesheet | One row per terrain type, frames left-to-right | Predictable coordinates; easy to debug; no bin-packing complexity |
| Cardinal-only blob ruleset | 4-neighbour bitmask, 16 configurations | ~13 unique frames per terrain type with mirroring; diagonal neighbours improve corner quality but triple the frame count |
| Mirroring in blob authoring | Tile editor assigns flip transforms at authoring time; renderer reads `flipX`/`flipY` at runtime | Renderer stays simple; mirroring complexity is authoring-time only |
| Tile editor owns the file | Only the tile editor writes `tiles.ts` and `src/assets/tilesheet.png` | Single writer, no merge conflicts, no drift between image and data |
| Shared Hono server | Tile editor routes added to the same server as the map editor | One process in dev; routes are additive and don't conflict |
| localStorage for pixel data | Working pixel data lives in localStorage, not files | File I/O on every brushstroke is wasteful; localStorage survives refresh |
| Explicit export only | Repo files update only on export button press | Prevents half-painted frames from breaking the game mid-session |
| LCH colour space | Primary input in LCH, converted to RGB at paint time | Perceptually uniform — adjusting lightness does not shift hue |
| Global used colours panel | Shared across all terrain types | Shared colours (outlines, shadows) should be one click away regardless of active terrain type |
| No fixed palette | Full LCH gamut | SNES aesthetic comes from authoring discipline, not a technical restriction |
| No undo | Omitted from paint mode | 16×16 frames are fast to repaint; undo adds implementation complexity for low jam value |
| Mirror helper in ruleset mode | Assign a config as mirror of another — auto-sets frame and flip | Reduces repetitive assignment; renderer stays simple |
| Full regeneration on export | Spritesheet always rebuilt from scratch | No partial update logic; localStorage pixel data is always the source of truth |
| `pngjs` for PNG export | Server-side PNG generation | Small, no native deps, runs cleanly in Node |
| Terrain type delete guard | Block delete if type is referenced in any map file | Prevents broken map references; scan is cheap against local files |

---

## Tile Editor Tool

The tile editor is the browser-based tool that authors and owns `tiles.ts` and `tilesheet.png`. It runs in dev only and never ships with the game.

---

### Architecture

**Frontend** — a dedicated Vite page at `/tile-editor`, separate from the game and the map editor. Owns its own HTML, TypeScript, and canvas UI.

**Backend** — routes added to the shared Hono server on `localhost:3001`. No new process.

**Persistence** — all pixel data (painted frames, working colour history) lives in localStorage between sessions. The Hono server is called only on explicit export. localStorage is the working state; the repo files are the published state.

Dependency direction: the frontend reads from localStorage and calls the Hono API on export. The Hono API reads and writes `src/world/tiles.ts` and `src/assets/tilesheet.png`. There is no direct frontend-to-filesystem path.

---

### Modes

**Paint mode** — paint individual 16×16 pixel variants. One variant active at a time, selected from the variant panel. Pencil tool only, no undo.

**Ruleset mode** — assign variants to the 16 cardinal blob configurations for the active terrain type. Includes flip toggles per configuration and a mirror helper that auto-assigns variant and flip flags from a selected source configuration.

---

### Colour System

LCH is the working colour space (L 0–100, C 0–150, H 0–360). Converted to RGB at paint time via a small utility — no external colour library. The used colours panel is a global swatch grid ordered by most recently used, shared across all terrain types, persisted in localStorage.

---

### Variant Panel

Each terrain type maintains a list of variant slots — the unique painted visual variants before mirroring. Approximately 13 unique variants are needed per terrain type. Variants can be added, deleted, and previewed via thumbnail. Deleting a variant clears any ruleset assignments that referenced it.

---

### Terrain Type Management

The tile editor is the authority on which terrain types exist. Adding or removing a terrain type here is the only way to change `TileType` in `tiles.ts`.

- Add — prompts for `type` string ID, display name, and solid flag; scaffolds empty frames and a blank ruleset
- Rename — updates `name` only; `type` string ID and numeric `id` are immutable after creation
- Delete — blocked if the type is referenced in any map file (detected via `GET /api/tiles/usage/:type`)

---

### API

All routes on the shared Hono server.

| Method | Route | Description |
|---|---|---|
| GET | `/api/tiles` | Reads `src/world/tiles.ts` and returns the full tile registry as JSON |
| POST | `/api/tiles/export` | Accepts tile registry + pixel data; writes `tiles.ts` and generates `src/assets/tilesheet.png` |
| GET | `/api/tiles/usage/:type` | Scans `src/world/maps/` and returns whether a terrain type is referenced — for delete guard |

---

### Spritesheet Generation

On export, the server receives all variant pixel data (RGBA arrays, 16×16 per variant) and the full tile registry, packs variants into the fixed grid, writes `src/assets/tilesheet.png` via `pngjs`, and writes updated `src/world/tiles.ts` with correct `baseCoords` and `frameIndex` values. Always regenerated from scratch — no partial updates.

---

### Out of Scope (tile editor)

- Sprite authoring (player, NPCs, animated objects)
- Animation frame sequencing
- Undo / redo
- Layer support
- Brush sizes beyond single pixel
- Diagonal neighbour blob rules
- Animated terrain tiles
- Importing existing PNG spritesheets
- Running outside of dev mode

---

## Search Patterns

| What you're looking for | Where to look |
|---|---|
| Tile type definitions and registry | `src/world/tiles.ts` |
| Tile editor Hono routes | `editor/server/app.ts` — search `/api/tiles` |
| Map editor routes (reference for adding tile routes alongside) | `editor/server/app.ts` — search `/api/scene` |
| Hono server entry point | `editor/server/index.ts` |
| Tile editor frontend entry | `tile-editor/index.html` and `tile-editor/main.ts` (created in Milestone 4) |
| Tilemap renderer consuming `getTileById` | `src/rendering/tilemap.ts` |
| Map editor consuming `TILE_REGISTRY` for the palette | `editor/main.ts` — search `TILE_REGISTRY` |
| `pngjs` usage | `editor/server/app.ts` — added in Milestone 3 |
| Spritesheet output | `src/assets/tilesheet.png` |

---

## Build Order & Milestones

Each milestone ends with something verifiably working. Ship the milestone before starting the next one.

---

### Milestone 1 — Define the Module ✅ Done

`src/world/tiles.ts` exists, exports all four terrain types with placeholder blob rulesets, and `getTileById` is tested and passing.

**Todos:**
- [x] `TileType`, `BlobFrame`, `BlobFrameSet`, `SpriteCoords`, `TileDefinition` interfaces defined
- [x] `TILE_REGISTRY` populated with all four initial terrain types
- [x] Placeholder blob rulesets — all 16 configurations covered, flip flags false
- [x] `getTileById` implemented; throws a descriptive error on unknown ID
- [x] `SPRITE_TILE_SIZE = 16` exported (distinct from game's `TILE_SIZE = 32`)
- [x] Tests: `getTileById(0)` returns Grass, unknown ID throws, all 16 configs present per type, correct solid flags

---

### Milestone 2 — Migrate the Game ✅ Done

No file outside `tiles.ts` hardcodes tile behaviour. `tileDefinitions.ts` is deleted.

**Todos:**
- [x] Audit every file hardcoding tile IDs, solid flags, or tile colours inline
- [x] Game tilemap renderer calls `getTileById` for tilesheet coords
- [x] Collision system calls `getTileById` for solid flag
- [x] Map editor palette reads from `TILE_REGISTRY`
- [x] Map editor renderer calls `getTileById` for tile colours
- [x] `tileDefinitions.ts` deleted; all imports updated
- [x] All existing tests still passing

---

### Milestone 3 — Tile Editor: Hono Routes & Export Scaffold ⬜ Not started

The tile editor API is reachable, can read `tiles.ts`, and can write a minimal tilesheet PNG.

**Todos:**
- [x] Tile editor routes added to the existing Hono server — no new process
- [x] `GET /api/tiles` reads `src/world/tiles.ts` and returns the tile registry as JSON
- [x] `POST /api/tiles/export` accepts tile registry + pixel data and writes `tiles.ts`
- [x] `pngjs` installed; proof-of-concept 16×16 PNG written to `src/assets/tilesheet.png` on export
- [x] `GET /api/tiles/usage/:type` scans `src/world/maps/` and returns in-use status
- [x] Tests: `GET /api/tiles` returns registry shape, `POST /api/tiles/export` writes files, `GET /api/tiles/usage/:type` detects in-use types (mock `node:fs/promises`, follow pattern in `editor/server/app.test.ts`)

---

### Milestone 4 — Tile Editor: Paint Mode ✅ Done

A developer can paint a 16×16 pixel variant, zoom in and out, and see it persist in localStorage on refresh.

**Todos:**
- [x] Vite entry point at `/tile-editor` — separate from game and map editor entry points
- [x] Terrain type sidebar populated from `GET /api/tiles`; click to switch active type
- [x] Variant panel — lists variants for active terrain type; click to make active
- [x] Add variant / delete variant buttons; thumbnails rendered from localStorage pixel data
- [x] 16×16 canvas at configurable zoom (default 16×, range 8×–32×)
- [x] Click and drag to paint active colour; grid overlay between pixels
- [x] Pixel data persisted in localStorage keyed by terrain type + variant index
- [x] LCH colour picker — L, C, H sliders, live preview, RGB readout
- [x] Used colours panel — global swatches, ordered by most recently used, persisted in localStorage

---

### Milestone 5 — Tile Editor: Terrain Type Management ✅ Done

A developer can add, rename, and delete terrain types from within the editor.

**Todos:**
- [x] Add terrain type — dialog for `type` string ID, display name, solid flag; scaffolds empty variants and blank ruleset
- [x] New terrain type added to `TileType` union and `TILE_REGISTRY` on next export
- [x] Rename display name — inline edit, `name` field only; `type` string ID and numeric `id` are immutable
- [x] Delete terrain type — calls `GET /api/tiles/usage/:type` first; blocked with error if in use
- [x] Confirmed delete — removes from localStorage and registry; reflected on next export

---

### Milestone 6 — Tile Editor: Ruleset Mode ✅ Done

A developer can assign variants to all 16 blob configurations for a terrain type, with mirror helpers.

**Todos:**
- [x] All 16 configurations displayed as neighbour diagrams (3×3 grid, centre = active terrain)
- [x] Each configuration shows assigned variant thumbnail; click to assign the active variant slot
- [x] Unassign button per configuration
- [x] `flipX` / `flipY` toggles per configuration; thumbnail reflects flip state
- [x] Mirror helper — "mirror of" dropdown auto-sets variant and flip flags from source configuration

---

### Milestone 7 — Tile Editor: Live Blob Preview ⬜ Not started

A developer can paint a small test grid and see blob rules resolve in real time.

**Todos:**
- [ ] Preview panel — small paintable grid (e.g. 8×8 tiles)
- [ ] Blob rules resolve automatically as tiles are painted — correct variant per cell based on cardinal neighbours
- [ ] Preview uses the same rendering logic as the game and map editor — no divergence
- [ ] Preview updates live as ruleset assignments change in Ruleset Mode

---

### Milestone 8 — Tile Editor: Export ⬜ Not started

A developer can export the full spritesheet and tile definitions to the repo in one click. This milestone completes the tile editor handoff — `tiles.ts` is fully owned by the tool.

**Todos:**
- [ ] Export button in toolbar
- [ ] Pre-export validation — all 16 configurations assigned per terrain type; unassigned configs listed as errors
- [ ] Calls `POST /api/tiles/export` with full pixel data and tile registry
- [ ] Server packs all variants into fixed-grid `src/assets/tilesheet.png` via `pngjs`
- [ ] Server writes updated `src/world/tiles.ts` with correct `baseCoords` and `frameIndex` values
- [ ] Round-trip test: read → no changes → export → diff confirms `tiles.ts` unchanged
- [ ] Export success and export error (with detail) shown in UI

---

## Progress Tracker

| Milestone | Status |
|---|---|
| 1 — Define the Module | ✅ Done |
| 2 — Migrate the Game | ✅ Done |
| 3 — Tile Editor: Hono Routes & Export Scaffold | ✅ Done |
| 4 — Tile Editor: Paint Mode | ✅ Done |
| 5 — Tile Editor: Terrain Type Management | ⬜ Not started |
| 6 — Tile Editor: Ruleset Mode | ⬜ Not started |
| 7 — Tile Editor: Live Blob Preview | ⬜ Not started |
| 8 — Tile Editor: Export | ⬜ Not started |

Update statuses: ⬜ Not started · 🟡 In progress · ✅ Done
