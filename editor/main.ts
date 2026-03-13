import { TILE_DEF_MAP, TILE_DEFS } from "../src/world/tileDefinitions.ts";

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

// ---------------------------------------------------------------------------
// DOM refs

const sceneSelect   = document.getElementById("scene-select")   as HTMLSelectElement;
const loadBtn       = document.getElementById("load-btn")        as HTMLButtonElement;
const saveBtn       = document.getElementById("save-btn")        as HTMLButtonElement;
const dirtyEl       = document.getElementById("dirty-indicator") as HTMLElement;
const canvas        = document.getElementById("grid")            as HTMLCanvasElement;
const paletteEl     = document.getElementById("palette")         as HTMLElement;
const modePaintBtn  = document.getElementById("mode-paint")      as HTMLButtonElement;
const modeSpawnBtn  = document.getElementById("mode-spawn")      as HTMLButtonElement;
const ctx           = canvas.getContext("2d")!;

// ---------------------------------------------------------------------------
// State

type Mode = "paint" | "spawn";

let sceneName: string | null = null;
let tiles: number[][] = [];
let spawnPoints: Record<string, { x: number; y: number }> = {};
let activeTile = 0;
let mode: Mode = "paint";
let selectedSpawnName: string | null = null; // null, or a name in spawnPoints, or a pending unplaced name
let isDirty = false;
let isPainting = false;

// ---------------------------------------------------------------------------
// Canvas sizing

const IDEAL_CELL = 24;
const MIN_CELL   = 8;
const MAX_CELL   = 64;

function computeCellSize(cols: number, rows: number): number {
  const byWidth  = Math.floor(window.innerWidth  * 0.75 / cols);
  const byHeight = Math.floor((window.innerHeight - 48) / rows);
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

  // Tile layer
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const def = TILE_DEF_MAP[tiles[row][col]];
      ctx.fillStyle = def?.editorColour ?? "#222";
      ctx.fillRect(col * cs, row * cs, cs, cs);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(col * cs + 0.5, row * cs + 0.5, cs - 1, cs - 1);
    }
  }

  // Spawn point markers on top
  renderSpawnPoints(cs);
}

function renderSpawnPoints(cs: number) {
  for (const [name, pos] of Object.entries(spawnPoints)) {
    const cx = pos.x * cs + cs / 2;
    const cy = pos.y * cs + cs / 2;
    const r  = Math.max(4, cs * 0.28);
    const isSelected = name === selectedSpawnName;

    // Circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle   = isSelected ? "#f0a060" : "#40c8ff";
    ctx.strokeStyle = isSelected ? "#fff" : "rgba(0,0,0,0.6)";
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();

    // Name label below the circle
    const fontSize = Math.max(8, Math.min(11, cs * 0.38));
    ctx.font         = `bold ${fontSize}px monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle    = "#fff";
    ctx.shadowColor  = "rgba(0,0,0,0.8)";
    ctx.shadowBlur   = 3;
    ctx.fillText(name, cx, cy + r + 1);
    ctx.shadowBlur = 0;
  }
}

// ---------------------------------------------------------------------------
// Mode toggle

function setMode(next: Mode) {
  mode = next;
  modePaintBtn.classList.toggle("active", mode === "paint");
  modeSpawnBtn.classList.toggle("active", mode === "spawn");
  rebuildPanel();
}

modePaintBtn.addEventListener("click", () => setMode("paint"));
modeSpawnBtn.addEventListener("click", () => setMode("spawn"));

// ---------------------------------------------------------------------------
// Sidebar panel — shows tile palette in paint mode, spawn panel in spawn mode

function rebuildPanel() {
  // Clear everything except the section label
  paletteEl.querySelectorAll(":scope > *:not(.section-label)").forEach((el) => el.remove());
  const label = paletteEl.querySelector(".section-label")!;

  if (mode === "paint") {
    label.textContent = "Tiles";
    buildTilePalette();
  } else {
    label.textContent = "Spawn Points";
    buildSpawnPanel();
  }
}

// ── Tile palette ────────────────────────────────────────────────────────────

function buildTilePalette() {
  for (const def of TILE_DEFS) {
    const btn    = document.createElement("button");
    btn.className = "tile-btn" + (def.id === activeTile ? " active" : "");
    btn.title     = `${def.name} — ${def.solid ? "solid" : "walkable"}`;
    btn.dataset.id = String(def.id);

    const swatch       = document.createElement("span");
    swatch.className   = "swatch";
    swatch.style.background = def.editorColour;

    btn.appendChild(swatch);
    btn.appendChild(document.createTextNode(def.name));
    btn.addEventListener("click", () => { activeTile = def.id; rebuildPanel(); });
    paletteEl.appendChild(btn);
  }
}

// ── Spawn panel ─────────────────────────────────────────────────────────────

function buildSpawnPanel() {
  // Add button
  const addBtn      = document.createElement("button");
  addBtn.className  = "tile-btn spawn-add-btn";
  addBtn.textContent = "+ Add spawn point";
  addBtn.addEventListener("click", () => {
    const name = prompt("Spawn point name (e.g. entrance, fromDungeon):");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (trimmed in spawnPoints) { alert(`"${trimmed}" already exists.`); return; }
    // Mark as selected but unplaced — it enters spawnPoints on first grid click
    selectedSpawnName = trimmed;
    setDirty(true);
    rebuildPanel();
  });
  paletteEl.appendChild(addBtn);

  // Hint when a spawn point is selected but not yet placed
  if (selectedSpawnName && !(selectedSpawnName in spawnPoints)) {
    const hint       = document.createElement("div");
    hint.className   = "spawn-hint";
    hint.textContent = `Click grid to place "${selectedSpawnName}"`;
    paletteEl.appendChild(hint);
  }

  // List placed spawn points
  for (const [name, pos] of Object.entries(spawnPoints)) {
    paletteEl.appendChild(buildSpawnItem(name, pos));
  }
}

function buildSpawnItem(
  name: string,
  pos: { x: number; y: number },
): HTMLElement {
  const item      = document.createElement("div");
  item.className  = "spawn-item" + (name === selectedSpawnName ? " active" : "");

  // Name — click selects, double-click starts inline rename
  const nameEl      = document.createElement("span");
  nameEl.className  = "spawn-name";
  nameEl.textContent = name;
  nameEl.title      = "Double-click to rename";
  nameEl.addEventListener("click", () => {
    selectedSpawnName = name;
    render();
    rebuildPanel();
  });
  nameEl.addEventListener("dblclick", () => startRename(item, name, nameEl));

  // Tile coords
  const coordEl      = document.createElement("span");
  coordEl.className  = "spawn-coords";
  coordEl.textContent = `${pos.x},${pos.y}`;

  // Delete
  const delBtn       = document.createElement("button");
  delBtn.className   = "spawn-del";
  delBtn.textContent = "✕";
  delBtn.title       = "Delete";
  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    delete spawnPoints[name];
    if (selectedSpawnName === name) selectedSpawnName = null;
    setDirty(true);
    render();
    rebuildPanel();
  });

  item.appendChild(nameEl);
  item.appendChild(coordEl);
  item.appendChild(delBtn);
  return item;
}

function startRename(
  item: HTMLElement,
  oldName: string,
  nameEl: HTMLSpanElement,
) {
  const input       = document.createElement("input");
  input.value       = oldName;
  input.className   = "spawn-rename-input";
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newName = input.value.trim();
    if (newName && newName !== oldName) {
      if (newName in spawnPoints) {
        alert(`"${newName}" already exists.`);
      } else {
        spawnPoints[newName] = spawnPoints[oldName];
        delete spawnPoints[oldName];
        if (selectedSpawnName === oldName) selectedSpawnName = newName;
        setDirty(true);
      }
    }
    render();
    rebuildPanel();
  }

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter")  { input.blur(); }
    if (e.key === "Escape") { input.value = oldName; input.blur(); }
  });
}

// ---------------------------------------------------------------------------
// Painting (paint mode)

function tileAt(e: MouseEvent): { col: number; row: number } | null {
  if (tiles.length === 0) return null;
  const rect   = canvas.getBoundingClientRect();
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
  if (tiles[coords.row][coords.col] === activeTile) return;
  tiles[coords.row][coords.col] = activeTile;
  setDirty(true);
  render();
}

// Spawn placement (spawn mode)
function placeSpawnAt(e: MouseEvent) {
  if (!selectedSpawnName) return;
  const coords = tileAt(e);
  if (!coords) return;
  spawnPoints[selectedSpawnName] = { x: coords.col, y: coords.row };
  setDirty(true);
  render();
  rebuildPanel(); // refresh coords display
}

canvas.addEventListener("mousedown", (e) => {
  if (mode === "paint") { isPainting = true; paintAt(e); }
  else                  { placeSpawnAt(e); }
});
canvas.addEventListener("mousemove",  (e) => { if (isPainting && mode === "paint") paintAt(e); });
canvas.addEventListener("mouseup",    ()  => { isPainting = false; });
canvas.addEventListener("mouseleave", ()  => { isPainting = false; });

// ---------------------------------------------------------------------------
// Dirty state

function setDirty(dirty: boolean) {
  isDirty = dirty;
  dirtyEl.hidden = !dirty;
}

window.addEventListener("beforeunload", (e) => {
  if (isDirty) { e.preventDefault(); e.returnValue = ""; }
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
// Load / save

loadBtn.addEventListener("click", async () => {
  const name = sceneSelect.value;
  if (!name) return;
  if (isDirty && !confirm("You have unsaved changes. Load anyway?")) return;
  try {
    const data  = await apiFetchScene(name);
    tiles       = data.tiles;
    spawnPoints = data.spawnPoints ?? {};
    sceneName   = name;
    selectedSpawnName = null;
    setDirty(false);
    render();
    rebuildPanel();
  } catch (err) { alert(String(err)); }
});

saveBtn.addEventListener("click", async () => {
  if (!sceneName) return;
  try {
    await apiSaveScene(sceneName);
    setDirty(false);
  } catch (err) { alert(String(err)); }
});

// ---------------------------------------------------------------------------
// Init

async function init() {
  render();
  try {
    const names = await apiFetchScenes();
    for (const name of names) {
      const opt = document.createElement("option");
      opt.value = opt.textContent = name;
      sceneSelect.appendChild(opt);
    }
  } catch (err) { console.error("Could not reach API server:", err); }
  rebuildPanel();
}

init();
