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

const PLAYER_SPEED = 160 // px/s — from grand-plan.md key constants

const MAP_W = TOWN_MAP.tiles[0].length * TOWN_MAP.tileSize
const MAP_H = TOWN_MAP.tiles.length * TOWN_MAP.tileSize

// Tile colors — placeholder until spritesheet lands
const TILE_COLOR: Record<number, string> = {
  0: "#567d46", // grass
  1: "#2d5a1b", // tree / wall
}

export class OverworldScene implements Scene {
  private player = {
    x: 7 * TOWN_MAP.tileSize, // start in open floor area
    y: 11 * TOWN_MAP.tileSize,
  }
  private camera: Camera = { x: 0, y: 0 }
  private facing: SpriteDirection = "down"
  private anim: AnimationState = { frame: 0, accumulator: 0 }

  onEnter() {
    console.log("OverworldScene entered")
  }

  update(dt: number, input: InputState): void {
    let dx = 0
    let dy = 0

    if (isActionDown(input, "up")) {
      dy = -1
      this.facing = "up"
    }
    if (isActionDown(input, "down")) {
      dy = 1
      this.facing = "down"
    }
    if (isActionDown(input, "left")) {
      dx = -1
      this.facing = "left"
    }
    if (isActionDown(input, "right")) {
      dx = 1
      this.facing = "right"
    }

    this.player.x += dx * PLAYER_SPEED * dt
    this.player.y += dy * PLAYER_SPEED * dt

    const moving = dx !== 0 || dy !== 0
    if (moving) {
      this.anim = advanceAnimation(
        this.anim,
        dt,
        WALK_CYCLE[this.facing].frameCount,
      )
    } else {
      // Return to first frame when idle
      this.anim = { frame: 0, accumulator: 0 }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = ctx.canvas

    // Camera updates here — viewport dimensions only known at render time
    this.camera = followPlayer(
      this.player.x,
      this.player.y,
      width,
      height,
      MAP_W,
      MAP_H,
    )

    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)

    // Draw tiles — culled to viewport
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
        const sx = Math.round(col * TOWN_MAP.tileSize - this.camera.x)
        const sy = Math.round(row * TOWN_MAP.tileSize - this.camera.y)
        ctx.fillStyle = TILE_COLOR[tileId] ?? "#000"
        ctx.fillRect(sx, sy, TOWN_MAP.tileSize, TOWN_MAP.tileSize)
      }
    }

    // Draw player
    const ps = worldToScreen(this.player.x, this.player.y, this.camera)
    const ts = TOWN_MAP.tileSize
    ctx.fillStyle = "#3c78d8"
    ctx.fillRect(Math.round(ps.x), Math.round(ps.y), ts, ts)

    // Small direction indicator so facing is readable without sprites
    const cx = Math.round(ps.x + ts / 2)
    const cy = Math.round(ps.y + ts / 2)
    const ox = this.facing === "left" ? -8 : this.facing === "right" ? 8 : 0
    const oy = this.facing === "up" ? -8 : this.facing === "down" ? 8 : 0
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.arc(cx + ox, cy + oy, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}
