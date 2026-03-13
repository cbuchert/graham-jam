# Architecture

> Read this first. The diagrams below follow the C4 model — each level drills one layer deeper into the system. Full rationale for every decision lives in `documents/decisions/`.

---

## Level 1 — System Context

Who uses the system and what the two top-level systems are.

```mermaid
C4Context
    title System Context — JRPG Game Jam

    Person(player, "Player", "Plays the game in a browser")
    Person(dev, "Developer", "Authors scenes and develops the game")

    System(game, "JRPG Game", "Browser-based tile-map RPG with turn-based combat")
    System(editor, "Scene Editor", "Dev-only tool for authoring tile maps and spawn points")

    Rel(player, game, "plays")
    Rel(dev, game, "develops")
    Rel(dev, editor, "authors scenes with")
    Rel(editor, game, "writes scene files imported by")
```

---

## Level 2 — Containers

The containers inside the project boundary and every relationship crossing the game/editor line. There are exactly two crossing points. A third crossing is a design violation.

```mermaid
C4Container
    title Container diagram — game / editor boundary

    Person(player, "Player")
    Person(dev, "Developer")

    System_Boundary(proj, "Game Jam Project") {
        Container(game, "Game", "TypeScript / Canvas", "Browser JRPG runtime")
        Container(editorUI, "Editor UI", "TypeScript / Vite", "Tile map authoring interface")
        Container(editorAPI, "Editor API", "Hono / Node", "Dev-only scene file API")
        ContainerDb(sceneFiles, "Scene files", "TypeScript source", "Tile and spawn data inside marker blocks")
        Container(tileDefs, "Tile definitions", "TypeScript module", "The one module shared across the boundary")
    }

    Rel(player, game, "plays")
    Rel(dev, editorUI, "authors tile maps")
    Rel(editorUI, editorAPI, "load / save scenes", "HTTP")
    Rel(editorAPI, sceneFiles, "read / write marker blocks", "fs/promises")
    Rel(game, sceneFiles, "imports tile data", "ES module")
    Rel(game, tileDefs, "imports", "ES module")
    Rel(editorUI, tileDefs, "imports", "ES module")
```

→ Rationale: [ADR 0004 — Single shared module between editor and game](documents/decisions/0004-single-shared-module-boundary.md)

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
