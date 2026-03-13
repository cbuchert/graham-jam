import { access, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Hono } from "hono"
import { cors } from "hono/cors"
import {
  addSceneName,
  parseSceneFile,
  parseSceneNames,
  replaceMarkerBlock,
  scaffoldSceneFile,
  serializeSceneBlock,
} from "./sceneParser.ts"

const VITE_ORIGIN = "http://localhost:5173"

// Paths are resolved relative to the project root (cwd when npm run dev:server runs).
const WORLD_GRAPH_PATH = join(process.cwd(), "src/world/worldGraph.ts")
const MAPS_DIR = join(process.cwd(), "src/world/maps")

export const app = new Hono()

app.use(
  "/*",
  cors({
    origin: VITE_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
)

app.get("/api/health", (c) => c.json({ ok: true }))

// Returns all scene names registered in worldGraph.ts.
app.get("/api/scenes", async (c) => {
  const content = await readFile(WORLD_GRAPH_PATH, "utf8")
  return c.json(parseSceneNames(content))
})

// Returns the tile array and spawn points for a scene file.
app.get("/api/scene/:name", async (c) => {
  const name = c.req.param("name")
  const filePath = join(MAPS_DIR, `${name}.ts`)

  let content: string
  try {
    content = await readFile(filePath, "utf8")
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return c.json({ error: "Map file not found" }, 404)
    }
    throw err
  }

  const data = parseSceneFile(content)
  if (data === null) {
    return c.json({ error: "Map file has no @map-editor markers" }, 400)
  }

  return c.json(data)
})

// Scaffolds a new scene file and registers the name in worldGraph.ts.
// Returns 409 if the file already exists.
app.post("/api/scene/:name/create", async (c) => {
  const name = c.req.param("name")
  const filePath = join(MAPS_DIR, `${name}.ts`)

  // 409 if the file already exists
  try {
    await access(filePath)
    return c.json({ error: "Map file already exists" }, 409)
  } catch {
    // ENOENT — file does not exist, proceed
  }

  const { width, height } = await c.req.json<{
    width: number
    height: number
  }>()

  const sceneContent = scaffoldSceneFile(width, height)
  const worldGraphContent = await readFile(WORLD_GRAPH_PATH, "utf8")
  const updatedWorldGraph = addSceneName(worldGraphContent, name)

  await writeFile(filePath, sceneContent, "utf8")
  await writeFile(WORLD_GRAPH_PATH, updatedWorldGraph, "utf8")

  return c.json({ ok: true }, 201)
})

// Replaces the tile array and spawn points between the markers in a scene file.
app.post("/api/scene/:name", async (c) => {
  const name = c.req.param("name")
  const filePath = join(MAPS_DIR, `${name}.ts`)

  let content: string
  try {
    content = await readFile(filePath, "utf8")
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return c.json({ error: "Map file not found" }, 404)
    }
    throw err
  }

  const body = await c.req.json<{
    tiles: number[][]
    spawnPoints: Record<string, { x: number; y: number }>
  }>()

  const newBlock = serializeSceneBlock(body)
  const updated = replaceMarkerBlock(content, newBlock)
  if (updated === null) {
    return c.json({ error: "Map file has no @map-editor markers" }, 400)
  }

  await writeFile(filePath, updated, "utf8")
  return c.json({ ok: true })
})
