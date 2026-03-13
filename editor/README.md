# Editor Tools

Dev-only authoring tools for the JRPG. Run alongside the game and never ship with it.

## Prerequisites

1. **Vite dev server** — serves the game and editor pages
2. **API server** — Hono on port 3001, handles file I/O for both editors

```bash
# Terminal 1: Vite dev server
npm run dev

# Terminal 2: Editor API server
npm run dev:server
```

## Access URLs

With both servers running:

| Tool | URL |
|------|-----|
| **Map editor** | http://localhost:5173/editor |
| **Tile editor** | http://localhost:5173/editor/tile-editor |

## Map Editor

Paints tile maps and places spawn points. Writes to `src/world/maps/*.ts`. See `documents/map-editor-spec.md`.

## Tile Editor

Authors terrain types, blob rulesets, and the tilesheet. Writes to `src/world/tiles.ts` and `src/assets/tilesheet.png`. See `documents/tile-editor-spec.md`.

## Structure

```
editor/
├── index.html          # Map editor entry
├── main.ts             # Map editor logic
├── tile-editor/
│   ├── index.html      # Tile editor entry
│   └── main.ts         # Tile editor logic
├── server/             # Hono API (shared by both)
└── README.md           # This file
```
