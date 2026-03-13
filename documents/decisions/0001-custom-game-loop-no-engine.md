# ADR 0001 — Custom game loop, no engine

**Status:** Accepted

## Context

A browser JRPG could be built on top of Phaser, Kaboom, PixiJS, or a similar framework. These engines handle asset loading, scene management, input, and rendering. They also carry opinions about all of those things, plus upgrade paths, community norms, and a non-trivial learning curve.

The collaborator is a senior frontend engineer — someone who already understands the DOM, the event loop, requestAnimationFrame, and TypeScript. The game is small in scope (one map, one enemy type, turn-based combat). The interesting problems are the game logic, not the rendering infrastructure.

## Decision

Write a custom game loop from scratch. No engine dependencies.

The loop is a standard browser pattern: requestAnimationFrame, a delta-time accumulator capped to prevent spiral-of-death on tab blur, and a clean split between update (pure, testable) and render (side effects only). Scenes are plain objects that implement a known interface. The scene manager is a stack.

## Consequences

We own everything. Game state, input, scene lifecycle — none of it is mediated by a framework. The code is readable to anyone who knows TypeScript.

The tradeoff: we write the boilerplate. Asset loading, audio, and anything else we need has to be built or imported explicitly. For a jam, this is acceptable because the scope is bounded and the team is experienced enough to not need scaffolding.

If the scope grows beyond what a custom loop can handle cheaply, the decision should be revisited. The architecture does not make switching to an engine impossible — scenes are plain objects, not engine subclasses.
