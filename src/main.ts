import { createInputState, keyDown, keyUp } from "./engine/input"
import { type GameState, update } from "./engine/loop"
import {
  activeScene,
  createSceneManagerState,
  pop,
  push,
  replace,
  type SceneManager,
} from "./engine/scene"
import { OverworldScene } from "./scenes/OverworldScene"

const canvas = document.getElementById("canvas") as HTMLCanvasElement
const ctxOrNull = canvas.getContext("2d")
if (!ctxOrNull) throw new Error("Could not acquire 2D canvas context")
const ctx = ctxOrNull

// Fixed internal render resolution — the canvas buffer never changes size.
// CSS scales it up to fill the window; image-rendering:pixelated keeps it sharp.
// 640×360 gives ~20 tiles wide × ~11 tiles tall, so the camera must scroll
// to show the full 30×20 map.
canvas.width = 640
canvas.height = 360

// --- Mutable shell state (rAF boundary — intentionally not pure) ---
let gameState: GameState = { time: 0 }
let inputState = createInputState()
let sceneState = createSceneManagerState()

// Scenes receive this handle to drive stack transitions themselves.
const sceneManager: SceneManager = {
  push: (scene) => {
    sceneState = push(sceneState, scene)
  },
  pop: () => {
    sceneState = pop(sceneState)
  },
  replace: (scene) => {
    sceneState = replace(sceneState, scene)
  },
}

sceneState = push(sceneState, new OverworldScene(sceneManager))

window.addEventListener("keydown", (e) => {
  e.preventDefault()
  inputState = keyDown(inputState, e.code)
})
window.addEventListener("keyup", (e) => {
  inputState = keyUp(inputState, e.code)
})

// --- Game loop ---
let lastTime: number | null = null

function loop(timestamp: number) {
  const dt = lastTime === null ? 0 : (timestamp - lastTime) / 1000
  lastTime = timestamp

  gameState = update(gameState, dt)

  const scene = activeScene(sceneState)
  if (scene) {
    scene.update(dt, inputState)
    scene.render(ctx)
  }

  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
