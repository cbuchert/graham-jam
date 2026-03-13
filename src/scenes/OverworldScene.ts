import { type InputState, isActionDown } from "../engine/input"
import type { Scene, SceneManager } from "../engine/scene"
import {
  advanceDialogue,
  createDialogue,
  currentLine,
  type DialogueState,
} from "../jrpg/dialogue"
import { applyXp, createPlayerStats, type PlayerStats } from "../jrpg/stats"
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
import { type BattleOutcome, BattleScene } from "./BattleScene"

const TILE_SIZE = TOWN_MAP.tileSize
const MOVE_SPEED = 160 // px/s — 32 / 160 = 200ms per tile

const MAP_W = TOWN_MAP.tiles[0].length * TILE_SIZE
const MAP_H = TOWN_MAP.tiles.length * TILE_SIZE

const TILE_COLOR: Record<number, string> = {
  0: "#567d46",
  1: "#2d5a1b",
}

// ---------------------------------------------------------------------------
// NPC data

interface Npc {
  tileX: number
  tileY: number
  color: string
  speaker: string
  dialogue: readonly string[]
}

const NPCS: readonly Npc[] = [
  {
    tileX: 15,
    tileY: 8,
    color: "#e8a838",
    speaker: "Villager",
    dialogue: [
      "Hey there, adventurer!",
      "Watch out for the tall grass to the east.",
      "Wild creatures lurk there...",
    ],
  },
]

// ---------------------------------------------------------------------------
// Triggers

function makeTriggers(
  scenes: SceneManager,
  getStats: () => PlayerStats,
  setStats: (s: PlayerStats) => void,
): readonly Trigger[] {
  return [
    {
      x: 10 * TILE_SIZE,
      y: 10 * TILE_SIZE,
      width: 6 * TILE_SIZE,
      height: 2 * TILE_SIZE,
      onEnter() {
        scenes.push(
          new BattleScene(
            scenes,
            getStats(),
            (outcome: BattleOutcome, partial) => {
              const current = getStats()
              if (outcome === "victory") {
                // partial.xp carries the XP gained; apply it to the current stats
                setStats(applyXp({ ...current, hp: partial.hp }, partial.xp))
              } else {
                // defeat or fled: just update HP
                setStats({ ...current, hp: partial.hp })
              }
            },
          ),
        )
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Player state

/**
 * Tile-aligned player position.
 * tileX/tileY are the logical grid coords.
 * offsetX/offsetY animate from ±TILE_SIZE toward 0 during a move.
 */
interface PlayerState {
  tileX: number
  tileY: number
  offsetX: number
  offsetY: number
  moving: boolean
}

function playerWorldPos(p: PlayerState): { x: number; y: number } {
  return {
    x: p.tileX * TILE_SIZE + p.offsetX,
    y: p.tileY * TILE_SIZE + p.offsetY,
  }
}

// The tile the player is currently facing (one step ahead).
function facingTile(
  p: PlayerState,
  facing: SpriteDirection,
): { col: number; row: number } {
  return {
    col: p.tileX + (facing === "right" ? 1 : facing === "left" ? -1 : 0),
    row: p.tileY + (facing === "down" ? 1 : facing === "up" ? -1 : 0),
  }
}

// ---------------------------------------------------------------------------

export class OverworldScene implements Scene {
  private readonly triggers: readonly Trigger[]
  private playerStats: PlayerStats = createPlayerStats()

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
  private dialogue: DialogueState | null = null
  // Prevents Z held from skipping multiple lines or immediately re-opening dialogue.
  private confirmConsumed = false

  constructor(scenes: SceneManager) {
    this.triggers = makeTriggers(
      scenes,
      () => this.playerStats,
      (s) => {
        this.playerStats = s
      },
    )
  }

  onEnter() {
    console.log("OverworldScene entered")
  }

  update(dt: number, input: InputState): void {
    const confirmDown = isActionDown(input, "confirm")

    // Reset consumed once Z/Enter is released.
    if (!confirmDown) this.confirmConsumed = false

    // --- Dialogue mode: block all movement, advance on Z ---
    if (this.dialogue !== null) {
      if (confirmDown && !this.confirmConsumed) {
        this.confirmConsumed = true
        this.dialogue = advanceDialogue(this.dialogue)
      }
      return
    }

    // --- Overworld movement ---
    const wasMoving = this.player.moving

    if (this.player.moving) {
      this.player = this.slideToward(this.player, dt)
    } else {
      // Check for NPC talk before movement so Z doesn't also step forward.
      if (confirmDown && !this.confirmConsumed) {
        const npc = this.findFacingNpc()
        if (npc) {
          this.confirmConsumed = true
          this.dialogue = createDialogue(npc.dialogue, npc.speaker)
          return
        }
      }
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

    const justArrived = wasMoving && !this.player.moving
    if (justArrived || !wasMoving) {
      const { x, y } = playerWorldPos(this.player)
      this.activeTriggers = checkTriggers(
        x,
        y,
        TILE_SIZE,
        TILE_SIZE,
        this.triggers,
        this.activeTriggers,
      )
    }
  }

  /** Return the NPC on the tile the player is currently facing, if any. */
  private findFacingNpc(): Npc | undefined {
    const { col, row } = facingTile(this.player, this.facing)
    return NPCS.find((npc) => npc.tileX === col && npc.tileY === row)
  }

  private slideToward(p: PlayerState, dt: number): PlayerState {
    const step = MOVE_SPEED * dt
    const newOffX = approachZero(p.offsetX, step)
    const newOffY = approachZero(p.offsetY, step)
    const arrived = newOffX === 0 && newOffY === 0
    return { ...p, offsetX: newOffX, offsetY: newOffY, moving: !arrived }
  }

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

    if (isSolid(TOWN_MAP, nextTileX, nextTileY)) return p

    return {
      tileX: nextTileX,
      tileY: nextTileY,
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

    // --- Tilemap ---
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

    // --- Trigger zones (development overlay) ---
    for (const trigger of this.triggers) {
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

    // --- NPCs ---
    for (const npc of NPCS) {
      const ns = worldToScreen(
        npc.tileX * TILE_SIZE,
        npc.tileY * TILE_SIZE,
        this.camera,
      )
      ctx.fillStyle = npc.color
      ctx.fillRect(Math.round(ns.x), Math.round(ns.y), TILE_SIZE, TILE_SIZE)
    }

    // --- Player ---
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

    // --- Stats HUD (top-left corner) ---
    this.renderStatsHud(ctx)

    // --- Dialogue box (rendered last — always on top) ---
    if (this.dialogue !== null) {
      this.renderDialogue(ctx, this.dialogue, width, height)
    }
  }

  private renderStatsHud(ctx: CanvasRenderingContext2D): void {
    const s = this.playerStats
    const pad = 10
    ctx.fillStyle = "rgba(0,0,0,0.55)"
    ctx.fillRect(pad, pad, 160, 52)
    ctx.font = "13px monospace"
    ctx.fillStyle = "#7ec8e3"
    ctx.fillText(`Lv ${s.level}  HP ${s.hp}/${s.maxHp}`, pad + 8, pad + 18)
    ctx.fillStyle = "#aaa"
    ctx.fillText(`XP ${s.xp} / ${s.level * 100}`, pad + 8, pad + 36)
  }

  private renderDialogue(
    ctx: CanvasRenderingContext2D,
    state: DialogueState,
    width: number,
    height: number,
  ): void {
    const margin = 20
    const boxH = 110
    const boxX = margin
    const boxY = height - boxH - margin
    const boxW = width - margin * 2

    // Box background + border
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(boxX, boxY, boxW, boxH)
    ctx.strokeStyle = "#8888cc"
    ctx.lineWidth = 2
    ctx.strokeRect(boxX, boxY, boxW, boxH)

    // Speaker name tab
    if (state.speaker) {
      ctx.fillStyle = "#8888cc"
      ctx.fillRect(boxX, boxY - 24, 120, 24)
      ctx.fillStyle = "#fff"
      ctx.font = "bold 13px monospace"
      ctx.fillText(state.speaker, boxX + 10, boxY - 7)
    }

    // Dialogue text
    ctx.font = "16px monospace"
    ctx.fillStyle = "#fff"
    ctx.fillText(currentLine(state), boxX + 16, boxY + 36)

    // "Press Z" prompt — blink every half-second using real time
    const blink = Math.floor(Date.now() / 500) % 2 === 0
    if (blink) {
      ctx.font = "12px monospace"
      ctx.fillStyle = "#aaa"
      ctx.fillText("Z  continue", boxX + boxW - 100, boxY + boxH - 12)
    }
  }
}

function approachZero(value: number, step: number): number {
  if (Math.abs(value) <= step) return 0
  return value - Math.sign(value) * step
}
