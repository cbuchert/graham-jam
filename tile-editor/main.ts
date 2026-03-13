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

function recordUsedColour(hex: string): void {
  const deduped = loadUsedColours().filter((h) => h !== hex)
  localStorage.setItem(
    LS_USED_COLOURS,
    JSON.stringify([hex, ...deduped].slice(0, MAX_USED_COLOURS)),
  )
  renderUsedColours()
}

// ---------------------------------------------------------------------------
// Colour helpers

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

function buildTerrainSidebar(): void {
  for (const el of Array.from(
    terrainSidebar.querySelectorAll(".terrain-btn"),
  )) {
    el.remove()
  }
  for (const t of terrainTypes) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = `terrain-btn${activeTerrain === t.type ? " terrain-btn--active" : ""}`

    const swatch = document.createElement("span")
    swatch.className = "terrain-btn__swatch"
    swatch.style.background = t.editorColour

    btn.appendChild(swatch)
    btn.appendChild(document.createTextNode(t.name))
    btn.addEventListener("click", () => setActiveTerrain(t.type))
    terrainSidebar.appendChild(btn)
  }
}

function setActiveTerrain(type: string): void {
  activeTerrain = type
  activeFrameIdx = 0
  buildTerrainSidebar()
  renderFramePanel()
  canvasEmpty.style.display = "none"
  paintCanvas.style.display = "block"
  renderPaintCanvas()
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
  // Keep the native picker in sync so it opens at the current colour
  nativeColourPicker.value = hex

  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  colourRgb.textContent = `rgb(${r}, ${g}, ${b})  ${hex}`

  if (!hexOverride) {
    lchLVal.textContent = String(lchColour.l)
    lchCVal.textContent = String(lchColour.c)
    lchHVal.textContent = String(lchColour.h)
  }
}

// Native OS colour picker — clicking the preview swatch opens it
nativeColourPicker.addEventListener("input", () => {
  hexOverride = nativeColourPicker.value
  updateColourUI()
})

function onSliderInput(): void {
  hexOverride = null
  lchColour = {
    l: Number(lchLInput.value),
    c: Number(lchCInput.value),
    h: Number(lchHInput.value),
  }
  updateColourUI()
}

lchLInput.addEventListener("input", onSliderInput)
lchCInput.addEventListener("input", onSliderInput)
lchHInput.addEventListener("input", onSliderInput)

// ---------------------------------------------------------------------------
// Used colours

function renderUsedColours(): void {
  swatchGrid.innerHTML = ""
  for (const hex of loadUsedColours()) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "swatch-btn"
    btn.style.background = hex
    btn.title = hex
    btn.addEventListener("click", () => {
      hexOverride = hex
      updateColourUI()
    })
    swatchGrid.appendChild(btn)
  }
}

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
// Init

async function init(): Promise<void> {
  updateColourUI()
  renderUsedColours()

  try {
    const res = await fetch(`${API}/api/tiles`)
    if (!res.ok) throw new Error(`GET /api/tiles → ${res.status}`)
    terrainTypes = (await res.json()) as TileDefinition[]
  } catch (err) {
    console.error("Could not load tile registry:", err)
    const label = terrainSidebar.querySelector(".sidebar__label")
    if (label) label.textContent = "Terrain (API unavailable)"
    return
  }

  buildTerrainSidebar()
  if (terrainTypes.length > 0) setActiveTerrain(terrainTypes[0].type)
}

init()
