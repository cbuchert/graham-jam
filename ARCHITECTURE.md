# Architecture

> Read this first. The diagrams below follow the C4 model — each level drills one layer deeper into the system. Full rationale for every decision lives in `documents/decisions/`.

---

## Level 1 — System Context

Who uses the system and what the two top-level systems are.

```mermaid
C4Context
    title System Context — JRPG Game Jam

    Person(player, "Player", "Plays the game in a browser")
    Person(dev, "Developer", "Authors maps, tiles, and game logic")

    System(game, "JRPG Game", "Browser-based tile-map RPG with turn-based combat")
    System(mapEditor, "Map Editor", "Dev-only tool for authoring tile maps and spawn points")
    System(tileEditor, "Tile Editor", "Dev-only tool for painting terrain variants and blob rulesets")

    Rel(player, game, "plays")
    Rel(dev, game, "develops")
    Rel(dev, mapEditor, "authors maps with")
    Rel(dev, tileEditor, "authors tile variants with")
    Rel(mapEditor, game, "writes map files imported by")
    Rel(tileEditor, game, "writes tiles.ts and tilesheet.png imported by")
```

---

## Level 2 — Containers

The containers inside the project boundary. Authoritative crossing points between game and editor tools are exactly: `src/world/tiles.ts` (shared module) and the map files (marker blocks). Everything else stays on one side of the boundary.

```mermaid
C4Container
    title Container diagram — game / editor boundary

    Person(player, "Player")
    Person(dev, "Developer")

    System_Boundary(proj, "Game Jam Project") {
        Container(game,         "Game",           "TypeScript / Canvas", "Browser JRPG runtime")
        Container(mapEditorUI,  "Map Editor UI",  "TypeScript / Vite",   "Tile map and spawn point authoring")
        Container(tileEditorUI, "Tile Editor UI", "TypeScript / Vite",   "Terrain variant painting and blob ruleset authoring")
        Container(editorAPI,    "Editor API",     "Hono / Node",         "Dev-only API — map file I/O and tile export")
        ContainerDb(mapFiles,   "Map files",      "TypeScript source",   "Tile and spawn data inside marker blocks")
        Container(tileDefs,     "tiles.ts",       "TypeScript module",   "The one module shared across the boundary")
        ContainerDb(tilesheet,  "tilesheet.png",  "PNG image",           "Packed terrain variants — written by tile editor on export")
        ContainerDb(localStorage, "localStorage", "Browser storage",     "Tile editor working state — pixel variants, colour history")
    }

    Rel(player, game, "plays")
    Rel(dev, mapEditorUI,  "authors tile maps with")
    Rel(dev, tileEditorUI, "authors terrain variants with")
    Rel(mapEditorUI,  editorAPI, "load / save maps",          "HTTP")
    Rel(tileEditorUI, localStorage, "reads / writes working state")
    Rel(tileEditorUI, editorAPI, "export on demand",          "HTTP POST /api/tiles/export")
    Rel(editorAPI, mapFiles,  "read / write marker blocks",   "fs/promises")
    Rel(editorAPI, tileDefs,  "writes on export",             "fs/promises")
    Rel(editorAPI, tilesheet, "writes on export via pngjs",   "fs/promises")
    Rel(game, mapFiles,  "imports map data",  "ES module")
    Rel(game, tileDefs,  "imports",           "ES module")
    Rel(game, tilesheet, "loads at runtime",  "Canvas / Image")
    Rel(mapEditorUI,  tileDefs, "imports", "ES module")
    Rel(tileEditorUI, tileDefs, "imports", "ES module")
```

→ Shared module boundary: [ADR 0004](documents/decisions/0004-single-shared-module-boundary.md)
→ Working state isolation: [ADR 0007](documents/decisions/0007-tile-editor-localstorage-working-state.md)

---

## Level 3 — Game Runtime Components

The five components inside the game runtime. Arrows show dependency direction. Any arrow pointing downward in this diagram is a violation of the layering rule.

```mermaid
C4Component
    title Component diagram — Game Runtime

    Container_Boundary(game, "Game Runtime") {
        Component(scenes, "Scenes", "TypeScript", "Thin orchestrators — hold state, delegate to layers")
        Component(jrpg, "JRPG Layer", "TypeScript", "Dialogue · Combat · Stats · Items")
        Component(world, "World Layer", "TypeScript", "Entities · Collision · Triggers · World graph")
        Component(rendering, "Rendering Layer", "TypeScript", "Camera · Tilemap · Sprites")
        Component(engine, "Engine Layer", "TypeScript", "Game loop · Input · Scene manager")
    }

    Rel(scenes, jrpg, "calls into")
    Rel(scenes, world, "calls into")
    Rel(scenes, rendering, "calls into")
    Rel(scenes, engine, "calls into")
    Rel(jrpg, world, "depends on")
    Rel(world, rendering, "depends on")
    Rel(rendering, engine, "depends on")
```

→ Rationale: [ADR 0005 — Four-layer architecture with strict dependency direction](documents/decisions/0005-four-layer-architecture.md)

---

## Level 3 — Editor API Components

The components inside the editor API. The key structural fact: tests import the app definition directly and never touch the server entry, so no port is ever bound during a test run.

```mermaid
C4Component
    title Component diagram — Editor API

    Container_Boundary(api, "Editor API") {
        Component(appDef, "App definition", "Hono", "Routes and middleware — no side effects on import")
        Component(serverEntry, "Server entry", "Node", "Calls serve adapter — binds port")
        Component(sceneParser, "Scene parser", "TypeScript", "Pure functions for reading and writing marker blocks")
    }

    Container(tests, "Test suite", "Vitest", "Imports app definition only — no port ever bound")
    Container(editorUI, "Editor UI", "TypeScript / browser", "HTTP client")

    Rel(tests, appDef, "imports · calls app.request()")
    Rel(serverEntry, appDef, "imports · binds port")
    Rel(editorUI, serverEntry, "sends HTTP requests to running server")
    Rel(appDef, sceneParser, "delegates file parsing to")
```

→ Rationale: [ADR 0006 — Hono for the editor API; app-definition separate from server entry](documents/decisions/0006-hono-editor-api-testability.md)

---

## Design decisions index

| ADR | Decision |
|-----|----------|
| [0001](documents/decisions/0001-custom-game-loop-no-engine.md) | Custom game loop — no engine dependencies |
| [0002](documents/decisions/0002-fixed-canvas-resolution.md) | Fixed internal canvas resolution |
| [0003](documents/decisions/0003-editor-game-contract-marker-blocks.md) | Editor/game contract via marker blocks |
| [0004](documents/decisions/0004-single-shared-module-boundary.md) | Single shared module boundary (`tiles.ts`) |
| [0005](documents/decisions/0005-four-layer-architecture.md) | Four-layer architecture, strict dependency direction |
| [0006](documents/decisions/0006-hono-editor-api-testability.md) | Hono for editor API; app definition separate from server entry |
| [0007](documents/decisions/0007-tile-editor-localstorage-working-state.md) | Tile editor: localStorage as working state, repo as published state |
| [0008](documents/decisions/0008-lch-colour-space-no-library.md) | LCH colour space for palette authoring; hand-rolled conversion |
| [0009](documents/decisions/0009-blob-tile-same-type-matching.md) | Blob tile ruleset: same-type matching; transitions via dedicated terrain types |
