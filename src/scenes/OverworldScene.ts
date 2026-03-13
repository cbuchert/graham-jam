import { type InputState, isActionDown } from "../engine/input"
import type { Scene } from "../engine/scene"
import type { Camera } from "../rendering/camera"
import { followPlayer, worldToScreen } from "../rendering/camera"
import {
  type AnimationState,
  advanceAnimation,
  type SpriteDirection,
  WALK_CYCLE,
} from "../rendering/sprite"
import { getVisibleTileRange, isSolid } from "../rendering/tilemap"
import { TOWN_MAP } from "../world/maps/town"
import { checkTriggers, type Trigger } from "../world/trigger"

const TILE_SIZE = TOWN_MAP.tileSize
// Time to slide one full tile: TILE_SIZE / MOVE_SPEED = 32 / 160 = 200ms
const MOVE_SPEED = 160 // px/s

const MAP_W = TOWN_MAP.tiles[0].length * TILE_SIZE
const MAP_H = TOWN_MAP.tiles.length * TILE_SIZE

const TILE_COLOR: Record<number, string> = {
  0: "#567d46", // grass
  1: "#2d5a1b", // tree / wall
}

const TRIGGERS: readonly Trigger[] = [
  {
    x: 10 * TILE_SIZE,
    y: 10 * TILE_SIZE,
    width: 6 * TILE_SIZE,
    height: 2 * TILE_SIZE,
    onEnter() {
      console.log("⚔️  A wild encounter zone!")
    },
  },
]

/**
 * Tile-aligned player position.
 * tileX/tileY are the logical (snapped) grid coords.
 * offsetX/offsetY are the visual slide offset in pixels — they animate from
 * ±TILE_SIZE toward 0 during a move, then snap to 0 on arrival.
 */
interface PlayerState {
  tileX: number
  tileY: number
  offsetX: number
  offsetY: number
  moving: boolean
}

/** World-space top-left corner of the player sprite. */
function playerWorldPos(p: PlayerState): { x: number; y: number } {
  return {
    x: p.tileX * TILE_SIZE + p.offsetX,
    y: p.tileY * TILE_SIZE + p.offsetY,
  }
}

export class OverworldScene implements Scene {
  private player: PlayerState = {
    tileX: 7,
    tileY: 11,
    offsetX: 0,
    offsetY: 0,
    moving: false,
  }
  private camera: Camera = { x: 0, y: 0 }
  private facing: SpriteDirection = "down"
  private anim: AnimationState = { frame: 0, accumulator: 0 }
  private activeTriggers = new Set<number>()

  onEnter() {
    console.log("OverworldScene entered")
  }

  update(dt: number, input: InputState): void {
    const wasMoving = this.player.moving

    if (this.player.moving) {
      this.player = this.slideToward(this.player, dt)
    } else {
      this.player = this.readInput(this.player, input)
    }

    if (this.player.moving) {
      this.anim = advanceAnimation(
        this.anim,
        dt,
        WALK_CYCLE[this.facing].frameCount,
      )
    } else {
      this.anim = { frame: 0, accumulator: 0 }
    }

    // Check triggers only on tile arrival — one clean fire per step,
    // not every frame mid-slide.
    const justArrived = wasMoving && !this.player.moving
    if (justArrived || !wasMoving) {
      const { x, y } = playerWorldPos(this.player)
      this.activeTriggers = checkTriggers(
        x,
        y,
        TILE_SIZE,
        TILE_SIZE,
        TRIGGERS,
        this.activeTriggers,
      )
    }
  }

  /**
   * Advance the visual offset toward 0 at MOVE_SPEED px/s.
   * Snaps to exactly 0 on arrival to prevent sub-pixel drift.
   */
  private slideToward(p: PlayerState, dt: number): PlayerState {
    const step = MOVE_SPEED * dt
    const newOffX = approachZero(p.offsetX, step)
    const newOffY = approachZero(p.offsetY, step)
    const arrived = newOffX === 0 && newOffY === 0
    return { ...p, offsetX: newOffX, offsetY: newOffY, moving: !arrived }
  }

  /**
   * Read directional input and commit to moving one tile if the target is walkable.
   * Diagonal input is resolved to one axis (vertical takes priority).
   * Facing updates even when the target tile is blocked — classic JRPG behaviour.
   */
  private readInput(p: PlayerState, input: InputState): PlayerState {
    let dtileX = 0
    let dtileY = 0
    let facing = this.facing

    if (isActionDown(input, "up")) {
      dtileY = -1
      facing = "up"
    } else if (isActionDown(input, "down")) {
      dtileY = 1
      facing = "down"
    } else if (isActionDown(input, "left")) {
      dtileX = -1
      facing = "left"
    } else if (isActionDown(input, "right")) {
      dtileX = 1
      facing = "right"
    }

    this.facing = facing

    if (dtileX === 0 && dtileY === 0) return p

    const nextTileX = p.tileX + dtileX
    const nextTileY = p.tileY + dtileY

    if (isSolid(TOWN_MAP, nextTileX, nextTileY)) return p // blocked — face but don't move

    return {
      tileX: nextTileX,
      tileY: nextTileY,
      // Offset starts at the OLD position relative to the new tile, slides to 0
      offsetX: -dtileX * TILE_SIZE,
      offsetY: -dtileY * TILE_SIZE,
      moving: true,
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = ctx.canvas
    const { x: wx, y: wy } = playerWorldPos(this.player)

    this.camera = followPlayer(wx, wy, width, height, MAP_W, MAP_H)

    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)

    const range = getVisibleTileRange(
      this.camera.x,
      this.camera.y,
      width,
      height,
      TOWN_MAP,
    )
    for (let row = range.minRow; row <= range.maxRow; row++) {
      for (let col = range.minCol; col <= range.maxCol; col++) {
        const tileId = isSolid(TOWN_MAP, col, row) ? 1 : 0
        const sx = Math.round(col * TILE_SIZE - this.camera.x)
        const sy = Math.round(row * TILE_SIZE - this.camera.y)
        ctx.fillStyle = TILE_COLOR[tileId] ?? "#000"
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE)
      }
    }

    // Draw trigger zones — semi-transparent so you can see them during development
    for (const trigger of TRIGGERS) {
      const ts = worldToScreen(trigger.x, trigger.y, this.camera)
      ctx.fillStyle = "rgba(255, 80, 80, 0.25)"
      ctx.fillRect(
        Math.round(ts.x),
        Math.round(ts.y),
        trigger.width,
        trigger.height,
      )
      ctx.strokeStyle = "rgba(255, 80, 80, 0.6)"
      ctx.lineWidth = 1
      ctx.strokeRect(
        Math.round(ts.x),
        Math.round(ts.y),
        trigger.width,
        trigger.height,
      )
    }

    const ps = worldToScreen(wx, wy, this.camera)
    ctx.fillStyle = "#3c78d8"
    ctx.fillRect(Math.round(ps.x), Math.round(ps.y), TILE_SIZE, TILE_SIZE)

    const cx = Math.round(ps.x + TILE_SIZE / 2)
    const cy = Math.round(ps.y + TILE_SIZE / 2)
    const ox = this.facing === "left" ? -8 : this.facing === "right" ? 8 : 0
    const oy = this.facing === "up" ? -8 : this.facing === "down" ? 8 : 0
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.arc(cx + ox, cy + oy, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Move a value toward 0 by `step`, snapping to exactly 0 when close enough. */
function approachZero(value: number, step: number): number {
  if (Math.abs(value) <= step) return 0
  return value - Math.sign(value) * step
}
