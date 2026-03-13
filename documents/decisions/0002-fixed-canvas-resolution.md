# ADR 0002 — Fixed internal canvas resolution

**Status:** Accepted

## Context

The game renders onto an HTML canvas. There are two approaches to sizing that canvas:

**Dynamic:** resize the canvas buffer to match the browser window on every resize event. The rendered area grows and shrinks with the viewport.

**Fixed:** set the canvas buffer to a constant resolution. Scale it up to fill the viewport with CSS. The rendered area is always the same number of pixels in game-world terms.

The dynamic approach seems natural. It is also a trap.

When the canvas matches the viewport exactly, the entire map fits on screen. The camera clamp always returns zero offset. The map never scrolls — no matter how correct the camera code is. This is a bug that presents as a design problem and is hard to trace back to the canvas sizing decision.

## Decision

Fix the canvas buffer at a constant resolution and scale with CSS. The canvas dimensions are game-world constants, not properties of the browser window.

## Consequences

Camera math is predictable. Pixel art renders crisply because CSS scaling is integer-multiple-friendly and image-rendering handles the rest. The visible area in tiles is deterministic — you can reason about what the player sees without knowing anything about the screen.

The tradeoff: the visible area is fixed. A player on a large monitor sees the same game-world area as a player on a small one. For a tile-based JRPG in a jam, this is a non-issue. If we ever want a larger viewport, we change the constants — the architecture does not need to change.
