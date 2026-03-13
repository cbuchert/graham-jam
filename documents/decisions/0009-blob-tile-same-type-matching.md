# ADR 0009 — Blob tile ruleset: same-type matching

**Status:** Accepted

## Context

The tile editor authors blob rulesets — a mapping from each of the 16 cardinal bitmask configurations to a variant index and optional flip flags. At runtime, the tilemap renderer must compute a bitmask for each tile on the map and look up the correct variant to draw.

The bitmask computation requires a definition of "what counts as a matching neighbour." Two models exist:

**Same-type matching:** A tile's bitmask only counts neighbours of the *same* terrain type. A grass tile next to a water tile treats that edge as unconnected (bit = 0). Each terrain type has an independent ruleset. Types have no knowledge of each other.

**Cross-type compatibility:** A terrain type defines which *other* types count as a match when computing its bitmask. Grass and forest could share a compatibility group, causing them to connect smoothly. Godot 4's terrain system and some commercial tileset tools support this model.

## Decision

The runtime tile resolver uses same-type matching. A tile at `(row, col)` of type `T` computes its bitmask by checking whether each cardinal neighbour is also type `T`. The ruleset for `T` is looked up with that bitmask to select a variant and flip flags.

Cross-type transitions are handled at the content level: a designer creates a dedicated terrain type (e.g. `shore`) whose variants are painted to visually bridge the boundary between two other types. The `shore` terrain has its own same-type ruleset and is placed manually in the map editor.

## Consequences

The resolver is simple: one comparison per cardinal direction, one ruleset lookup per tile. No compatibility matrix, no inter-type dependency at runtime.

Smooth transitions between terrain types require explicit transition terrain types. This is the approach used in FF5/FF6 and classic JRPG tilesets — it gives complete visual control at the cost of more terrain types to author. For a jam this is the right tradeoff.

The export format (`src/world/tiles.ts`) must include each terrain type's ruleset as a `Record<number, { frameIdx: number; flipX: boolean; flipY: boolean }>` alongside its variant pixel data. The runtime resolver reads this record directly.

---

*See also: [ADR 0004](0004-single-shared-module-boundary.md) — `tiles.ts` as the contract between tile editor and game runtime.*
