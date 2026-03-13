import { TILE_DEF_MAP, TILE_DEFS } from "../src/world/tileDefinitions.ts";

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// DOM refs

const sceneSelect  = document.getElementById("scene-select")   as HTMLSelectElement;
const loadBtn      = document.getElementById("load-btn")        as HTMLButtonElement;
const saveBtn      = document.getElementById("save-btn")        as HTMLButtonElement;
const dirtyEl      = document.getElementById("dirty-indicator") as HTMLElement;
const canvas       = document.getElementById("grid")            as HTMLCanvasElement;
const paletteEl    = document.getElementById("palette")         as HTMLElement;
const ctx          = canvas.getContext("2d")!;

// ---------------------------------------------------------------------------
// State

let sceneName: string | null = null;
let tiles: number[][] = [];
let spawnPoints: Record<string, { x: number; y: number }> = {};
let activeTile = 0;
let isDirty = false;
let isPainting = false;

// ---------------------------------------------------------------------------
// Canvas sizing
//
// The canvas buffer is set to exactly (cols × cellSize) × (rows × cellSize)
// so each tile maps 1:1 to pixels — no sub-pixel bleed on grid lines.
// CSS just lets it overflow into the scrollable canvas-wrap container.

const IDEAL_CELL = 24; // px — comfortable default cell size
const MIN_CELL = 8;
const MAX_CELL = 64;

function computeCellSize(cols: number, rows: number): number {
  // Aim for IDEAL_CELL but clamp so tiny/huge maps stay usable.
  const byWidth  = Math.floor(window.innerWidth  * 0.75 / cols);
  const byHeight = Math.floor((window.innerHeight - 48) / rows); // 48 = toolbar height
  return Math.min(MAX_CELL, Math.max(MIN_CELL, Math.min(IDEAL_CELL, byWidth, byHeight)));
}

// ---------------------------------------------------------------------------
// Rendering

function render() {
  if (tiles.length === 0) {
    canvas.width  = 320;
    canvas.height = 180;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#555";
    ctx.font = "13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No scene loaded", canvas.width / 2, canvas.height / 2);
    return;
  }

  const rows = tiles.length;
  const cols = tiles[0].length;
  const cs   = computeCellSize(cols, rows);

  canvas.width  = cols * cs;
  canvas.height = rows * cs;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id  = tiles[row][col];
      const def = TILE_DEF_MAP[id];

      ctx.fillStyle = def?.editorColour ?? "#222";
      ctx.fillRect(col * cs, row * cs, cs, cs);

      // subtle grid line
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(col * cs + 0.5, row * cs + 0.5, cs - 1, cs - 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Palette

function buildPalette() {
  // keep the section label, replace everything after it
  paletteEl.querySelectorAll(".tile-btn").forEach((el) => el.remove());

  for (const def of TILE_DEFS) {
    const btn = document.createElement("button");
    btn.className = "tile-btn" + (def.id === activeTile ? " active" : "");
    btn.title = `${def.name} — ${def.solid ? "solid" : "walkable"}`;
    btn.dataset.id = String(def.id);

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = def.editorColour;

    btn.appendChild(swatch);
    btn.appendChild(document.createTextNode(def.name));

    btn.addEventListener("click", () => {
      activeTile = def.id;
      buildPalette();
    });

    paletteEl.appendChild(btn);
  }
}

// ---------------------------------------------------------------------------
// Painting

function tileAt(e: MouseEvent): { col: number; row: number } | null {
  if (tiles.length === 0) return null;
  const rect  = canvas.getBoundingClientRect();
  // scale from CSS display pixels to canvas buffer pixels
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const cs     = computeCellSize(tiles[0].length, tiles.length);
  const col    = Math.floor(((e.clientX - rect.left) * scaleX) / cs);
  const row    = Math.floor(((e.clientY - rect.top)  * scaleY) / cs);
  if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length) return null;
  return { col, row };
}

function paintAt(e: MouseEvent) {
  const coords = tileAt(e);
  if (!coords) return;
  if (tiles[coords.row][coords.col] === activeTile) return; // nothing to do
  tiles[coords.row][coords.col] = activeTile;
  setDirty(true);
  render();
}

canvas.addEventListener("mousedown",  (e) => { isPainting = true;  paintAt(e); });
canvas.addEventListener("mousemove",  (e) => { if (isPainting) paintAt(e); });
canvas.addEventListener("mouseup",    ()  => { isPainting = false; });
canvas.addEventListener("mouseleave", ()  => { isPainting = false; });

// ---------------------------------------------------------------------------
// Dirty state

function setDirty(dirty: boolean) {
  isDirty = dirty;
  dirtyEl.hidden = !dirty;
}

window.addEventListener("beforeunload", (e) => {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ---------------------------------------------------------------------------
// API

async function apiFetchScenes(): Promise<string[]> {
  const res = await fetch(`${API}/api/scenes`);
  if (!res.ok) throw new Error(`GET /api/scenes → ${res.status}`);
  return res.json() as Promise<string[]>;
}

async function apiFetchScene(name: string) {
  const res = await fetch(`${API}/api/scene/${name}`);
  if (!res.ok) throw new Error(`GET /api/scene/${name} → ${res.status}`);
  return res.json() as Promise<{
    tiles: number[][];
    spawnPoints: Record<string, { x: number; y: number }>;
  }>;
}

async function apiSaveScene(name: string) {
  const res = await fetch(`${API}/api/scene/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tiles, spawnPoints }),
  });
  if (!res.ok) throw new Error(`POST /api/scene/${name} → ${res.status}`);
}

// ---------------------------------------------------------------------------
// Load / save handlers

loadBtn.addEventListener("click", async () => {
  const name = sceneSelect.value;
  if (!name) return;
  if (isDirty && !confirm("You have unsaved changes. Load anyway?")) return;

  try {
    const data = await apiFetchScene(name);
    tiles       = data.tiles;
    spawnPoints = data.spawnPoints ?? {};
    sceneName   = name;
    setDirty(false);
    render();
  } catch (err) {
    alert(String(err));
  }
});

saveBtn.addEventListener("click", async () => {
  if (!sceneName) return;
  try {
    await apiSaveScene(sceneName);
    setDirty(false);
  } catch (err) {
    alert(String(err));
  }
});

// ---------------------------------------------------------------------------
// Init

async function init() {
  render(); // show the "no scene loaded" placeholder

  try {
    const names = await apiFetchScenes();
    for (const name of names) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sceneSelect.appendChild(opt);
    }
  } catch (err) {
    console.error("Could not reach API server:", err);
  }

  buildPalette();
}

init();
