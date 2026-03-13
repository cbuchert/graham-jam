import { describe, expect, it, vi, beforeEach } from "vitest";
import { app } from "./app.ts";

// ---------------------------------------------------------------------------
// Mock the filesystem — routes use node:fs/promises for all file I/O
vi.mock("node:fs/promises");
import * as fs from "node:fs/promises";
const readFile = vi.mocked(fs.readFile);
const writeFile = vi.mocked(fs.writeFile);

// ---------------------------------------------------------------------------
// Fixtures

const WORLD_GRAPH_CONTENT = `export const SCENE_NAMES = ['town', 'dungeon'] as const;`;

const TOWN_SCENE_CONTENT = `\
// hand-authored above

// @scene-editor:start
export const TILES = [[0,1],[1,0]] as number[][];
export const SPAWN_POINTS = {"entrance":{"x":1,"y":0}} as Record<string, { x: number; y: number }>;
// @scene-editor:end

// hand-authored below
`;

const NO_MARKERS_CONTENT = `export const TILES = [[0]] as number[][];`;

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/health (existing — keep it green)

describe("GET /api/health", () => {
  it("returns 200 with { ok: true }", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("sets CORS header for the Vite dev origin", async () => {
    const res = await app.request("/api/health", {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
  });

  it("does not set CORS header for unknown origins", async () => {
    const res = await app.request("/api/health", {
      headers: { Origin: "http://evil.example.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).not.toBe(
      "http://evil.example.com",
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/scenes

describe("GET /api/scenes", () => {
  it("returns the list of scene names from worldGraph.ts", async () => {
    readFile.mockResolvedValueOnce(WORLD_GRAPH_CONTENT as never);
    const res = await app.request("/api/scenes");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(["town", "dungeon"]);
  });

  it("returns an empty array when SCENE_NAMES is not defined", async () => {
    readFile.mockResolvedValueOnce(`export type SceneName = never;` as never);
    const res = await app.request("/api/scenes");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/scene/:name

describe("GET /api/scene/:name", () => {
  it("returns tiles and spawn points for a valid scene file", async () => {
    readFile.mockResolvedValueOnce(TOWN_SCENE_CONTENT as never);
    const res = await app.request("/api/scene/town");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      tiles: [[0, 1], [1, 0]],
      spawnPoints: { entrance: { x: 1, y: 0 } },
    });
  });

  it("returns 404 when the scene file does not exist", async () => {
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    readFile.mockRejectedValueOnce(err);
    const res = await app.request("/api/scene/missing");
    expect(res.status).toBe(404);
  });

  it("returns 400 when the file exists but has no markers", async () => {
    readFile.mockResolvedValueOnce(NO_MARKERS_CONTENT as never);
    const res = await app.request("/api/scene/town");
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/scene/:name

describe("POST /api/scene/:name", () => {
  it("writes the updated content back to the scene file", async () => {
    readFile.mockResolvedValueOnce(TOWN_SCENE_CONTENT as never);
    writeFile.mockResolvedValueOnce(undefined as never);

    const body = { tiles: [[1, 0], [0, 1]], spawnPoints: { exit: { x: 0, y: 1 } } };
    const res = await app.request("/api/scene/town", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(200);
    const written = writeFile.mock.calls[0][1] as string;
    expect(written).toContain("TILES = [[1,0],[0,1]]");
    expect(written).toContain(`"exit":{"x":0,"y":1}`);
    expect(written).toContain("hand-authored above");
    expect(written).toContain("hand-authored below");
  });

  it("returns 404 when the scene file does not exist", async () => {
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    readFile.mockRejectedValueOnce(err);
    const res = await app.request("/api/scene/missing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiles: [], spawnPoints: {} }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when the file exists but has no markers", async () => {
    readFile.mockResolvedValueOnce(NO_MARKERS_CONTENT as never);
    const res = await app.request("/api/scene/town", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiles: [], spawnPoints: {} }),
    });
    expect(res.status).toBe(400);
  });
});
