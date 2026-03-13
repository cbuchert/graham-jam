# JRPG Engine Spec
> TypeScript · HTML5 Canvas · Custom game loop · No engine dependencies

---

## Project Goal

A simple JRPG running in the browser. Overworld exploration, NPC dialogue, random encounters, turn-based combat. Audience: one kid, zero tutorials. Playable before fancy.

---

## Architecture Overview

```
LAYER 1 — Core Engine
├── Game loop
├── Input manager
└── Scene manager

LAYER 2 — Rendering
├── Camera
├── Tilemap renderer
└── Sprite renderer

LAYER 3 — World
├── Entity system
├── Collision (AABB vs tilemap)
└── Trigger zones

LAYER 4 — JRPG Layer
├── Dialogue system
├── Battle scene
└── Party / stat data
```

Higher layers depend on lower layers. Never the reverse.

---

## Build Order & Milestones

Each milestone ends with something **visibly playable**. Ship the milestone before starting the next one.

---

### Milestone 1 — Core Engine
**Done when:** A character rectangle moves around a blank canvas.

#### 1.1 Game Loop
- [ ] `requestAnimationFrame` loop
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
- [ ] Tile data as a 2D number array
- [ ] Tile size constant (e.g. 16px or 32px)
- [ ] Render only tiles within camera viewport (culling)
- [ ] Solid vs. walkable tile flag per tile type

#### 2.2 Camera
- [ ] Camera as `{ x, y }` in world space (px)
- [ ] World-to-screen transform: `screenX = worldX - camera.x`
- [ ] Camera follows player, clamped to map bounds
- [ ] All rendering goes through camera offset

#### 2.3 Sprite Renderer
- [ ] Load spritesheet from `<img>` element
- [ ] `drawSprite(ctx, sheet, frameX, frameY, destX, destY)`
- [ ] Animation: frame index advances on a timer (not every update)
- [ ] Walk cycle: idle, walk-left, walk-right, walk-up, walk-down

---

### Milestone 3 — World
**Done when:** The player can't walk through walls, and stepping on a tile can fire an event.

#### 3.1 Entity System
- [ ] Entity interface: `{ x, y, width, height, sprite?, update?(dt): void }`
- [ ] Player is an entity
- [ ] NPCs are entities (static for now)
- [ ] Entity list owned by the active scene

#### 3.2 Collision — AABB vs Tilemap
- [ ] Resolve player movement against solid tiles
- [ ] Separate X and Y axis resolution (prevents corner-catching)
- [ ] Helper: `getTileAt(worldX, worldY): Tile`
- [ ] No entity-vs-entity collision needed for MVP

#### 3.3 Trigger Zones
- [ ] Trigger: `{ x, y, width, height, onEnter(): void }`
- [ ] Check player AABB against all triggers each frame
- [ ] Use cases: doors (scene transition), NPC talk radius, encounter zones

---

### Milestone 4 — JRPG Layer
**Done when:** The player can talk to an NPC, enter a battle, and win or lose.

#### 4.1 Dialogue System
- [ ] Dialogue box rendered over the scene (not a new scene)
- [ ] Text advances on Z/Enter
- [ ] Script: array of strings, stepped through in order
- [ ] Input blocked for overworld while dialogue is open
- [ ] Optional: speaker name label

#### 4.2 Battle Scene
- [ ] Pushed onto scene stack (overworld pauses underneath)
- [ ] State machine: `player-turn → enemy-turn → resolve → next-turn`
- [ ] Actions: Attack, Item (one item type), Run
- [ ] Enemy has HP, attack, and a dead state
- [ ] Victory: pop battle scene, resume overworld
- [ ] Defeat: game over screen (simplest possible — "Game Over" + restart)

#### 4.3 Party & Stat Data
- [ ] Player stats: `{ hp, maxHp, attack, defense, level, xp }`
- [ ] XP gain on victory, level-up threshold
- [ ] One enemy type to start; add more after combat loop feels good
- [ ] Items: one healing item, collectible in the world via trigger zone

---

## C4 Architecture

### Level 1 — System Context

```
┌─────────────────────────────────────────────┐
│                System Boundary              │
│                                             │
│  ┌──────────┐   plays    ┌───────────────┐  │
│  │  Player  │ ─────────▶ │   JRPG Game   │  │
│  │          │            │ TypeScript    │  │
│  │ Keyboard │            │ Canvas        │  │
│  └──────────┘            └───────┬───────┘  │
│                                  │           │
└──────────────────────────────────┼──────────┘
                                   │ draws to
                          ┌────────▼────────┐
                          │    Browser      │
                          │ Renders canvas  │
                          └─────────────────┘
```

_L2 is trivial — one browser, one canvas, one `<script type="module">`. Skipped._

---

### Level 3 — Components

Arrows point **downward only**. No lower layer imports from a higher one.

```
─── Layer 1: Core ──────────────────────────────────────────────────────

  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
  │   Game loop     │   │  Input manager  │   │  Scene manager  │
  │ rAF · dt ·      │   │ Key state ·     │   │ Stack ·         │
  │ update/render   │   │ isDown()        │   │ push/pop        │
  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
           │                     │                      │
─── Layer 2: Rendering ─────────────────────────────────────────────────
           │                     │                      │
           ▼                     ▼                      ▼
  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
  │     Camera      │   │ Tilemap renderer│   │ Sprite renderer │
  │ World → screen  │   │ 2D array ·      │   │ Spritesheet ·   │
  │                 │   │ culling         │   │ animation       │
  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
           │                     │                      │
─── Layer 3: World ─────────────────────────────────────────────────────
           │                     │                      │
           ▼                     ▼                      ▼
  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
  │  Entity system  │   │    Collision    │   │  Trigger zones  │
  │ Player · NPCs   │   │ AABB vs tilemap │   │ Doors ·         │
  │                 │   │                 │   │ encounters      │
  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
           │                     │                      │
─── Layer 4: JRPG ──────────────────────────────────────────────────────
           │                     │                      │
           ▼                     ▼                      ▼
  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
  │ Dialogue system │   │  Battle scene   │   │ Party/stat data │
  │ Text box ·      │   │ Pushed scene ·  │   │ HP · XP ·       │
  │ script          │   │ turns           │   │ level           │
  └─────────────────┘   └─────────────────┘   └─────────────────┘
```

**The Scene Manager is the linchpin** — it is the host that runs whichever layer's scene is currently active. It is the one component that touches all layers. Build it carefully.

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
| Dialogue state | Yes | Pure state machine |
| Battle state machine | Yes | Pure state machine |
| Party / stat data | Yes | Pure data + logic |

---

### Module structure

Source is organised by layer, mirroring the C4 component diagram. Each module owns its logic and its test file lives alongside it. The rAF shell (`main.ts`) sits at the root and is the only file with no corresponding test.

Layers: `engine/`, `rendering/`, `world/`, `jrpg/`

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
| Scene lifecycle side effects | `push`/`pop`/`replace` call `onEnter`/`onExit` before returning new state | Lifecycle hooks are the only intentional side effects in Layer 1; everything else is pure |

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
| Bundler | None required (`<script type="module">`) or Vite |
| Engine deps | None |
| Test runner | Vitest (optional but recommended for Layer 1) |
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

- Inventory menu
- Save / load
- Multiple party members
- Animated battle sprites
- Sound (add it last if time allows — Web Audio API)
- Map editor
- More than one dungeon
- Quest system — requires story design before engine design; quests drive everything in a real JRPG (FF5/FF6 scale), which makes them a separate project. Revisit if this grows beyond a jam.

---

## Progress Tracker

| Milestone | Status |
|---|---|
| 1 — Core Engine | ✅ Done |
| 2 — Rendering | ⬜ Not started |
| 3 — World | ⬜ Not started |
| 4 — JRPG Layer | ⬜ Not started |

Update statuses: ⬜ Not started · 🟡 In progress · ✅ Done
