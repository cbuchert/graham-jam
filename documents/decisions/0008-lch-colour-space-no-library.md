# ADR 0008 — LCH colour space for palette authoring; hand-rolled conversion

**Status:** Accepted

## Context

The tile editor needs a colour picker for authoring pixel art terrain palettes. The choice of colour space and implementation approach are both decisions with downstream consequences.

**HSL / HSV:** The default choice for browser colour tools. Simple to implement, familiar to developers. The problem: HSL and HSV are not perceptually uniform. Equal numerical distances between colours do not correspond to equal perceived differences. A yellow at 50% lightness appears far brighter than a blue at 50% lightness. Building a coherent pixel art palette in HSL means fighting the colour space — carefully tuned values in one hue look wrong next to equally-tuned values in another.

**CIE LCH (Lightness, Chroma, Hue):** A cylindrical representation of the CIELAB colour space, which is perceptually uniform by design. Equal numerical distances in LCH correspond to roughly equal perceived colour differences regardless of hue. This makes it natural to build harmonious palettes: hold L and C constant while varying H, and the swatches genuinely look like a coherent set. This is how professional colour tools (Oklch, CSS Color Level 4) are moving.

**External library vs. hand-rolled:** A library like `culori` provides battle-tested LCH conversion. It also adds a dependency that needs to be justified (see ADR 0001). The CIE LCH → sRGB conversion path is well-specified mathematics: LCH → Lab → XYZ D65 → linear sRGB → gamma-corrected sRGB. It fits in ~30 lines and has no edge cases beyond clamping out-of-gamut values to `[0, 255]`.

## Decision

Use CIE LCH as the colour model for the tile editor's colour picker. Implement the conversion from LCH to sRGB as a hand-rolled pure function — no external colour library.

The picker exposes L (0–100), C (0–150), and H (0–359) sliders. The native OS colour picker (`<input type="color">`) is also available as an escape hatch — clicking the colour preview opens it, and its output is accepted as a `hexOverride` that bypasses the LCH sliders until the developer moves a slider again.

## Consequences

Palette authoring works in a perceptually uniform space. A developer who holds L=65 and C=50 while sweeping H gets a set of colours that appear equally saturated and bright across hues — a useful property for building terrain colour families that read well at small tile sizes.

The conversion function is ~30 lines of pure TypeScript with no dependencies. It is straightforward to test and maintain. Out-of-gamut colours (LCH combinations that don't map to valid sRGB) are clamped — the result is a valid colour, not a crash.

The `hexOverride` escape hatch means the OS picker can be used for any colour without disrupting the LCH workflow. The override is cleared the moment any LCH slider moves, keeping the two modes cleanly separated.

The tradeoff: LCH to RGB is one-directional in this implementation. Colours picked via the native picker are stored as hex and cannot be round-tripped back to LCH values. Developers who pick colours via the native picker lose the ability to make perceptual adjustments via sliders until they manually re-enter LCH values. This is acceptable for a jam-scope tool.

---

*See also: [ADR 0001](0001-custom-game-loop-no-engine.md) — no engine dependencies; same principle extends to no colour library dependencies.*
