import { describe, expect, it } from "vitest"
import { type Camera, clampCamera, followPlayer, worldToScreen } from "./camera"

// Viewport and map constants reused across tests
const VIEWPORT_W = 320
const VIEWPORT_H = 240
const MAP_W = 640
const MAP_H = 480

describe("worldToScreen", () => {
  it("subtracts camera position from world position", () => {
    const camera: Camera = { x: 100, y: 50 }
    expect(worldToScreen(200, 150, camera)).toEqual({ x: 100, y: 100 })
  })

  it("returns world position unchanged when camera is at origin", () => {
    const camera: Camera = { x: 0, y: 0 }
    expect(worldToScreen(64, 96, camera)).toEqual({ x: 64, y: 96 })
  })

  it("produces negative screen coordinates when world position is left of camera", () => {
    const camera: Camera = { x: 200, y: 0 }
    expect(worldToScreen(100, 0, camera)).toEqual({ x: -100, y: 0 })
  })
})

describe("clampCamera", () => {
  it("returns a new object, not the same reference", () => {
    const camera: Camera = { x: 100, y: 100 }
    const result = clampCamera(camera, MAP_W, MAP_H, VIEWPORT_W, VIEWPORT_H)
    expect(result).not.toBe(camera)
  })

  it("leaves a valid camera position unchanged", () => {
    const camera: Camera = { x: 100, y: 80 }
    const result = clampCamera(camera, MAP_W, MAP_H, VIEWPORT_W, VIEWPORT_H)
    expect(result).toEqual({ x: 100, y: 80 })
  })

  it("clamps x to 0 when camera is left of map origin", () => {
    const result = clampCamera(
      { x: -50, y: 0 },
      MAP_W,
      MAP_H,
      VIEWPORT_W,
      VIEWPORT_H,
    )
    expect(result.x).toBe(0)
  })

  it("clamps y to 0 when camera is above map origin", () => {
    const result = clampCamera(
      { x: 0, y: -50 },
      MAP_W,
      MAP_H,
      VIEWPORT_W,
      VIEWPORT_H,
    )
    expect(result.y).toBe(0)
  })

  it("clamps x so the right edge of the viewport does not exceed the map", () => {
    // mapWidth - viewportWidth = 640 - 320 = 320 is the maximum x
    const result = clampCamera(
      { x: 500, y: 0 },
      MAP_W,
      MAP_H,
      VIEWPORT_W,
      VIEWPORT_H,
    )
    expect(result.x).toBe(MAP_W - VIEWPORT_W)
  })

  it("clamps y so the bottom edge of the viewport does not exceed the map", () => {
    // mapHeight - viewportHeight = 480 - 240 = 240 is the maximum y
    const result = clampCamera(
      { x: 0, y: 500 },
      MAP_W,
      MAP_H,
      VIEWPORT_W,
      VIEWPORT_H,
    )
    expect(result.y).toBe(MAP_H - VIEWPORT_H)
  })
})

describe("followPlayer", () => {
  it("centers the camera on the player", () => {
    // Player at map center — camera should be exactly centered
    const camera = followPlayer(320, 240, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    expect(camera.x).toBe(320 - VIEWPORT_W / 2) // 160
    expect(camera.y).toBe(240 - VIEWPORT_H / 2) // 120
  })

  it("clamps to origin when player is near the top-left corner", () => {
    const camera = followPlayer(0, 0, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    expect(camera.x).toBe(0)
    expect(camera.y).toBe(0)
  })

  it("clamps to max when player is near the bottom-right corner", () => {
    const camera = followPlayer(
      MAP_W,
      MAP_H,
      VIEWPORT_W,
      VIEWPORT_H,
      MAP_W,
      MAP_H,
    )
    expect(camera.x).toBe(MAP_W - VIEWPORT_W)
    expect(camera.y).toBe(MAP_H - VIEWPORT_H)
  })
})
