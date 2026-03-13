# JRPG Engine Spec
> TypeScript · HTML5 Canvas · Custom game loop · No engine dependencies

---

## Project Goal

A simple JRPG running in the browser. Overworld exploration, NPC dialogue, random encounters, turn-based combat. Audience: one kid, zero tutorials. Playable before fancy.

---

## Architecture Overview

System context and container diagrams live in ADR 0004. Internal game layer component diagram lives in ADR 0005.

The game is structured in four layers with dependency flowing strictly downward. Higher layers depend on lower layers. Never the reverse.

---

## Build Order & Milestones

Each milestone ends with something **visibly playable**. Ship the milestone before starting the next one.

---

### Milestone 1 — Core Engine
**Done when:** A character rectangle moves around a blank canvas.

#### 1.1 Game Loop
- [x] `requestAnimationFrame` loop
- [x] Delta time (`dt`) in seconds, capped at 50ms
- [x] Separate `update(state, dt)` and `render(ctx, state)` functions
- [x] Pure `update` — no side effects, fully unit-testable

#### 1.2 Input Manager
- [x] Track key state as a `Set<string>` (held keys, not events)
- [x] `isDown(key: string): boolean` helper
- [x] Bind: Arrow keys + WASD for movement, Z/Enter for confirm, X/Escape for cancel

#### 1.3 Scene Manager
- [x] Scene interface: `{ update(dt): void; render(ctx): void; onEnter?(): void; onExit?(): void }`
- [x] Scene stack: `push(scene)`, `pop()`, `replace(scene)`
- [x] Active scene is always `stack[top]`
- [x] Pushing battle scene over overworld scene (not replacing it)

---

### Milestone 2 — Rendering
**Done when:** The character walks around a tile-based map.

#### 2.1 Tilemap Renderer
- [x] Tile data as a 2D number array
- [x] Tile size constant (e.g. 16px or 32px)
- [x] Render only tiles within camera viewport (culling)
- [x] Solid vs. walkable tile flag per tile type

#### 2.2 Camera
- [x] Camera as `{ x, y }` in world space (px)
- [x] World-to-screen transform: `screenX = worldX - camera.x`
- [x] Camera follows player, clamped to map bounds
- [x] All rendering goes through camera offset

#### 2.3 Sprite Renderer
- [x] Load spritesheet from `<img>` element
- [x] `drawSprite(ctx, sheet, frameX, frameY, destX, destY)`
- [x] Animation: frame index advances on a timer (not every update)
- [x] Walk cycle: idle, walk-left, walk-right, walk-up, walk-down

---

### Milestone 3 — World
**Done when:** The player can't walk through walls, and stepping on a tile can fire an event.

#### 3.1 Entity System
- [x] Entity interface: `{ x, y, width, height, sprite?, update?(dt): void }`
- [x] Player is an entity
- [x] NPCs are entities (static for now)
- [x] Entity list owned by the active scene

#### 3.2 Collision — AABB vs Tilemap
- [x] Resolve player movement against solid tiles
- [x] Separate X and Y axis resolution (prevents corner-catching)
- [x] Helper: `getTileAt(worldX, worldY): Tile`
- [x] No entity-vs-entity collision needed for MVP

#### 3.3 Trigger Zones
- [x] Trigger: `{ x, y, width, height, onEnter(): void }`
- [x] Check player AABB against all triggers each frame
- [x] Use cases: doors (scene transition), NPC talk radius, encounter zones

---

### Milestone 4 — JRPG Layer
**Done when:** The player can talk to an NPC, enter a battle, and win or lose.

#### 4.1 Dialogue System
- [x] Dialogue box rendered over the scene (not a new scene)
- [x] Text advances on Z/Enter
- [x] Script: array of strings, stepped through in order
- [x] Input blocked for overworld while dialogue is open
- [x] Optional: speaker name label

#### 4.2 Battle Scene
- [x] Pushed onto scene stack (overworld pauses underneath)
- [x] State machine: `player-turn → enemy-turn → resolve → next-turn`
- [x] Actions: Attack, Item (one item type), Run
- [x] Enemy has HP, attack, and a dead state
- [x] Victory: pop battle scene, resume overworld
- [x] Defeat: game over screen (simplest possible — "Game Over" + restart)

#### 4.3 Party & Stat Data
- [x] Player stats: `{ hp, maxHp, attack, defense, level, xp }`
- [x] XP gain on victory, level-up threshold
- [x] One enemy type to start; add more after combat loop feels good
- [x] Wire healing item from inventory into battle Item action

---

### Milestone 5 — Inventory System
**Done when:** The player can open an inventory menu, equip gear, and use a consumable in battle.

#### 5.1 Item Registry
- [x] Item definition: `{ id, name, type: 'equipment' | 'consumable', effect }`
- [x] Equipment definition extends with: `{ slot: 'weapon' | 'armour' | 'accessory', statDeltas }`
- [x] Consumable definition extends with: `{ effect: (partyState) => partyState }`
- [x] Global read-only item registry — definitions never change at runtime
- [x] No durability

#### 5.2 Inventory State
- [x] Inventory held on party data: map of item ID to quantity
- [x] Equipment slots on party data: `{ weapon, armour, accessory }` — each holds an item ID or empty
- [x] `addItem(inventory, itemId)` — increments quantity
- [x] `removeItem(inventory, itemId)` — decrements quantity, errors if none held
- [x] Derived stats always computed from base stats plus equipped gear — never cached

#### 5.3 World Item Pickups
- [x] Chest trigger fires on approach (inside the small building)
- [x] Trigger calls `addItem`, marks chest collected (one-shot), shows "Found a Potion!" dialogue
- [x] Battle uses potion count from inventory; consumed potions deducted on exit

---

### Milestone 6 — Inventory UI
**Done when:** The player can navigate the inventory menu with the keyboard and equip or use items.

#### 6.1 Inventory Scene
- [x] Pushed onto scene stack from overworld (X/Escape opens and closes it)
- [x] Keyboard cursor navigation between items (↑↓ move cursor, ←→ switch tabs)
- [x] Two tabs: Equipment and Consumables
- [x] Equip action: swaps item into correct slot, returns displaced item to inventory
- [x] Unequip action: select an occupied slot to return it to the bag
- [x] Stat preview: right panel shows current stats; IF EQUIPPED diff when hovering a bag item
- [x] Consumables usable from overworld menu (applies effect, deducts from inventory)
- [x] onClose callback propagates inventory and stats changes back to OverworldScene

#### 6.2 Battle Item Submenu
- [x] Shown when player presses ↑/W in battle (opens submenu instead of immediately using)
- [x] Lists consumables only — no equipment changes mid-battle
- [x] ↑↓ navigate, Z confirm use, X back to main menu
- [x] Consumables list passed as `BattleConsumable[]` snapshot from OverworldScene — data-driven, not hardcoded

---

### Milestone 7 — World Graph
**Done when:** Scenes are linked by named spawn points and door triggers resolve by scene name, not constructor reference.

#### 7.1 World Graph
- [x] `SceneName` — string union type of all valid scene names, defined in `src/world/worldGraph.ts`
- [x] Scene factory registry — maps each `SceneName` to a factory function
- [x] World graph is the single source of truth for valid scene names; adding a scene means adding it here first

#### 7.2 Spawn Points
- [x] Each scene data record gains a `spawnPoints` field — named locations, e.g. `{ entrance: { x, y }, fromDungeon: { x, y } }`
- [x] Player starting position on scene load is determined by the spawn point name passed at transition time
- [x] Spawn point names are strings local to the scene — no global registry needed

#### 7.3 Door Triggers
- [x] Door trigger data: `{ type: 'door', toScene: SceneName, toSpawn: string }`
- [x] Scene manager resolves door transitions: looks up factory in world graph, instantiates scene, passes spawn point as player start
- [x] No scene constructor references in trigger data — names only

---

### Milestone 8 — Audio (time permitting)
**Done when:** Music loops on the overworld and a sound plays on a combat hit.

Do not start this milestone until Milestone 7 is complete and the game is fully playable. Audio is the easiest system to add last and the easiest to lose a day to early — Web Audio API has real gotchas (autoplay policy, context suspension) that will pull you off the critical path.

#### 8.1 Audio Manager
- [ ] Single `AudioContext` created on first user interaction (browser autoplay policy)
- [ ] `playMusic(track)` — loads and loops a background track, stops any current track
- [ ] `playSfx(sound)` — fires a one-shot sound effect
- [ ] Volume control for music and SFX independently

#### 8.2 Hookup
- [ ] Overworld scene plays looping background music on `onEnter`, stops on `onExit`
- [ ] Battle scene plays its own music track
- [ ] Combat hit plays a sound effect
- [ ] Dialogue confirm plays a sound effect

---

## Scene Authoring

A scene is data: a tilemap, a spawn point map, an entity list, and a trigger list. The engine consumes it; the scene does not contain logic.

### Tilemap

A tilemap is a 2D array of tile IDs paired with a lookup table that maps each ID to its visual and physical properties — which cell on the spritesheet to draw, and whether the tile is solid or walkable. The 2D array is the map layout; the lookup table is the tile vocabulary.

**Authoring approach:** Scene files are authored via the Scene Editor (see `SCENE-EDITOR-SPEC.md`). The editor owns the tile array and spawn points; imports, entities, and triggers are hand-authored below the editor markers.

### Spawn Points

Named locations within a scene where the player can arrive. A spawn point is a tile coordinate with a string name local to the scene. Door triggers in other scenes reference this scene's spawn points by name. If a spawn point is renamed or moved, only the spawn point definition needs updating — not every link that points to it.

### Spritesheet

A single image containing all tile frames and character frames, divided into a uniform grid. A tile ID maps to a grid position (column, row) on the sheet. This keeps asset files small and draw calls simple.

Tile IDs and sprite grid positions are the only coupling between the tilemap data and the spritesheet image. Changing the spritesheet layout means updating the lookup table, not the map data.

### Entities

An array of entity records owned by the scene — player, NPCs, anything with a position and a sprite. Entities are data; behaviour (e.g. a wandering NPC) is an optional update function attached to the record. The entity list is passed to the update and render functions each frame.

### Triggers

An array of rectangular zones in world space, each with a callback. The engine checks player overlap against all triggers every frame. Door triggers are data — `{ type: 'door', toScene: SceneName, toSpawn: string }` — resolved by the scene manager at transition time. No trigger holds a constructor reference.

### Scene as a record

Scenes are plain data records, not classes. A scene object contains its tilemap, spawn points, entity list, and trigger list. The Scene Manager holds the active scene; the engine's update and render functions consume it. Logic lives in the engine, not in the scene.

### World Graph

`src/world/worldGraph.ts` is the single source of truth for the world. It defines all valid scene names as a string union type and maps each name to a scene factory function. Adding a new scene to the game means registering it here first. Scene links (door triggers) reference scene names from this union — an invalid scene name is a type error.

---

## TDD Approach

### Tooling decisions

- **Test runner:** Vitest
- **Project scaffold:** Vite with the vanilla-ts template
- **Test environment:** `node` — pure logic tests have no DOM dependencies, so jsdom is unnecessary overhead. Add jsdom only if a future module genuinely needs DOM type availability.

---

### What to test and what not to

The game loop boundary determines what is testable. `requestAnimationFrame` and the canvas rendering context are browser APIs that do not exist in the test environment. The rAF shell and all `render()` functions are left untested by design. Everything else should be covered.

The rule: **if a function takes data in and returns data out with no browser API dependencies, it gets a test.**

| Component | Testable | Reason |
|---|---|---|
| rAF shell | No | Browser API |
| `render()` functions | No | Canvas side effects |
| `update(state, dt)` | Yes | Pure function |
| Input manager | Yes | Pure key state |
| Scene manager | Yes | Pure stack operations |
| Collision math | Yes | Pure function |
| Trigger detection | Yes | Pure function |
| World graph lookups | Yes | Pure data |
| Spawn point resolution | Yes | Pure function |
| Dialogue state | Yes | Pure state machine |
| Battle state machine | Yes | Pure state machine |
| Party / stat data | Yes | Pure data + logic |
| Item registry | Yes | Pure data |
| Inventory state | Yes | Pure data + logic |
| Derived stat calculation | Yes | Pure function |
| Audio manager | No | Web Audio API |

---

### Module structure

Source is organised by layer, mirroring the C4 component diagram. Each module owns its logic and its test file lives alongside it. The rAF shell (`main.ts`) sits at the root and is the only file with no corresponding test.

Layers: `engine/`, `rendering/`, `world/`, `jrpg/`, `audio/`

**Layer ownership — what belongs where:**

| Layer | Owns | Does NOT own |
|---|---|---|
| `engine/` | Game loop primitives, input state, scene stack. No game content, no rendering, no game logic. | Anything that knows what a sword or slime is. |
| `rendering/` | Functions that take `ctx` + data and draw. Canvas primitives, camera math, sprite animation, UI panels. Stateless — no game state, no scene references. | Game rules. Map instance references. Scene state. |
| `world/` | Spatial game logic: collision, triggers, tile movement, world graph, spawn point resolution. Tile definitions (`tileDefinitions.ts`) — shared with the scene editor. All functions take a `Tilemap` as a parameter — never reference a specific map instance. | JRPG mechanics (stats, items, battle). Rendering. |
| `jrpg/` | Game-specific mechanics as pure state machines and pure data transformations: battle, dialogue, stats, items, inventory. | Rendering. Map/spatial logic. |
| `scenes/` | Thin orchestrators. Own mutable state that spans a scene's lifetime. Call down into lower layers. Wire events between systems. | Pure logic that belongs in a lower layer. |

**Where does this code belong? — decision rules:**

1. Does it call `ctx.*`? → `rendering/`
2. Is it a pure function of game state with no spatial reasoning? → `jrpg/`
3. Does it reason about tiles, positions, collision, or scene links? → `world/` (with map as a parameter)
4. Does it manage the loop, key state, or scene stack? → `engine/`
5. Does it reference `this` on a scene class and can't be moved without it? → it belongs in the scene
6. Does it reference a specific map instance (e.g. `TOWN_MAP`) instead of taking a `Tilemap` parameter? → coupling bug; make the map a parameter

**Dependency direction — always downward:**

```
scenes/ → jrpg/ → world/ → rendering/ → engine/
```

No lower layer imports from a higher one. Violations of this are architecture bugs, not style issues.

---

### TDD rhythm

1. Write a failing test that describes the behaviour in plain English
2. Write the minimum code to make it pass — no more
3. Refactor if needed, keeping tests green
4. Move on

---

### Implementation decisions

Decisions made during build that aren't obvious from the spec.

| Decision | What we chose | Why |
|---|---|---|
| Input key identity | `e.code` (e.g. `"KeyW"`, `"ArrowUp"`) not `e.key` (e.g. `"w"`) | Physical key position — WASD works on any keyboard layout |
| Engine state mutations | All state functions return new objects; never mutate in place | Makes state transitions debuggable; log every call and see exactly what changed |
| Scene lifecycle side effects | `push` calls `onEnter`; `pop` calls `onExit` on the departing scene only (does NOT call `onEnter` on the newly-active scene); `replace` calls `onExit` then `onEnter` | `pop` is a resume, not a fresh entry — the scene underneath is already alive. `onEnter` is only guaranteed on initial push or replace. |
| Scene-lifetime init | State that must survive the full lifetime of a scene (e.g. camera target) belongs in the constructor, not `onEnter` | `onEnter` is called on initial push and `replace` but NOT when the scene resumes after a pushed scene pops. Putting live state there causes it to be missing on resume. |
| Fixed render resolution | `canvas.width = 640; canvas.height = 360` in `main.ts`, fixed forever. CSS scales it to fill the window. `image-rendering: pixelated` keeps it sharp. | If the canvas matches the browser window (e.g. 1440×900), the entire 960×640 map fits — `clampCamera` returns `{0,0}` and nothing ever scrolls. Fixed internal resolution is required for any camera movement to be visible. |
| Scene transition handle | `SceneManager` interface passed to scene constructors (`push`, `pop`, `replace`) | Scenes need to drive their own transitions (e.g. BattleScene pops itself); threading a handle is cleaner than a global |
| Door trigger resolution | Door triggers carry `{ toScene: SceneName, toSpawn: string }` — the scene manager resolves the factory from the world graph at transition time | No constructor references in trigger data; adding a scene means registering it in the world graph, not hunting for trigger callbacks |
| Scene name type safety | `SceneName` is a string union type defined in `worldGraph.ts` — an invalid scene name in a door trigger is a compile-time type error | Catches broken links at build time, not at runtime when the player walks through a door |
| Spawn point naming | Spawn point names are strings local to each scene — no global registry | Local names are self-documenting (`entrance`, `fromDungeon`) and don't need coordination across scenes |
| Battle input guard | Unified `actionConsumed` flag, reset only when all action keys are released | `isActionDown` is held-not-pressed — without a guard, holding Z spams actions every frame; `setTimeout` also caused over-pop (scheduling multiple pops while key was held); replaced with in-loop `exitTimer` |
| `actionConsumed` placement | Set `actionConsumed = true` only inside the branch that handles a key, never unconditionally at the top of a state block | Setting it unconditionally poisons the flag on idle frames: the next real key press hits `if (actionConsumed) return` and is silently swallowed. Rule: if no key fired, don't consume. |
| Input-driven UI state | Extract to a pure `update(state, action) → state` function in `jrpg/`, not inline in a scene class | Inline logic in a scene is untestable; a pure reducer is 10 lines and would have caught the `actionConsumed` placement bug immediately |
| Stats persistence | `PlayerStats` owned by `OverworldScene`, passed to `BattleScene` at construction, returned via exit callback | Avoids global mutable state; OverworldScene applies `applyXp` on victory and merges updated HP on any outcome |
| Overworld movement model | Tile-aligned: `{ tileX, tileY, offsetX, offsetY, moving }` — logical position in tiles, visual offset animates from `±TILE_SIZE` to `0` | Free pixel movement drifts off-grid; tile-aligned movement is authentic JRPG feel and makes collision trivial |
| Overworld collision strategy | Pre-move tile check (`isSolid(map, nextTileX, nextTileY)`) before committing a step, not AABB resolution | With tile-aligned movement the destination is always one tile away — checking that single tile is sufficient. `resolveMovement` AABB stays in codebase for any future free-movement scene. |
| Trigger fire timing | Triggers check only on tile arrival (`justArrived = wasMoving && !moving`), not every frame | Fires once per step cleanly; avoids re-firing mid-slide and makes encounter/door logic predictable |
| Item definitions | Read-only registry authored at startup, never mutated at runtime | Separates authoring from state; inventory holds IDs and quantities, not copies of definitions |
| Equipment stat model | Derived stats always computed from base stats plus equipped item deltas — never cached | No cache invalidation needed; recompute is cheap for a small stat set |
| No durability | Item instances have no durability field | Out of scope for this jam; omitting it keeps inventory state simple |
| Camera controller | `CameraController` object owns both position and target logic; held by the scene | Separates camera behavior from scene logic. `target` is a `() => {x,y}` getter — swap it to follow any entity or fixed point. `lerpSpeed` (`null` = snap, `number` px/s = linear glide) handles both instant hard cuts and smooth cinematic pans without extra modes. |
| Scene private method extraction | A private scene method that takes all its inputs as parameters and does not read or write `this` is already a module function — move it to the appropriate layer | Keeps scenes thin; makes logic testable without constructing a scene; signals a layer violation when the function is hard-coupled to scene-specific data (e.g. `readInput` referencing `TOWN_MAP` directly) |
| Layer boundary for `world/` | Modules in `world/` must never reference specific map instances (e.g. `TOWN_MAP`) — tilemaps are always passed as parameters | Hard-coding a map reference makes the function non-portable; any second map scene would copy-paste broken collision |
| Render utilities in `rendering/` | Any function that takes `ctx` + data and draws without reading scene state belongs in `rendering/`, not a scene class | Scenes become thin orchestrators; render functions become composable and reusable across scenes |
| Shared code with scene editor | `src/world/tileDefinitions.ts` only — a pure data module imported by both the game and the editor | The game renderer and the editor grid are different enough that sharing render code would couple editor concerns into the game build. Tile definitions are pure data (`{ id, name, solid, editorColour }`) with no such risk. The `editorColour` field is editor-only metadata; the game ignores it. |
| Editor tile data vs game tile data | `src/scenes/town.ts` (editor-managed, marker block) and `src/world/maps/town.ts` (game-managed, `TOWN_MAP`) are separate files that can drift | The editor writes to `src/scenes/` via the marker convention; the game still imports `TOWN_MAP` from `src/world/maps/`. They are intentionally decoupled for now. If you paint tiles in the editor and want the game to see them, you must manually reconcile the two files — or wire the game to import `TILES` from the scene file instead of `TOWN_MAP`. That reconciliation is out of scope until the editor is fully working. |

---

### What makes a good game test

- Test behaviour, not implementation. "Player stops at a solid tile" not "resolveX was called."
- Use plain numbers for positions and velocities — no mocks needed if functions are pure.
- Name tests as sentences describing the expected behaviour.
- Keep fixtures small — a 3×3 tile map is enough to test collision.
- One assertion per test where possible. Game logic bugs are easier to find when each test has a single point of failure.

---

## Technical Constraints

| Concern | Decision |
|---|---|
| Language | TypeScript |
| Renderer | HTML5 Canvas 2D |
| Runtime | Browser — modern evergreen |
| Bundler | Vite |
| Engine deps | None |
| Test runner | Vitest |
| Target framerate | 60fps; physics in px/s and px/s² |

---

## Key Constants

These are tuning values, not requirements. Start with reasonable defaults and adjust until the feel is right. Documented here so changes are deliberate, not accidental.

- **Tile size:** 32px — large enough to be legible, small enough to fit a useful map on screen
- **Player speed:** ~160px/s on the overworld — tune until traversal feels brisk but not frantic
- **Delta time cap:** 50ms maximum — prevents physics explosion if the tab loses focus and resumes
- **Gravity:** only relevant if platformer sections are added; not in current scope

---

## Out of Scope (for this jam)

These are good ideas. They are not in this game.

- Save / load
- Multiple party members
- Animated battle sprites
- Item durability
- Quest system — requires story design before engine design; quests drive everything in a real JRPG (FF5/FF6 scale), which makes them a separate project. Revisit if this grows beyond a jam.

---

## Progress Tracker

| Milestone | Status |
|---|---|
| 1 — Core Engine | ✅ Done |
| 2 — Rendering | ✅ Done |
| 3 — World | ✅ Done |
| 4 — JRPG Layer | ✅ Done |
| 5 — Inventory System | ✅ Done |
| 6 — Inventory UI | ✅ Done |
| 7 — World Graph | ✅ Done |
| 8 — Audio | ⬜ Not started |

Update statuses: ⬜ Not started · 🟡 In progress · ✅ Done
