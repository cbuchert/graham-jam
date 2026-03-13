import { describe, expect, it } from "vitest"
import {
  approachLinear,
  type Camera,
  clampCamera,
  createCameraController,
  followTarget,
  worldToScreen,
} from "./camera"

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

describe("approachLinear", () => {
  it("moves toward target by maxStep", () => {
    expect(approachLinear(0, 100, 10)).toBe(10)
  })

  it("returns target exactly when within maxStep — no overshoot", () => {
    expect(approachLinear(95, 100, 10)).toBe(100)
  })

  it("works in the negative direction", () => {
    expect(approachLinear(100, 0, 15)).toBe(85)
  })

  it("returns target when already there", () => {
    expect(approachLinear(50, 50, 10)).toBe(50)
  })
})

describe("followTarget", () => {
  it("centers the camera on the target position", () => {
    const camera = followTarget(320, 240, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    expect(camera.x).toBe(320 - VIEWPORT_W / 2) // 160
    expect(camera.y).toBe(240 - VIEWPORT_H / 2) // 120
  })

  it("clamps to origin when target is near the top-left corner", () => {
    const camera = followTarget(0, 0, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    expect(camera.x).toBe(0)
    expect(camera.y).toBe(0)
  })

  it("clamps to max when target is near the bottom-right corner", () => {
    const camera = followTarget(
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

describe("CameraController", () => {
  // followTarget(320, 240, 320, 240, 640, 480) → { x: 160, y: 120 }
  const TARGET_WORLD = { x: 320, y: 240 }
  const DESIRED_CAM = { x: 160, y: 120 } // desired camera position for that target

  it("starts at origin", () => {
    const cam = createCameraController()
    expect(cam.camera).toEqual({ x: 0, y: 0 })
  })

  it("does not move when target is null", () => {
    const cam = createCameraController()
    cam.update(0.016, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    expect(cam.camera).toEqual({ x: 0, y: 0 })
  })

  it("snaps to desired position when lerpSpeed is null", () => {
    const cam = createCameraController()
    cam.target = () => TARGET_WORLD
    cam.lerpSpeed = null
    cam.update(0.016, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    expect(cam.camera).toEqual(DESIRED_CAM)
  })

  it("moves linearly toward target at lerpSpeed px/s", () => {
    const cam = createCameraController()
    cam.target = () => TARGET_WORLD
    cam.lerpSpeed = 100
    const dt = 0.1 // 10px per axis this frame
    cam.update(dt, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    // Camera starts at 0,0; desired is 160,120 — both deltas > 10
    expect(cam.camera.x).toBeCloseTo(10)
    expect(cam.camera.y).toBeCloseTo(10)
  })

  it("stops exactly at target without overshoot", () => {
    const cam = createCameraController()
    cam.target = () => TARGET_WORLD
    cam.lerpSpeed = 10_000 // fast enough to cross target in one frame
    cam.update(0.016, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    expect(cam.camera).toEqual(DESIRED_CAM)
  })

  it("accumulates position across multiple frames", () => {
    const cam = createCameraController()
    cam.target = () => TARGET_WORLD
    cam.lerpSpeed = 100
    cam.update(0.1, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H) // +10 each axis
    cam.update(0.1, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H) // +10 each axis
    expect(cam.camera.x).toBeCloseTo(20)
    expect(cam.camera.y).toBeCloseTo(20)
  })

  it("retargets immediately when target getter changes", () => {
    const cam = createCameraController()
    cam.target = () => TARGET_WORLD
    cam.lerpSpeed = null
    cam.update(0.016, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    expect(cam.camera).toEqual(DESIRED_CAM)

    // Switch to a different target — top-left corner
    cam.target = () => ({ x: 0, y: 0 })
    cam.update(0.016, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    expect(cam.camera).toEqual({ x: 0, y: 0 })
  })

  it("freezes position when target is set to null mid-scene", () => {
    const cam = createCameraController()
    cam.target = () => TARGET_WORLD
    cam.lerpSpeed = null
    cam.update(0.016, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    const frozenPos = { ...cam.camera }

    cam.target = null
    cam.update(0.016, VIEWPORT_W, VIEWPORT_H, MAP_W, MAP_H)
    expect(cam.camera).toEqual(frozenPos)
  })
})
