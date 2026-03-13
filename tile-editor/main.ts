// tile-editor/main.ts
// Paint mode for authoring 16×16 terrain frames.
// Pixel data lives in localStorage. The Hono API is only called on export (Milestone 8).

// ---------------------------------------------------------------------------
// Types

interface TileDefinition {
  id: number
  type: string
  name: string
  solid: boolean
  editorColour: string
}

interface LchColour {
  l: number
  c: number
  h: number
}

// ---------------------------------------------------------------------------
// Constants

const API =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001"
const FRAME_SIZE = 16
const ZOOM_STEPS = [4, 8, 12, 16, 24, 32]
const MAX_USED_COLOURS = 32

const lsFramesKey = (type: string) => `te:frames:${type}`
const LS_USED_COLOURS = "te:usedcolours"
const LS_REGISTRY = "te:registry"

// ---------------------------------------------------------------------------
// State

let terrainTypes: TileDefinition[] = []
let activeTerrain: string | null = null
let activeFrameIdx = 0
let zoomIdx = 3 // ZOOM_STEPS[3] = 16×
let lchColour: LchColour = { l: 70, c: 40, h: 200 }
let isPainting = false
// When a swatch is clicked we store its hex directly and bypass LCH sliders.
// Cleared whenever any LCH slider moves.
let hexOverride: string | null = null

const currentZoom = () => ZOOM_STEPS[zoomIdx]

// ---------------------------------------------------------------------------
// localStorage helpers

function loadFrames(type: string): number[][] {
  const raw = localStorage.getItem(lsFramesKey(type))
  if (!raw) return []
  try {
    return JSON.parse(raw) as number[][]
  } catch {
    return []
  }
}

function saveFrames(type: string, frames: number[][]): void {
  localStorage.setItem(lsFramesKey(type), JSON.stringify(frames))
}

function getFrame(type: string, idx: number): number[] {
  const frames = loadFrames(type)
  return frames[idx] ?? new Array(FRAME_SIZE * FRAME_SIZE * 4).fill(0)
}

function setFrame(type: string, idx: number, data: number[]): void {
  const frames = loadFrames(type)
  while (frames.length <= idx) {
    frames.push(new Array(FRAME_SIZE * FRAME_SIZE * 4).fill(0))
  }
  frames[idx] = data
  saveFrames(type, frames)
}

function loadUsedColours(): string[] {
  const raw = localStorage.getItem(LS_USED_COLOURS)
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Working registry (te:registry) — terrain metadata, mutable, exported on demand

function loadRegistry(): TileDefinition[] {
  const raw = localStorage.getItem(LS_REGISTRY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as TileDefinition[]
  } catch {
    return []
  }
}

function saveRegistry(types: TileDefinition[]): void {
  localStorage.setItem(LS_REGISTRY, JSON.stringify(types))
}

function nextRegistryId(types: TileDefinition[]): number {
  return types.length === 0 ? 0 : Math.max(...types.map((t) => t.id)) + 1
}

function addTerrainType(
  typeId: string,
  name: string,
  solid: boolean,
  colour: string,
): void {
  const types = loadRegistry()
  const id = nextRegistryId(types)
  types.push({ id, type: typeId, name, solid, editorColour: colour })
  saveRegistry(types)
  terrainTypes = types
  buildTerrainSidebar()
  setActiveTerrain(typeId)
}

function renameTerrainType(typeId: string, newName: string): void {
  const types = loadRegistry().map((t) =>
    t.type === typeId ? { ...t, name: newName } : t,
  )
  saveRegistry(types)
  terrainTypes = types
  buildTerrainSidebar()
}

function deleteTerrainType(typeId: string): void {
  const types = loadRegistry().filter((t) => t.type !== typeId)
  saveRegistry(types)
  localStorage.removeItem(lsFramesKey(typeId))
  terrainTypes = types
  if (activeTerrain === typeId) {
    activeTerrain = types.length > 0 ? types[0].type : null
    activeFrameIdx = 0
    if (activeTerrain) {
      canvasEmpty.style.display = "none"
      paintCanvas.style.display = "block"
    } else {
      canvasEmpty.style.display = ""
      paintCanvas.style.display = "none"
    }
  }
  buildTerrainSidebar()
  renderFramePanel()
  renderPaintCanvas()
}

function recordUsedColour(hex: string): void {
  const deduped = loadUsedColours().filter((h) => h !== hex)
  localStorage.setItem(
    LS_USED_COLOURS,
    JSON.stringify([hex, ...deduped].slice(0, MAX_USED_COLOURS)),
  )
  renderUsedColours()
}

// Replaces the used-colours list with all unique colours present across every
// variant in the active terrain family. Called on terrain/variant switch so
// the palette reflects the full colour set for this tile type.
function refreshColoursFromCurrentFrame(): void {
  if (!activeTerrain) return
  const frames = loadFrames(activeTerrain)
  const seen = new Set<string>()
  for (const data of frames) {
    for (let i = 0; i < FRAME_SIZE * FRAME_SIZE; i++) {
      const a = data[i * 4 + 3] ?? 0
      if (a === 0) continue
      const r = data[i * 4] ?? 0
      const g = data[i * 4 + 1] ?? 0
      const b = data[i * 4 + 2] ?? 0
      seen.add(rgbToHex(r, g, b))
    }
  }
  localStorage.setItem(
    LS_USED_COLOURS,
    JSON.stringify([...seen].slice(0, MAX_USED_COLOURS)),
  )
  renderUsedColours()
}

// ---------------------------------------------------------------------------
// Colour helpers

// sRGB hex → CIE LCH — reverse of lchToRgb, used to sync sliders when a
// colour is picked via swatch or OS picker.
function hexToLch(hex: string): LchColour {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const lin = (v: number) =>
    v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92

  const rl = lin(r),
    gl = lin(g),
    bl = lin(b)
  const x = rl * 0.4124 + gl * 0.3576 + bl * 0.1805
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722
  const z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505

  const fwd = (t: number) =>
    t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116
  const fx = fwd(x / 0.95047),
    fy = fwd(y / 1.0),
    fz = fwd(z / 1.08883)
  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const bv = 200 * (fy - fz)

  const C = Math.sqrt(a * a + bv * bv)
  let H = (Math.atan2(bv, a) * 180) / Math.PI
  if (H < 0) H += 360

  return {
    l: Math.round(Math.max(0, Math.min(100, L))),
    c: Math.round(Math.max(0, Math.min(150, C))),
    h: Math.round(H) % 360,
  }
}

// CIE LCH → Lab → XYZ D65 → linear sRGB → gamma-corrected sRGB
function lchToRgb(
  l: number,
  c: number,
  h: number,
): { r: number; g: number; b: number } {
  const hRad = (h * Math.PI) / 180
  const a = c * Math.cos(hRad)
  const b = c * Math.sin(hRad)

  const fy = (l + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200

  // Inverse of the Lab cube-root compress function
  const finv = (f: number) => (f > 0.206897 ? f ** 3 : (f - 16 / 116) / 7.787)

  const x = 0.95047 * finv(fx)
  const y = 1.0 * finv(fy)
  const z = 1.08883 * finv(fz)

  // XYZ → linear sRGB (sRGB matrix, D65)
  const r = x * 3.2406 + y * -1.5372 + z * -0.4986
  const g = x * -0.9689 + y * 1.8758 + z * 0.0415
  const bv = x * 0.0557 + y * -0.204 + z * 1.057

  // sRGB gamma
  const gamma = (v: number) =>
    v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v

  return {
    r: Math.round(Math.max(0, Math.min(255, gamma(r) * 255))),
    g: Math.round(Math.max(0, Math.min(255, gamma(g) * 255))),
    b: Math.round(Math.max(0, Math.min(255, gamma(bv) * 255))),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

// Active paint colour as {r,g,b} — respects the swatch hex override.
function activePaintRgb(): { r: number; g: number; b: number } {
  if (hexOverride) {
    const hex = hexOverride
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    }
  }
  return lchToRgb(lchColour.l, lchColour.c, lchColour.h)
}

function activePaintHex(): string {
  const { r, g, b } = activePaintRgb()
  return rgbToHex(r, g, b)
}

// ---------------------------------------------------------------------------
// DOM refs

const terrainSidebar = document.getElementById("terrain-sidebar") as HTMLElement
const canvasEmpty = document.getElementById("canvas-empty") as HTMLElement
const paintCanvas = document.getElementById("paint-canvas") as HTMLCanvasElement
const paintCtx = paintCanvas.getContext("2d")
if (!paintCtx) throw new Error("canvas 2d unavailable")
const zoomLabel = document.getElementById("zoom-label") as HTMLElement
const frameList = document.getElementById("frame-list") as HTMLElement
const colourPreview = document.getElementById("colour-preview") as HTMLElement
const nativeColourPicker = document.getElementById(
  "native-colour-picker",
) as HTMLInputElement
const colourRgb = document.getElementById("colour-rgb") as HTMLElement
const swatchGrid = document.getElementById("swatch-grid") as HTMLElement
const lchLInput = document.getElementById("lch-l") as HTMLInputElement
const lchCInput = document.getElementById("lch-c") as HTMLInputElement
const lchHInput = document.getElementById("lch-h") as HTMLInputElement
const lchLVal = document.getElementById("lch-l-val") as HTMLElement
const lchCVal = document.getElementById("lch-c-val") as HTMLElement
const lchHVal = document.getElementById("lch-h-val") as HTMLElement

// ---------------------------------------------------------------------------
// Terrain sidebar

// Inserts terrain buttons before the footer element.
function buildTerrainSidebar(): void {
  const footer = terrainSidebar.querySelector(".terrain-sidebar__footer")
  for (const el of Array.from(
    terrainSidebar.querySelectorAll(".terrain-btn,.terrain-sidebar__msg"),
  )) {
    el.remove()
  }
  for (const t of terrainTypes) {
    const row = document.createElement("div")
    row.className = `terrain-btn${activeTerrain === t.type ? " terrain-btn--active" : ""}`

    const swatch = document.createElement("span")
    swatch.className = "terrain-btn__swatch"
    swatch.style.background = t.editorColour

    const nameSpan = document.createElement("span")
    nameSpan.className = "terrain-btn__name"
    nameSpan.textContent = t.name
    nameSpan.title = t.name

    const renameBtn = document.createElement("button")
    renameBtn.type = "button"
    renameBtn.className = "terrain-btn__icon"
    renameBtn.textContent = "✎"
    renameBtn.title = "Rename"

    const delBtn = document.createElement("button")
    delBtn.type = "button"
    delBtn.className = "terrain-btn__icon terrain-btn__icon--del"
    delBtn.textContent = "×"
    delBtn.title = "Delete"

    // Clicking the row body selects the terrain
    row.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button") === null) {
        setActiveTerrain(t.type)
      }
    })
    swatch.addEventListener("click", () => setActiveTerrain(t.type))
    nameSpan.addEventListener("click", () => setActiveTerrain(t.type))

    // Rename: replace nameSpan with an input
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      const input = document.createElement("input")
      input.className = "terrain-btn__rename-input"
      input.value = t.name
      input.type = "text"
      nameSpan.replaceWith(input)
      renameBtn.style.display = "none"
      input.focus()
      input.select()
      const commit = () => {
        const trimmed = input.value.trim()
        if (trimmed && trimmed !== t.name) renameTerrainType(t.type, trimmed)
        else buildTerrainSidebar()
      }
      input.addEventListener("blur", commit)
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault()
          commit()
        }
        if (ev.key === "Escape") buildTerrainSidebar()
      })
    })

    // Delete: check usage, then confirm
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation()
      if (delBtn.dataset.confirm === "1") {
        deleteTerrainType(t.type)
        return
      }
      delBtn.textContent = "…"
      delBtn.disabled = true
      try {
        const res = await fetch(`${API}/api/tiles/usage/${t.type}`)
        if (!res.ok) throw new Error(`${res.status}`)
        const { inUse, maps } = (await res.json()) as {
          inUse: boolean
          maps: string[]
        }
        if (inUse) {
          showSidebarError(`"${t.name}" is used by: ${maps.join(", ")}`)
          delBtn.textContent = "×"
          delBtn.disabled = false
        } else {
          delBtn.textContent = "del?"
          delBtn.dataset.confirm = "1"
          delBtn.disabled = false
          // Auto-cancel after 4 s
          setTimeout(() => {
            if (delBtn.dataset.confirm === "1") {
              delBtn.textContent = "×"
              delete delBtn.dataset.confirm
            }
          }, 4000)
        }
      } catch {
        showSidebarError("Could not check usage (is the server running?)")
        delBtn.textContent = "×"
        delBtn.disabled = false
      }
    })

    row.appendChild(swatch)
    row.appendChild(nameSpan)
    row.appendChild(renameBtn)
    row.appendChild(delBtn)
    terrainSidebar.insertBefore(row, footer ?? null)
  }
}

function showSidebarError(msg: string): void {
  const existing = terrainSidebar.querySelector(".terrain-sidebar__msg")
  if (existing) existing.remove()
  const el = document.createElement("div")
  el.className = "terrain-sidebar__msg terrain-sidebar__msg--error"
  el.textContent = msg
  const footer = terrainSidebar.querySelector(".terrain-sidebar__footer")
  terrainSidebar.insertBefore(el, footer ?? null)
  setTimeout(() => el.remove(), 5000)
}

function setActiveTerrain(type: string): void {
  activeTerrain = type
  activeFrameIdx = 0
  buildTerrainSidebar()
  renderFramePanel()
  canvasEmpty.style.display = "none"
  paintCanvas.style.display = editorMode === "paint" ? "block" : "none"
  if (editorMode === "paint") renderPaintCanvas()
  else renderRulesetGrid()
  refreshColoursFromCurrentFrame()
}

// ---------------------------------------------------------------------------
// Frame panel

function renderFramePanel(): void {
  frameList.innerHTML = ""
  if (!activeTerrain) return

  const frames = loadFrames(activeTerrain)
  for (let i = 0; i < frames.length; i++) {
    frameList.appendChild(buildFrameSlot(i, frames[i]))
  }
}

function buildFrameSlot(idx: number, pixelData: number[]): HTMLElement {
  const slot = document.createElement("div")
  slot.className = `frame-slot${idx === activeFrameIdx ? " frame-slot--active" : ""}`

  const thumb = document.createElement("canvas")
  thumb.className = "frame-slot__canvas"
  thumb.width = FRAME_SIZE
  thumb.height = FRAME_SIZE
  renderThumbnail(thumb, pixelData)
  slot.appendChild(thumb)

  const del = document.createElement("button")
  del.type = "button"
  del.className = "frame-slot__del"
  del.textContent = "✕"
  del.title = "Delete variant"
  del.addEventListener("click", (e) => {
    e.stopPropagation()
    deleteFrame(idx)
  })
  slot.appendChild(del)

  slot.addEventListener("click", () => setActiveFrame(idx))
  return slot
}

function renderThumbnail(canvas: HTMLCanvasElement, pixelData: number[]): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const img = ctx.createImageData(FRAME_SIZE, FRAME_SIZE)
  for (let i = 0; i < pixelData.length; i++) {
    img.data[i] = pixelData[i]
  }
  ctx.putImageData(img, 0, 0)
}

function setActiveFrame(idx: number): void {
  activeFrameIdx = idx
  renderFramePanel()
  renderPaintCanvas()
  refreshColoursFromCurrentFrame()
}

function addFrame(): void {
  if (!activeTerrain) return
  const frames = loadFrames(activeTerrain)
  frames.push(new Array(FRAME_SIZE * FRAME_SIZE * 4).fill(0))
  saveFrames(activeTerrain, frames)
  activeFrameIdx = frames.length - 1
  renderFramePanel()
  renderPaintCanvas()
}

function deleteFrame(idx: number): void {
  if (!activeTerrain) return
  const frames = loadFrames(activeTerrain)
  if (frames.length === 0) return
  frames.splice(idx, 1)
  saveFrames(activeTerrain, frames)
  if (activeFrameIdx >= frames.length) {
    activeFrameIdx = Math.max(0, frames.length - 1)
  }
  renderFramePanel()
  renderPaintCanvas()
}

// ---------------------------------------------------------------------------
// Paint canvas rendering

function renderPaintCanvas(): void {
  const S = FRAME_SIZE
  const Z = currentZoom()
  paintCanvas.width = S * Z
  paintCanvas.height = S * Z

  const data = activeTerrain ? getFrame(activeTerrain, activeFrameIdx) : []

  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const offset = (py * S + px) * 4
      const r = data[offset] ?? 0
      const g = data[offset + 1] ?? 0
      const b = data[offset + 2] ?? 0
      const a = data[offset + 3] ?? 0

      paintCtx.clearRect(px * Z, py * Z, Z, Z)
      if (a > 0) {
        paintCtx.fillStyle = `rgba(${r},${g},${b},${a / 255})`
        paintCtx.fillRect(px * Z, py * Z, Z, Z)
      }
    }
  }

  // Grid overlay only at usable zoom levels
  if (Z >= 8) {
    paintCtx.strokeStyle = "rgba(0,0,0,0.2)"
    paintCtx.lineWidth = 0.5
    for (let i = 1; i < S; i++) {
      paintCtx.beginPath()
      paintCtx.moveTo(i * Z, 0)
      paintCtx.lineTo(i * Z, S * Z)
      paintCtx.stroke()
      paintCtx.beginPath()
      paintCtx.moveTo(0, i * Z)
      paintCtx.lineTo(S * Z, i * Z)
      paintCtx.stroke()
    }
  }
}

// ---------------------------------------------------------------------------
// Painting — single function, uses activePaintRgb()

function canvasToPixel(e: MouseEvent): { px: number; py: number } | null {
  const rect = paintCanvas.getBoundingClientRect()
  const scaleX = paintCanvas.width / rect.width
  const scaleY = paintCanvas.height / rect.height
  const cx = (e.clientX - rect.left) * scaleX
  const cy = (e.clientY - rect.top) * scaleY
  const px = Math.floor(cx / currentZoom())
  const py = Math.floor(cy / currentZoom())
  if (px < 0 || px >= FRAME_SIZE || py < 0 || py >= FRAME_SIZE) return null
  return { px, py }
}

function paintAt(e: MouseEvent): void {
  if (!activeTerrain) return
  const coords = canvasToPixel(e)
  if (!coords) return

  const { px, py } = coords
  const frameData = [...getFrame(activeTerrain, activeFrameIdx)]
  const offset = (py * FRAME_SIZE + px) * 4
  const { r, g, b } = activePaintRgb()

  frameData[offset] = r
  frameData[offset + 1] = g
  frameData[offset + 2] = b
  frameData[offset + 3] = 255

  setFrame(activeTerrain, activeFrameIdx, frameData)
  renderPaintCanvas()
  renderPreview()

  // Update thumbnail in-place rather than rebuilding the whole panel
  const slot = frameList.querySelectorAll(".frame-slot")[activeFrameIdx]
  const thumb = slot?.querySelector<HTMLCanvasElement>(".frame-slot__canvas")
  if (thumb) renderThumbnail(thumb, frameData)
}

paintCanvas.addEventListener("mousedown", (e) => {
  isPainting = true
  paintAt(e)
  recordUsedColour(activePaintHex())
})
paintCanvas.addEventListener("mousemove", (e) => {
  if (isPainting) paintAt(e)
})
paintCanvas.addEventListener("mouseup", () => {
  isPainting = false
})
paintCanvas.addEventListener("mouseleave", () => {
  isPainting = false
})

// ---------------------------------------------------------------------------
// Colour picker

function updateColourUI(): void {
  const hex =
    hexOverride ??
    (() => {
      const { r, g, b } = lchToRgb(lchColour.l, lchColour.c, lchColour.h)
      return rgbToHex(r, g, b)
    })()

  colourPreview.style.background = hex
  nativeColourPicker.value = hex
  colourRgb.textContent = hex

  // lchColour is always in sync (applyColourHex keeps it updated), so we
  // can always show real values — no more stale dashes.
  lchLVal.textContent = String(lchColour.l)
  lchCVal.textContent = String(lchColour.c)
  lchHVal.textContent = String(lchColour.h)
}

// Native OS colour picker — clicking the preview swatch opens it
nativeColourPicker.addEventListener("input", () => {
  applyColourHex(nativeColourPicker.value)
  clearSwatchActive()
})

function onSliderInput(): void {
  hexOverride = null
  lchColour = {
    l: Number(lchLInput.value),
    c: Number(lchCInput.value),
    h: Number(lchHInput.value),
  }
  clearSwatchActive()
  updateColourUI()
}

lchLInput.addEventListener("input", onSliderInput)
lchCInput.addEventListener("input", onSliderInput)
lchHInput.addEventListener("input", onSliderInput)

// ---------------------------------------------------------------------------
// Used colours

// Single entry point for any colour source that provides a hex value.
// Syncs lchColour AND slider thumb positions so the UI stays consistent.
// hexOverride is retained so activePaintRgb paints the exact chosen colour
// rather than the LCH-round-tripped approximation.
function applyColourHex(hex: string): void {
  hexOverride = hex
  lchColour = hexToLch(hex)
  lchLInput.value = String(lchColour.l)
  lchCInput.value = String(lchColour.c)
  lchHInput.value = String(lchColour.h)
  updateColourUI()
}

function selectSwatchHex(hex: string): void {
  applyColourHex(hex)
  for (const btn of swatchGrid.querySelectorAll<HTMLButtonElement>(
    ".swatch-btn",
  )) {
    btn.classList.toggle("swatch-btn--active", btn.dataset.hex === hex)
  }
}

function clearSwatchActive(): void {
  for (const btn of swatchGrid.querySelectorAll<HTMLButtonElement>(
    ".swatch-btn",
  )) {
    btn.classList.remove("swatch-btn--active")
  }
}

function renderUsedColours(): void {
  swatchGrid.innerHTML = ""
  loadUsedColours().forEach((hex, i) => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "swatch-btn"
    btn.style.background = hex
    btn.dataset.hex = hex
    if (hexOverride === hex) btn.classList.add("swatch-btn--active")
    const shortcut = i < 9 ? String(i + 1) : null
    btn.title = shortcut ? `${hex}  [${shortcut}]` : hex
    if (shortcut) btn.dataset.shortcut = shortcut
    btn.addEventListener("click", () => selectSwatchHex(hex))
    swatchGrid.appendChild(btn)
  })
}

// Keyboard shortcuts 1–9 quick-select the corresponding swatch.
// Guard against firing while the user is typing in an input.
document.addEventListener("keydown", (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  )
    return
  const idx = Number(e.key) - 1
  if (idx < 0 || idx > 8) return
  const swatches = swatchGrid.querySelectorAll<HTMLButtonElement>(".swatch-btn")
  const target = swatches[idx]
  if (!target) return
  const hex = target.dataset.hex
  if (hex) selectSwatchHex(hex)
})

// ---------------------------------------------------------------------------
// Zoom controls

const zoomOutBtn = document.getElementById("zoom-out") as HTMLButtonElement
const zoomInBtn = document.getElementById("zoom-in") as HTMLButtonElement
const fillBtn = document.getElementById("fill-btn") as HTMLButtonElement
const addFrameBtn = document.getElementById(
  "add-frame-btn",
) as HTMLButtonElement
const deleteFrameBtn = document.getElementById(
  "delete-frame-btn",
) as HTMLButtonElement

zoomOutBtn.addEventListener("click", () => {
  if (zoomIdx > 0) {
    zoomIdx--
    zoomLabel.textContent = `${currentZoom()}×`
    renderPaintCanvas()
  }
})

zoomInBtn.addEventListener("click", () => {
  if (zoomIdx < ZOOM_STEPS.length - 1) {
    zoomIdx++
    zoomLabel.textContent = `${currentZoom()}×`
    renderPaintCanvas()
  }
})

// ---------------------------------------------------------------------------
// Frame panel buttons

fillBtn.addEventListener("click", () => {
  if (!activeTerrain) return
  const { r, g, b } = activePaintRgb()
  const filled = new Array(FRAME_SIZE * FRAME_SIZE * 4)
  for (let i = 0; i < FRAME_SIZE * FRAME_SIZE; i++) {
    filled[i * 4] = r
    filled[i * 4 + 1] = g
    filled[i * 4 + 2] = b
    filled[i * 4 + 3] = 255
  }
  setFrame(activeTerrain, activeFrameIdx, filled)
  recordUsedColour(activePaintHex())
  renderPaintCanvas()
  renderFramePanel()
})

addFrameBtn.addEventListener("click", addFrame)
deleteFrameBtn.addEventListener("click", () => {
  if (activeTerrain) deleteFrame(activeFrameIdx)
})

// ---------------------------------------------------------------------------
// Ruleset mode

type EditorMode = "paint" | "ruleset" | "preview"
let editorMode: EditorMode = "paint"

const BITMASK_LABELS = [
  "∅",
  "N",
  "E",
  "NE",
  "S",
  "NS",
  "ES",
  "NES",
  "W",
  "NW",
  "EW",
  "NEW",
  "SW",
  "NSW",
  "ESW",
  "NESW",
]

// Diamond layout: each config sits at its compass position relative to ∅ at
// center. Row/col are 1-based CSS grid coordinates in a 5×5 grid.
//
//   col:  1     2     3     4     5
//  row 1:             NEW(11)
//  row 2:        NW(9)  N(1) NE(3)
//  row 3: NSW(13)  W(8)  ∅(0)  E(2) NES(7)
//  row 4:        SW(12)  S(4) ES(6)
//  row 5:             ESW(14)
//
// NS(5), EW(10), NESW(15) have no dominant direction; they go in a
// separate extras row below the diamond.
const BITMASK_DIAMOND_POS: Record<number, { row: number; col: number }> = {
  11: { row: 1, col: 3 }, // NEW
  9: { row: 2, col: 2 }, // NW
  1: { row: 2, col: 3 }, // N
  3: { row: 2, col: 4 }, // NE
  13: { row: 3, col: 1 }, // NSW
  8: { row: 3, col: 2 }, // W
  0: { row: 3, col: 3 }, // ∅
  2: { row: 3, col: 4 }, // E
  7: { row: 3, col: 5 }, // NES
  12: { row: 4, col: 2 }, // SW
  4: { row: 4, col: 3 }, // S
  6: { row: 4, col: 4 }, // ES
  14: { row: 5, col: 3 }, // ESW
}

const BITMASK_EXTRAS = [5, 10, 15] // NS, EW, NESW

interface RulesetAssignment {
  frameIdx: number
  flipX: boolean
  flipY: boolean
  mirrorOf?: number // bitmask of the config this was derived from, if any
}

const lsRulesetKey = (type: string) => `te:ruleset:${type}`

function loadRuleset(type: string): Record<number, RulesetAssignment> {
  const raw = localStorage.getItem(lsRulesetKey(type))
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<number, RulesetAssignment>
  } catch {
    return {}
  }
}

function saveRuleset(
  type: string,
  ruleset: Record<number, RulesetAssignment>,
): void {
  localStorage.setItem(lsRulesetKey(type), JSON.stringify(ruleset))
}

function getRulesetConfig(
  type: string,
  bitmask: number,
): RulesetAssignment | undefined {
  return loadRuleset(type)[bitmask]
}

function setRulesetConfig(
  type: string,
  bitmask: number,
  assignment: RulesetAssignment,
): void {
  const ruleset = loadRuleset(type)
  ruleset[bitmask] = assignment
  saveRuleset(type, ruleset)
}

function unsetRulesetConfig(type: string, bitmask: number): void {
  const ruleset = loadRuleset(type)
  delete ruleset[bitmask]
  saveRuleset(type, ruleset)
}

// Swap E(bit1=2) ↔ W(bit3=8); N and S unchanged
function flipXBitmask(k: number): number {
  return (k & 0b0101) | ((k & 0b0010) << 2) | ((k & 0b1000) >> 2)
}

// Swap N(bit0=1) ↔ S(bit2=4); E and W unchanged
function flipYBitmask(k: number): number {
  return (k & 0b1010) | ((k & 0b0001) << 2) | ((k & 0b0100) >> 2)
}

// Copy source assignment to target with flip flags adjusted for the geometric
// relationship between the two bitmasks.
function setAsMirrorOf(targetBitmask: number, sourceBitmask: number): void {
  if (!activeTerrain) return
  const src = getRulesetConfig(activeTerrain, sourceBitmask)
  if (!src) return

  let { flipX, flipY } = src
  if (targetBitmask === flipXBitmask(sourceBitmask)) {
    flipX = !src.flipX
  } else if (targetBitmask === flipYBitmask(sourceBitmask)) {
    flipY = !src.flipY
  } else if (targetBitmask === flipXBitmask(flipYBitmask(sourceBitmask))) {
    flipX = !src.flipX
    flipY = !src.flipY
  }
  setRulesetConfig(activeTerrain, targetBitmask, {
    frameIdx: src.frameIdx,
    flipX,
    flipY,
    mirrorOf: sourceBitmask,
  })
  renderRulesetGrid()
}

function buildDiagram(bitmask: number): HTMLElement {
  const grid = document.createElement("div")
  grid.className = "config-diagram"
  const N = (bitmask & 1) !== 0
  const E = (bitmask & 2) !== 0
  const S = (bitmask & 4) !== 0
  const W = (bitmask & 8) !== 0
  const types = [
    "corner",
    N ? "on" : "off",
    "corner",
    W ? "on" : "off",
    "center",
    E ? "on" : "off",
    "corner",
    S ? "on" : "off",
    "corner",
  ]
  for (const t of types) {
    const c = document.createElement("div")
    c.className = `config-diagram__cell config-diagram__cell--${t}`
    grid.appendChild(c)
  }
  return grid
}

function buildConfigCell(
  bitmask: number,
  terrain: string,
  mirrorSources: Set<number>,
): HTMLElement {
  const assignment = getRulesetConfig(terrain, bitmask)
  const isAssigned = assignment !== undefined
  const isMirrorSource = mirrorSources.has(bitmask)

  const classes = ["config-cell"]
  if (isAssigned) classes.push("config-cell--assigned")
  if (isMirrorSource) classes.push("config-cell--mirror-source")

  const cell = document.createElement("div")
  cell.className = classes.join(" ")

  // Header row: label + unassign button
  const header = document.createElement("div")
  header.className = "config-cell__header"
  const label = document.createElement("span")
  label.className = "config-cell__label"
  label.textContent = `${BITMASK_LABELS[bitmask]} (${bitmask})`
  header.appendChild(label)
  if (isAssigned) {
    const unassignBtn = document.createElement("button")
    unassignBtn.type = "button"
    unassignBtn.className = "config-cell__unassign"
    unassignBtn.textContent = "×"
    unassignBtn.title = "Unassign"
    unassignBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      unsetRulesetConfig(terrain, bitmask)
      renderRulesetGrid()
    })
    header.appendChild(unassignBtn)
  }
  cell.appendChild(header)

  // Diagram + thumbnail row
  const mainRow = document.createElement("div")
  mainRow.className = "config-cell__main"
  mainRow.appendChild(buildDiagram(bitmask))

  if (isAssigned) {
    const wrap = document.createElement("div")
    wrap.className = "config-cell__thumb-wrap"
    const thumb = document.createElement("canvas")
    thumb.className = "config-cell__thumb"
    thumb.width = FRAME_SIZE
    thumb.height = FRAME_SIZE
    renderThumbnail(thumb, getFrame(terrain, assignment.frameIdx))
    const sx = assignment.flipX ? -1 : 1
    const sy = assignment.flipY ? -1 : 1
    if (assignment.flipX || assignment.flipY)
      thumb.style.transform = `scale(${sx},${sy})`
    wrap.appendChild(thumb)
    mainRow.appendChild(wrap)
  }
  cell.appendChild(mainRow)

  // Click to assign active variant
  cell.addEventListener("click", () => {
    if (!activeTerrain) return
    const frames = loadFrames(activeTerrain)
    if (frames.length === 0) return
    setRulesetConfig(activeTerrain, bitmask, {
      frameIdx: activeFrameIdx,
      flipX: false,
      flipY: false,
    })
    renderRulesetGrid()
  })

  // Flip + mirror controls (only when assigned)
  if (isAssigned) {
    const controls = document.createElement("div")
    controls.className = "config-cell__controls"
    // Prevent clicks on controls from bubbling to the cell's assign handler
    controls.addEventListener("click", (e) => e.stopPropagation())

    const flipRow = document.createElement("div")
    flipRow.className = "config-cell__flip-row"

    const mkFlipCheck = (axis: "X" | "Y", checked: boolean) => {
      const lbl = document.createElement("span")
      lbl.className = "config-cell__flip-label"
      lbl.textContent = axis === "X" ? "↔" : "↕"
      const chk = document.createElement("input")
      chk.type = "checkbox"
      chk.checked = checked
      chk.title = `Flip ${axis}`
      chk.addEventListener("change", (e) => {
        e.stopPropagation()
        const cur = getRulesetConfig(terrain, bitmask)
        if (!cur) return
        // Manual flip override breaks the mirror link
        setRulesetConfig(terrain, bitmask, {
          frameIdx: cur.frameIdx,
          flipX: axis === "X" ? chk.checked : cur.flipX,
          flipY: axis === "Y" ? chk.checked : cur.flipY,
        })
        renderRulesetGrid()
      })
      flipRow.appendChild(lbl)
      flipRow.appendChild(chk)
    }
    mkFlipCheck("X", assignment.flipX)
    mkFlipCheck("Y", assignment.flipY)
    controls.appendChild(flipRow)

    // Mirror select — only show source configs that are assigned
    const mirrorSelect = document.createElement("select")
    mirrorSelect.className = "config-cell__mirror-select"
    const noneOpt = document.createElement("option")
    noneOpt.value = ""
    noneOpt.textContent = "≡ mirror of…"
    mirrorSelect.appendChild(noneOpt)
    for (let src = 0; src < 16; src++) {
      if (src === bitmask) continue
      if (!getRulesetConfig(terrain, src)) continue
      const opt = document.createElement("option")
      opt.value = String(src)
      opt.textContent = `${BITMASK_LABELS[src]} (${src})`
      mirrorSelect.appendChild(opt)
    }
    // Reflect the active mirror relationship in the dropdown
    if (assignment.mirrorOf !== undefined) {
      mirrorSelect.value = String(assignment.mirrorOf)
    }
    mirrorSelect.addEventListener("change", (e) => {
      e.stopPropagation()
      if (!mirrorSelect.value) return
      setAsMirrorOf(bitmask, Number(mirrorSelect.value))
    })
    controls.appendChild(mirrorSelect)
    cell.appendChild(controls)
  }

  return cell
}

const rulesetGridEl = document.getElementById("ruleset-grid") as HTMLElement
const canvasWrapEl = document.getElementById("canvas-wrap") as HTMLElement
const modePaintBtn = document.getElementById("mode-paint") as HTMLButtonElement
const modeRulesetBtn = document.getElementById(
  "mode-ruleset",
) as HTMLButtonElement

function renderRulesetGrid(): void {
  rulesetGridEl.innerHTML = ""
  if (!activeTerrain) {
    const msg = document.createElement("div")
    msg.style.cssText = "color:#555;font-size:13px;padding:20px"
    msg.textContent = "Select a terrain type to edit its ruleset."
    rulesetGridEl.appendChild(msg)
    return
  }

  // Collect which bitmasks are referenced as mirror sources
  const mirrorSources = new Set<number>()
  const ruleset = loadRuleset(activeTerrain)
  for (const a of Object.values(ruleset)) {
    if (a.mirrorOf !== undefined) mirrorSources.add(a.mirrorOf)
  }

  const diamond = document.createElement("div")
  diamond.className = "ruleset-diamond"
  for (const [key, pos] of Object.entries(BITMASK_DIAMOND_POS)) {
    const cell = buildConfigCell(Number(key), activeTerrain, mirrorSources)
    cell.style.gridRow = String(pos.row)
    cell.style.gridColumn = String(pos.col)
    diamond.appendChild(cell)
  }
  rulesetGridEl.appendChild(diamond)

  const sep = document.createElement("div")
  sep.className = "ruleset-separator"
  rulesetGridEl.appendChild(sep)

  const extras = document.createElement("div")
  extras.className = "ruleset-extras"
  for (const bitmask of BITMASK_EXTRAS) {
    extras.appendChild(buildConfigCell(bitmask, activeTerrain, mirrorSources))
  }
  rulesetGridEl.appendChild(extras)

  // Keep the preview canvas current even while in Ruleset mode
  renderPreview()
}

function switchMode(mode: EditorMode): void {
  editorMode = mode
  modePaintBtn.classList.toggle("is-active", mode === "paint")
  modeRulesetBtn.classList.toggle("is-active", mode === "ruleset")
  modePreviewBtn.classList.toggle("is-active", mode === "preview")
  canvasWrapEl.style.display = mode === "paint" ? "" : "none"
  rulesetGridEl.style.display = mode === "ruleset" ? "" : "none"
  previewWrapEl.style.display = mode === "preview" ? "" : "none"
  // zoom/fill only make sense in paint mode
  zoomOutBtn.style.display = mode === "paint" ? "" : "none"
  zoomLabel.style.display = mode === "paint" ? "" : "none"
  zoomInBtn.style.display = mode === "paint" ? "" : "none"
  fillBtn.style.display = mode === "paint" ? "" : "none"
  previewClearBtn.style.display = mode === "preview" ? "" : "none"
  if (mode === "ruleset") renderRulesetGrid()
  if (mode === "preview") renderPreview()
}

modePaintBtn.addEventListener("click", () => switchMode("paint"))
modeRulesetBtn.addEventListener("click", () => switchMode("ruleset"))

// ---------------------------------------------------------------------------
// Add terrain dialog

const addTerrainDialog = document.getElementById(
  "add-terrain-dialog",
) as HTMLDialogElement
const atIdInput = document.getElementById("at-id") as HTMLInputElement
const atNameInput = document.getElementById("at-name") as HTMLInputElement
const atColourInput = document.getElementById("at-colour") as HTMLInputElement
const atSolidInput = document.getElementById("at-solid") as HTMLInputElement
const atError = document.getElementById("at-error") as HTMLElement
const addTerrainBtn = document.getElementById(
  "add-terrain-btn",
) as HTMLButtonElement
const atCancelBtn = document.getElementById("at-cancel") as HTMLButtonElement
const atConfirmBtn = document.getElementById("at-confirm") as HTMLButtonElement

addTerrainBtn.addEventListener("click", () => {
  atIdInput.value = ""
  atNameInput.value = ""
  atColourInput.value = "#888888"
  atSolidInput.checked = false
  atError.style.display = "none"
  addTerrainDialog.showModal()
  atIdInput.focus()
})

atCancelBtn.addEventListener("click", () => {
  addTerrainDialog.close()
})

atConfirmBtn.addEventListener("click", () => {
  const typeId = atIdInput.value.trim().toLowerCase().replace(/\s+/g, "_")
  const name = atNameInput.value.trim()
  const colour = atColourInput.value
  const solid = atSolidInput.checked

  if (!typeId) {
    showAtError("Type ID is required.")
    return
  }
  if (!/^[a-z][a-z0-9_]*$/.test(typeId)) {
    showAtError(
      "Type ID must start with a letter, then lowercase letters, numbers, or underscores.",
    )
    return
  }
  if (!name) {
    showAtError("Display name is required.")
    return
  }
  if (terrainTypes.some((t) => t.type === typeId)) {
    showAtError(`Type ID "${typeId}" already exists.`)
    return
  }

  addTerrainDialog.close()
  addTerrainType(typeId, name, solid, colour)
})

function showAtError(msg: string): void {
  atError.textContent = msg
  atError.style.display = "block"
}

// ---------------------------------------------------------------------------
// Preview mode

const PREVIEW_COLS = 8
const PREVIEW_ROWS = 8
const PREVIEW_SCALE = 3 // 16 px tiles drawn at 48 px → 384×384 canvas

// Scratchpad grid — not persisted, resets on reload.
// Each cell holds a terrain type string or null (empty).
const previewGrid: (string | null)[][] = Array.from(
  { length: PREVIEW_ROWS },
  () => Array<string | null>(PREVIEW_COLS).fill(null),
)

const previewWrapEl = document.getElementById("preview-wrap") as HTMLElement
const previewCanvas = document.getElementById(
  "preview-canvas",
) as HTMLCanvasElement
const previewClearBtn = document.getElementById(
  "preview-clear-btn",
) as HTMLButtonElement
const modePreviewBtn = document.getElementById(
  "mode-preview",
) as HTMLButtonElement

previewCanvas.width = PREVIEW_COLS * FRAME_SIZE * PREVIEW_SCALE
previewCanvas.height = PREVIEW_ROWS * FRAME_SIZE * PREVIEW_SCALE

// Compute 4-bit cardinal bitmask for same-type neighbours.
// N=bit0, E=bit1, S=bit2, W=bit3  (matches tiles.ts).
// Screen coords: row increases downward, col increases rightward.
// All four cardinals swapped to match sprite layout (variant name = where
// connection is drawn on the tile, not where the neighbour is):
//   row-1 (above) → S(4), row+1 (below) → N(1)
//   col-1 (left)  → E(2), col+1 (right) → W(8)
function computePreviewBitmask(row: number, col: number): number {
  const type = previewGrid[row]?.[col]
  if (!type) return 0
  let mask = 0
  if (previewGrid[row + 1]?.[col] === type) mask |= 1 // N (neighbour below)
  if (previewGrid[row]?.[col - 1] === type) mask |= 2 // E (neighbour left)
  if (previewGrid[row - 1]?.[col] === type) mask |= 4 // S (neighbour above)
  if (previewGrid[row]?.[col + 1] === type) mask |= 8 // W (neighbour right)
  return mask
}

// Draw one variant (with optional flip) onto an existing canvas context at
// (destX, destY) scaled to destSize×destSize. Uses an offscreen canvas so
// the pixel data can be scaled with imageSmoothingEnabled = false.
// This is the authoritative tile-drawing function — the game runtime will
// share this logic once it reads the same tiles.ts format.
function drawVariantOnContext(
  ctx: CanvasRenderingContext2D,
  pixelData: number[],
  destX: number,
  destY: number,
  destSize: number,
  flipX: boolean,
  flipY: boolean,
): void {
  const tmp = document.createElement("canvas")
  tmp.width = FRAME_SIZE
  tmp.height = FRAME_SIZE
  const tmpCtx = tmp.getContext("2d")
  if (!tmpCtx) return
  const img = tmpCtx.createImageData(FRAME_SIZE, FRAME_SIZE)
  for (let i = 0; i < pixelData.length; i++) img.data[i] = pixelData[i] ?? 0
  tmpCtx.putImageData(img, 0, 0)

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.translate(destX + destSize / 2, destY + destSize / 2)
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  ctx.drawImage(tmp, -destSize / 2, -destSize / 2, destSize, destSize)
  ctx.restore()
}

function renderPreview(): void {
  const ctx = previewCanvas.getContext("2d")
  if (!ctx) return
  const tileSize = FRAME_SIZE * PREVIEW_SCALE

  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height)

  for (let row = 0; row < PREVIEW_ROWS; row++) {
    for (let col = 0; col < PREVIEW_COLS; col++) {
      const x = col * tileSize
      const y = row * tileSize

      // Checkerboard background so empty cells and transparent pixels are clear
      ctx.fillStyle = (row + col) % 2 === 0 ? "#1e1e1e" : "#282828"
      ctx.fillRect(x, y, tileSize, tileSize)

      const type = previewGrid[row]?.[col]
      if (!type) continue

      const bitmask = computePreviewBitmask(row, col)
      const assignment = getRulesetConfig(type, bitmask)
      // Fall back to ∅ variant (index 0) when a config is unassigned
      const frameIdx = assignment?.frameIdx ?? 0
      const flipX = assignment?.flipX ?? false
      const flipY = assignment?.flipY ?? false

      drawVariantOnContext(
        ctx,
        getFrame(type, frameIdx),
        x,
        y,
        tileSize,
        flipX,
        flipY,
      )
    }
  }

  // Subtle grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.07)"
  ctx.lineWidth = 1
  for (let r = 0; r <= PREVIEW_ROWS; r++) {
    ctx.beginPath()
    ctx.moveTo(0, r * tileSize)
    ctx.lineTo(PREVIEW_COLS * tileSize, r * tileSize)
    ctx.stroke()
  }
  for (let c = 0; c <= PREVIEW_COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(c * tileSize, 0)
    ctx.lineTo(c * tileSize, PREVIEW_ROWS * tileSize)
    ctx.stroke()
  }
}

function previewCellAt(e: MouseEvent): { row: number; col: number } | null {
  const rect = previewCanvas.getBoundingClientRect()
  const scaleX = previewCanvas.width / rect.width
  const scaleY = previewCanvas.height / rect.height
  const col = Math.floor(
    ((e.clientX - rect.left) * scaleX) / (FRAME_SIZE * PREVIEW_SCALE),
  )
  const row = Math.floor(
    ((e.clientY - rect.top) * scaleY) / (FRAME_SIZE * PREVIEW_SCALE),
  )
  if (row < 0 || row >= PREVIEW_ROWS || col < 0 || col >= PREVIEW_COLS)
    return null
  return { row, col }
}

let isPreviewPainting = false

previewCanvas.addEventListener("contextmenu", (e) => e.preventDefault())

previewCanvas.addEventListener("mousedown", (e) => {
  isPreviewPainting = true
  const cell = previewCellAt(e)
  if (!cell) return
  const erase = e.button === 2
  previewGrid[cell.row][cell.col] = erase ? null : (activeTerrain ?? null)
  renderPreview()
})

previewCanvas.addEventListener("mousemove", (e) => {
  if (!isPreviewPainting) return
  const cell = previewCellAt(e)
  if (!cell) return
  const erase = e.buttons === 2
  previewGrid[cell.row][cell.col] = erase ? null : (activeTerrain ?? null)
  renderPreview()
})

window.addEventListener("mouseup", () => {
  isPreviewPainting = false
})

previewClearBtn.addEventListener("click", () => {
  for (let r = 0; r < PREVIEW_ROWS; r++)
    for (let c = 0; c < PREVIEW_COLS; c++) previewGrid[r][c] = null
  renderPreview()
})

modePreviewBtn.addEventListener("click", () => switchMode("preview"))

// ---------------------------------------------------------------------------
// Init

async function init(): Promise<void> {
  updateColourUI()
  renderUsedColours()

  // Prefer the localStorage working registry; fall back to the API on first run.
  const stored = loadRegistry()
  if (stored.length > 0) {
    terrainTypes = stored
  } else {
    try {
      const res = await fetch(`${API}/api/tiles`)
      if (!res.ok) throw new Error(`GET /api/tiles → ${res.status}`)
      const apiTypes = (await res.json()) as TileDefinition[]
      saveRegistry(apiTypes)
      terrainTypes = apiTypes
    } catch (err) {
      console.error("Could not load tile registry:", err)
      const label = terrainSidebar.querySelector(".sidebar__label")
      if (label) label.textContent = "Terrain (API unavailable)"
      return
    }
  }

  buildTerrainSidebar()
  if (terrainTypes.length > 0) setActiveTerrain(terrainTypes[0].type)
}

init()
