# Tiles Spec
> Shared tile abstraction · Single source of truth for terrain types, blob rules, and spritesheet coordinates · Authored by the tile editor tool

---

## Purpose

`src/world/tiles.ts` is the shared tile module. It is the single source of truth for everything terrain-related: what tile types exist, which are solid, how they blob-tile against neighbours, and where their variants live on the spritesheet.

Every system that works with tiles imports from here. Nothing hardcodes tile behaviour inline.

**This spec covers two things:**
1. The data contract for `src/world/tiles.ts` — what the file contains and what consumers can rely on
2. The tile editor tool — the browser-based tool that authors and owns the file

The tile editor is the only writer. The game, map editor, and any other consumer are readers.

---

## Consumers

| Consumer | Uses |
|---|---|
| Game renderer | `getTileById` — spritesheet coords, flip flags, blob rules for rendering |
| Game collision | `getTileById` — solid flag |
| Map editor palette | `TILE_REGISTRY` — tile list for the paint palette |
| Map editor renderer | `getTileById` — blob-aware tile rendering in the editor canvas |
| Tile editor | Reads and writes `tiles.ts` directly — owns the file |

---

## Data Model

### `TileType`

String union of all valid terrain type identifiers. Adding a terrain type means adding it here first — everything else derives from this.

```ts
type TileType = 'grass' | 'wall' | 'water' | 'road';
```

### `BlobFrame`

A single blob variant — one resolved configuration of the 16-value cardinal bitmask.

```ts
interface BlobFrame {
  frameIndex: number;  // index into the spritesheet grid
  flipX: boolean;      // mirror horizontally
  flipY: boolean;      // mirror vertically
}
```

### `BlobFrameSet`

The full cardinal blob ruleset for one terrain type. Maps each of the 16 possible cardinal neighbour configurations to a `BlobFrame`. The bitmask is a 4-bit value: bit 0 = north, bit 1 = east, bit 2 = south, bit 3 = west. A set bit means the neighbour is the same terrain type.

```ts
type BlobFrameSet = Record<number, BlobFrame>; // keys 0–15
```

### `SpriteCoords`

The location of a frame on the spritesheet, in grid units (not pixels). Multiply by tile size to get pixel coordinates.

```ts
interface SpriteCoords {
  col: number;
  row: number;
}
```

### `TileDefinition`

The complete record for one terrain type.

```ts
interface TileDefinition {
  id: number;          // numeric ID — used in map arrays
  type: TileType;      // string identifier — used in code
  name: string;        // display name — used in editor UI
  solid: boolean;      // true = impassable
  frames: BlobFrameSet;
  baseCoords: SpriteCoords;  // top-left frame on the spritesheet for this tile type
}
```

---

## Registry

`TILE_REGISTRY` is a read-only array of `TileDefinition`, ordered by `id`. It is the authoritative list of all terrain types at runtime.

```ts
const TILE_REGISTRY: readonly TileDefinition[] = [ ... ];
```

### `getTileById`

The one function all consumers call to resolve a numeric tile ID to its definition. O(1) lookup via array index.

```ts
function getTileById(id: number): TileDefinition
// Throws if id is out of range — map data referencing an unknown tile ID is a bug, not a fallback case
```

---

## Blob Ruleset

### Cardinal bitmask

The blob ruleset uses a 4-neighbour (cardinal) bitmask. Each cell checks its north, east, south, and west neighbours. If a neighbour is the same terrain type, its bit is set.

```
Bit 0 — North  (0001)
Bit 1 — East   (0010)
Bit 2 — South  (0100)
Bit 3 — West   (1000)
```

This produces 16 possible configurations (0–15).

### Reduced frame set with mirroring

Not all 16 configurations require a unique frame. Many are mirrors of each other. The tile editor resolves this — when authoring a ruleset, you paint the canonical frames and assign mirror transforms to the symmetric configurations. The `BlobFrameSet` stores the resolved result: every configuration maps to a `BlobFrame` with the correct `frameIndex` and flip flags.

The renderer never needs to know which frames were mirrored during authoring — it just reads `flipX` and `flipY` and applies them at draw time.

### Approximate unique frame count

With cardinal-only bitmask and mirroring, a terrain type requires approximately 13 unique painted frames. The tile editor handles the mirror assignments.

---

## Spritesheet Layout

### Fixed grid

The spritesheet uses a fixed grid — every frame is the same size (tile size × tile size, 16×16px). Frames are packed left-to-right by terrain type, one terrain type per row.

```
Row 0 — Grass variants (up to 16 frames, each 16×16px)
Row 1 — Wall variants
Row 2 — Water variants
Row 3 — Road variants
...
```

`baseCoords` in `TileDefinition` points to the first frame for that terrain type. `frameIndex` in `BlobFrame` is the offset from `baseCoords` within the row.

### Ownership

The spritesheet image (`public/spritesheet.png`) is generated and owned by the tile editor. It is never hand-edited. Regenerating the spritesheet regenerates the image from the frame pixel data stored in the tile editor's localStorage.

---

## File Ownership

`src/world/tiles.ts` is written by the tile editor and read by everything else. It is not hand-edited after the tile editor is running.

Before the tile editor exists, it is hand-authored — but it must conform to the data model above. The tile editor will read and round-trip whatever is already in the file.

---

## Initial Tile Types

| ID | Type | Name | Solid |
|---|---|---|---|
| 0 | `grass` | Grass | No |
| 1 | `wall` | Wall | Yes |
| 2 | `water` | Water | Yes |
| 3 | `road` | Road | No |

Door and Chest are sprites, not terrain tiles. They are out of scope for this module.

---

## Out of Scope

- Sprite definitions (player, NPCs, animated objects) — separate module, future work
- Diagonal neighbour blob rules (8-neighbour bitmask)
- Animated terrain tiles
- Multiple spritesheets
- Tile variants beyond blob rules (random variation, seasonal swaps)

---

## Decisions

| Decision | What we chose | Why |
|---|---|---|
| Numeric IDs in map arrays | `number[][]` map format unchanged | Less code to maintain; the existing map format is fine — the problem was scattered inline mappings, not the IDs themselves |
| String `TileType` in code | `'grass'` not `0` in logic and type signatures | Human-readable, self-documenting, type-safe; the numeric ID is only for the map array |
| Single shared module | `src/world/tiles.ts` replaces all inline tile lookups | One place to add a terrain type; consumers import, they don't duplicate |
| `getTileById` throws on unknown ID | Error, not a fallback tile | A map array referencing an unknown ID is a data bug — silent fallback hides it |
| Fixed grid spritesheet | One row per terrain type, frames left-to-right | Predictable coordinates; easy to debug; no bin-packing complexity |
| Cardinal-only blob ruleset | 4-neighbour bitmask, 16 configurations | ~13 unique frames per terrain type with mirroring; diagonal neighbours improve corner quality but triple the frame count — not worth it for this scope |
| Mirroring in blob authoring | Tile editor assigns flip transforms; renderer just reads `flipX`/`flipY` | Renderer stays simple; mirroring complexity is authoring-time, not runtime |
| Tile editor owns the file | Only the tile editor writes `tiles.ts` and `spritesheet.png` | Single writer, no merge conflicts, no drift between image and data |
| Shared Hono server | Tile editor routes added to the same server as the map editor | One process to run in dev; routes are additive and don't conflict |
| localStorage for pixel data | Working pixel data lives in localStorage, not files | File I/O on every brushstroke is wasteful; localStorage is fast and survives refresh |
| Explicit export only | Repo files only update on export button press | Prevents half-painted frames from breaking the game mid-session |
| LCH colour space | Primary input in LCH, converted to RGB at paint time | Perceptually uniform — adjusting lightness doesn't shift hue; better colour discipline than HSL |
| Global used colours panel | Shared across all terrain types | Shared colours (outlines, shadows) should be one click away regardless of active terrain type |
| No fixed palette | Full LCH gamut, no SNES colour restriction | SNES aesthetic comes from authoring discipline, not a technical limit |
| No undo | Omitted from paint mode | Keeps implementation simple; 16×16 frames are fast to repaint |
| Mirror helper in ruleset mode | Assign a config as mirror of another — auto-sets frame + flip | Reduces repetitive assignment; renderer stays simple (just reads flipX/flipY) |
| Full regeneration on export | Spritesheet always rebuilt from scratch | No partial update logic; pixel data in localStorage is always the source of truth |
| `pngjs` for PNG export | Server-side PNG generation via `pngjs` | Small, well-maintained, no native deps; runs cleanly in Node |
| Terrain type delete guard | Block delete if type is in use in any map | Prevents broken map references; scan is cheap against local files |

---

## Tile Editor Tool

The tile editor is the browser-based tool that authors and owns `tiles.ts` and `spritesheet.png`. This section covers the tool itself — architecture, UI, API, and build milestones.

### Goal

Paint tile variant frames, author blob rulesets, and export directly to the repo. Replaces hand-editing pixel art and blob configurations. Runs alongside the Vite dev server only — never ships with the game.

---

### Architecture

**Frontend:** A dedicated Vite page at `/tile-editor` — a separate entry point, not attached to the game or the map editor. Owns its own HTML, its own TypeScript, and its own canvas-based UI.

**Backend:** A standalone Hono server — shared with the map editor. Tile editor API routes are added alongside the map editor routes. Dev only — not part of the game build.

**Persistence:** All pixel data (painted frames, working colour history) is stored in localStorage between sessions. The Hono server is only called on explicit export. localStorage is the working state; the repo files are the published state.

**Dependency direction:**
```
Tile Editor frontend → localStorage (working state)
Tile Editor frontend → Hono API server (localhost:3001) → src/world/tiles.ts
                                                        → public/spritesheet.png
Tile Editor frontend → src/world/tiles.ts (read on load, via API)
```

---

### Modes

**Paint mode** — paint individual pixel frames at 16×16px. One frame at a time — the active frame is selected from the frame manager panel.
- Zoomed canvas (configurable zoom level) for comfortable 16×16 painting
- Active colour selected from the LCH colour picker or the used colours panel
- Pencil tool only — click or drag to paint pixels
- No undo — keep it simple

**Ruleset mode** — assign frames to the 16 cardinal blob configurations for the active terrain type.
- All 16 configurations displayed as neighbour diagrams — a 3×3 grid showing which cardinal neighbours match
- Each configuration shows its currently assigned frame thumbnail and flip flags
- Click a configuration to assign the active frame to it
- Flip toggles (flipX, flipY) per configuration
- Mirror helper — select a configuration and mark it as a mirror of another, auto-setting the frame and flip flags

---

### Colour System

**Working colour space: LCH** — perceptually uniform. L (lightness 0–100), C (chroma 0–150), H (hue 0–360). Adjusting lightness does not shift hue.

**Display and export: RGB** — canvas rendering and PNG export use RGB. LCH is converted to RGB at paint time via a small utility function — no external colour library needed.

**Used colours panel** — a global swatch grid that automatically tracks every colour painted across all terrain types. Swatches ordered by most recently used. Click a swatch to make it the active colour. Global (not per terrain type) — shared colours like outlines and shadows are one click away regardless of which terrain type is active.

**No fixed palette** — the full LCH gamut is available. The SNES-era aesthetic comes from colour discipline during authoring, not a technical restriction.

---

### Frame Manager

Each terrain type has a set of named frame slots — the unique painted variants before mirroring. Approximately 13 unique frames are needed per terrain type with cardinal blob rules and mirroring.

- Frame slots listed in a panel alongside the canvas
- Click a frame slot to make it active — the canvas shows that frame's pixel data
- Add frame — creates a new blank 16×16 frame slot for the active terrain type
- Delete frame — removes the slot and clears any ruleset assignments that referenced it
- Frame thumbnail — small preview of the painted pixels for each slot

---

### Terrain Type Management

The tile editor is the authority on which terrain types exist. Adding or removing a terrain type here is the only way to change `TileType` in `tiles.ts`.

- Terrain type list in the sidebar — click to make active
- Add terrain type — prompts for `type` (string ID), `name` (display name), and `solid` flag; scaffolds empty frame slots and a blank blob ruleset
- Delete terrain type — warns if the type is referenced in any map file (detected via API scan); blocked if in use
- Rename display name — updates `name` field only; does not change the `type` string ID or numeric `id`

---

### API

All routes are mounted on the shared Hono server alongside the map editor routes.

| Method | Route | Description |
|---|---|---|
| GET | `/api/tiles` | Reads `src/world/tiles.ts` and returns the full tile registry as JSON |
| POST | `/api/tiles/export` | Accepts full tile registry + pixel data; writes `tiles.ts` and generates `spritesheet.png` |
| GET | `/api/tiles/usage/:type` | Scans `src/world/maps/` and returns whether a terrain type is in use — for delete guard |

---

### Spritesheet Generation

On export, the Hono server:

1. Receives all frame pixel data (RGBA arrays, 16×16 per frame) and the full tile registry
2. Packs frames into a fixed grid — one row per terrain type, frames left-to-right in frame slot order
3. Writes `public/spritesheet.png` using `pngjs`
4. Updates `src/world/tiles.ts` with correct `baseCoords` for each terrain type and `frameIndex` values in the blob rulesets

The spritesheet is always regenerated from scratch on export — no partial updates.

---

### Out of Scope (tile editor)

- Sprite authoring (player, NPCs, animated objects) — separate tool, future work
- Animation frame sequencing
- Undo / redo
- Layer support
- Brush sizes beyond single pixel
- Diagonal neighbour blob rules (8-neighbour bitmask)
- Animated terrain tiles
- Importing existing PNG spritesheets
- Running outside of dev mode

---

## Build Order & Milestones

Each milestone ends with something **verifiably working**. Ship the milestone before starting the next one.

---

### Milestone 1 — Define the Module
**Done when:** `src/world/tiles.ts` exists, exports all four terrain types with placeholder blob rulesets, and `getTileById` is tested and passing.

#### 1.1 Core Types
- [x] `TileType` string union defined: `'grass' | 'wall' | 'water' | 'road'`
- [x] `BlobFrame` interface: `{ frameIndex, flipX, flipY }`
- [x] `BlobFrameSet` type: `Record<number, BlobFrame>` — keys 0–15
- [x] `SpriteCoords` interface: `{ col, row }`
- [x] `TileDefinition` interface: `{ id, type, name, solid, frames, baseCoords }`

#### 1.2 Registry
- [x] `TILE_REGISTRY` populated with all four initial terrain types (see Initial Tile Types table)
- [x] Blob rulesets hand-authored with placeholder frame indices — all 16 configurations covered for each terrain type, flip flags set to false
- [x] `getTileById(id)` implemented — O(1) array index lookup
- [x] `getTileById` throws a descriptive error on unknown ID — never returns a fallback tile
- [x] `TILE_SIZE` constant defined: `16` (px) — **note: exported as `SPRITE_TILE_SIZE` to avoid collision with the game's existing `TILE_SIZE = 32`**

#### 1.3 Tests
- [x] `getTileById(0)` returns the Grass definition
- [x] `getTileById` with an unknown ID throws
- [x] Every terrain type has all 16 blob configurations defined — no missing keys
- [x] All four terrain types have the correct `solid` flag

---

### Milestone 2 — Migrate the Game
**Done when:** No file outside `tiles.ts` hardcodes tile behaviour. `tileDefinitions.ts` is deleted.

#### 2.1 Audit
- [ ] Identify every file in the game and map editor that hardcodes tile IDs, solid flags, or tile colours inline
- [ ] List all sites that will need to call `getTileById` instead

#### 2.2 Game Migration
- [ ] Game tilemap renderer calls `getTileById` for spritesheet coords — no inline coordinate math
- [ ] Collision system calls `getTileById` for solid flag — no inline ID comparisons
- [ ] Map editor palette reads from `TILE_REGISTRY` — no hardcoded tile list
- [ ] Map editor renderer calls `getTileById` for tile colours — no inline colour map

#### 2.3 Cleanup
- [ ] `tileDefinitions.ts` deleted
- [ ] All imports of `tileDefinitions.ts` updated to import from `tiles.ts`
- [ ] No `// TODO: replace with getTileById` comments remain
- [ ] All existing tests still passing after migration

---

### Milestone 3 — Tile Editor: Hono Routes & Export Scaffold
**Done when:** The tile editor API is reachable, can read `tiles.ts`, and can write a minimal spritesheet PNG. Corresponds to Milestone 6 (Export) in the tile editor build — the two milestones close together.

- [ ] Tile editor routes added to the existing Hono server — no new process
- [ ] `GET /api/tiles` reads `src/world/tiles.ts` and returns the tile registry as JSON
- [ ] `POST /api/tiles/export` accepts tile registry + pixel data and writes `tiles.ts`
- [ ] `pngjs` installed and a proof-of-concept 16×16 PNG written to `public/spritesheet.png` on export
- [ ] `GET /api/tiles/usage/:type` scans `src/world/maps/` and returns in-use status

---

### Milestone 4 — Tile Editor: Paint Mode
**Done when:** A developer can paint a 16×16 pixel frame, zoom in and out, and see it persist in localStorage on refresh.

#### 4.1 Editor Page
- [ ] Vite entry point at `/tile-editor` — separate from game and map editor entry points
- [ ] Terrain type sidebar — lists terrain types loaded from `GET /api/tiles`
- [ ] Active terrain type highlighted; click to switch

#### 4.2 Frame Manager
- [ ] Frame slot panel lists all frames for the active terrain type
- [ ] Click a frame slot to make it active — canvas loads that frame's pixel data from localStorage
- [ ] Add frame button — creates a new blank 16×16 frame slot
- [ ] Delete frame button — removes slot and warns if assigned in ruleset
- [ ] Frame thumbnails rendered from pixel data

#### 4.3 Canvas
- [ ] 16×16 pixel canvas rendered at zoom — default zoom 16× (256×256px display)
- [ ] Zoom in / zoom out controls — range 8× to 32×
- [ ] Click and drag to paint active colour
- [ ] Grid overlay — faint lines between pixels for orientation
- [ ] Pixel data stored in localStorage keyed by terrain type + frame index

#### 4.4 Colour System
- [ ] LCH colour picker — L, C, H sliders with live preview
- [ ] RGB readout alongside LCH values
- [ ] Used colours panel — global swatch grid, ordered by most recently used
- [ ] Click swatch to set active colour
- [ ] Swatches persist in localStorage

---

### Milestone 5 — Tile Editor: Terrain Type Management
**Done when:** A developer can add, rename, and delete terrain types from within the editor.

- [ ] Add terrain type — dialog prompts for `type` string ID, display name, and solid flag
- [ ] New terrain type gets empty frame slots and a blank blob ruleset
- [ ] New terrain type added to `TileType` union and `TILE_REGISTRY` on next export
- [ ] Rename display name — inline edit, updates `name` field only
- [ ] Delete terrain type — calls `GET /api/tiles/usage/:type` first; blocked with error message if in use
- [ ] Delete confirmed — removes from localStorage and registry; reflected on next export

---

### Milestone 6 — Tile Editor: Ruleset Mode
**Done when:** A developer can assign frames to all 16 blob configurations for a terrain type, with mirror helpers.

#### 6.1 Configuration Grid
- [ ] All 16 cardinal configurations displayed as neighbour diagrams — 3×3 grid, centre cell is active terrain, filled/empty cells show same/different neighbours
- [ ] Each configuration shows assigned frame thumbnail (or blank if unassigned)
- [ ] Click a configuration to assign the currently active frame slot to it
- [ ] Unassign button — clears a configuration's frame assignment

#### 6.2 Flip Controls
- [ ] flipX toggle per configuration
- [ ] flipY toggle per configuration
- [ ] Thumbnail updates to reflect flip state

#### 6.3 Mirror Helper
- [ ] Select a configuration → "Mirror of" dropdown lists other configurations
- [ ] Selecting a mirror source auto-sets frame index and flip flags
- [ ] Mirror assignments shown visually — linked configurations highlighted together

---

### Milestone 7 — Tile Editor: Live Blob Preview
**Done when:** A developer can paint a small test grid and see blob rules resolve in real time using the authored ruleset.

- [ ] Preview panel — small grid (e.g. 8×8 tiles) paintable with terrain types
- [ ] Blob rules resolve automatically as tiles are painted — correct frame variant shown for each cell based on its cardinal neighbours
- [ ] Preview uses the same rendering logic as the game and map editor — no divergence
- [ ] Preview updates live as ruleset assignments change in Ruleset Mode

---

### Milestone 8 — Tile Editor: Export
**Done when:** A developer can export the full spritesheet and tile definitions to the repo in one click. This milestone completes the Tile Editor Handoff — `tiles.ts` is now fully owned by the tool.

- [ ] Export button in toolbar
- [ ] Validates all terrain types have all 16 configurations assigned before export — lists unassigned configurations as errors
- [ ] Calls `POST /api/tiles/export` with full pixel data and tile registry
- [ ] Server packs all frames into fixed-grid `public/spritesheet.png` via `pngjs`
- [ ] Server writes updated `src/world/tiles.ts` with correct `baseCoords` and `frameIndex` values
- [ ] Round-trip test: read → make no changes → export → diff confirms `tiles.ts` is unchanged
- [ ] Export success confirmation shown in UI
- [ ] Export error (e.g. write failure) shown with detail

---

## Progress Tracker

| Milestone | Status |
|---|---|
| 1 — Define the Module | ✅ Done |
| 2 — Migrate the Game | ⬜ Not started |
| 3 — Tile Editor: Hono Routes & Export Scaffold | ⬜ Not started |
| 4 — Tile Editor: Paint Mode | ⬜ Not started |
| 5 — Tile Editor: Terrain Type Management | ⬜ Not started |
| 6 — Tile Editor: Ruleset Mode | ⬜ Not started |
| 7 — Tile Editor: Live Blob Preview | ⬜ Not started |
| 8 — Tile Editor: Export | ⬜ Not started |

Update statuses: ⬜ Not started · 🟡 In progress · ✅ Done