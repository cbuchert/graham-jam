import { type InputState, isActionDown } from "../engine/input"
import type { Scene, SceneManager } from "../engine/scene"
import {
  advanceDialogue,
  createDialogue,
  type DialogueState,
} from "../jrpg/dialogue"
import {
  addItem,
  createInventory,
  derivedStats,
  type InventoryState,
  removeItem,
} from "../jrpg/inventory"
import { ITEM_REGISTRY } from "../jrpg/items"
import { applyXp, createPlayerStats, type PlayerStats } from "../jrpg/stats"
import {
  createCameraController,
  type CameraController,
  worldToScreen,
} from "../rendering/camera"
import { renderDialogueBox } from "../rendering/dialogueBox"
import {
  type AnimationState,
  advanceAnimation,
  type SpriteDirection,
  WALK_CYCLE,
} from "../rendering/sprite"
import { getTileId, getVisibleTileRange } from "../rendering/tilemap"
import { TOWN_MAP } from "../world/maps/town"
import {
  facingTile,
  readInput,
  slideToward,
  type TileMovementState,
  worldPos,
} from "../world/tileMovement"
import { checkTriggers, type Trigger } from "../world/trigger"
import {
  type BattleConsumable,
  type BattleOutcome,
  BattleScene,
} from "./BattleScene"
import { InventoryScene } from "./InventoryScene"

const TILE_SIZE = TOWN_MAP.tileSize
const MOVE_SPEED = 160 // px/s — 32 / 160 = 200ms per tile

const MAP_W = TOWN_MAP.tiles[0].length * TILE_SIZE
const MAP_H = TOWN_MAP.tiles.length * TILE_SIZE

const TILE_COLOR: Record<number, string> = {
  0: "#567d46", // Grass
  1: "#2d5a1b", // Wall / tree
  2: "#2a5a9e", // Water
  3: "#8b6b4a", // Door
  4: "#c8a820", // Chest
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

// (Triggers are created inline in the constructor so arrow functions can close over `this`.)

// ---------------------------------------------------------------------------

export class OverworldScene implements Scene {
  private readonly scenes: SceneManager
  private readonly triggers: readonly Trigger[]
  private playerStats: PlayerStats = createPlayerStats()
  private inventory: InventoryState = createInventory()
  private chestCollected = false

  /** Owns camera position and target tracking. */
  readonly cam: CameraController = createCameraController()
  /** Cached dt from update() so render() can drive lerp without changing the Scene interface. */
  private dt = 0

  private player: TileMovementState = {
    tileX: 7,
    tileY: 11,
    offsetX: 0,
    offsetY: 0,
    moving: false,
  }
  private facing: SpriteDirection = "down"
  private anim: AnimationState = { frame: 0, accumulator: 0 }
  private activeTriggers = new Set<number>()
  private dialogue: DialogueState | null = null
  // Prevents Z/X held from spamming across scene transitions.
  private confirmConsumed = false
  private cancelConsumed = false

  constructor(scenes: SceneManager) {
    this.scenes = scenes
    // Camera follows the player by default. Initialized here (not onEnter) so
    // it's live for the entire lifetime of the scene, including when the scene
    // resumes after a pushed scene (e.g. BattleScene) pops off the stack.
    this.cam.target = () => worldPos(this.player, TILE_SIZE)
    this.cam.lerpSpeed = null

    this.triggers = [
      // Battle encounter zone — rows 10-11, cols 10-15.
      {
        x: 10 * TILE_SIZE,
        y: 10 * TILE_SIZE,
        width: 6 * TILE_SIZE,
        height: 2 * TILE_SIZE,
        onEnter: () => {
          // Derive effective stats from base + equipment before entering battle.
          const effective = derivedStats(
            this.playerStats,
            this.inventory,
            ITEM_REGISTRY,
          )
          // Build a consumables snapshot for the battle item menu.
          const consumables: BattleConsumable[] = Object.entries(
            this.inventory.items,
          )
            .filter(
              ([id, qty]) =>
                qty > 0 && ITEM_REGISTRY[id]?.type === "consumable",
            )
            .map(([id, qty]) => {
              const item = ITEM_REGISTRY[id]!
              return {
                name: item.name,
                qty,
                description: item.type === "consumable" ? item.description : "",
              }
            })
          this.scenes.push(
            new BattleScene(
              this.scenes,
              effective,
              consumables,
              (
                outcome: BattleOutcome,
                partial: PlayerStats,
                consumablesUsed: number,
              ) => {
                // Deduct potions used in battle from the persistent inventory.
                let inv = this.inventory
                for (let i = 0; i < consumablesUsed; i++) {
                  try {
                    inv = removeItem(inv, "potion")
                  } catch {
                    break
                  }
                }
                this.inventory = inv

                if (outcome === "victory") {
                  // partial.xp carries XP gained; merge HP then apply XP.
                  this.playerStats = applyXp(
                    { ...this.playerStats, hp: partial.hp },
                    partial.xp,
                  )
                } else {
                  this.playerStats = { ...this.playerStats, hp: partial.hp }
                }
              },
            ),
          )
        },
      },
      // Chest — one-shot potion pickup inside the small building (tileX:8, tileY:7).
      {
        x: 8 * TILE_SIZE,
        y: 7 * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
        onEnter: () => {
          if (this.chestCollected) return
          this.chestCollected = true
          this.inventory = addItem(this.inventory, "potion")
          this.dialogue = createDialogue(["You found a Potion!"], "Chest")
        },
      },
    ]
  }

  onEnter() {
    console.log("OverworldScene entered")
  }

  update(dt: number, input: InputState): void {
    this.dt = dt
    const confirmDown = isActionDown(input, "confirm")
    const cancelDown = isActionDown(input, "cancel")

    // Reset consumed flags once the key is released.
    if (!confirmDown) this.confirmConsumed = false
    if (!cancelDown) this.cancelConsumed = false

    // --- Cancel: open inventory (when not in dialogue) ---
    if (cancelDown && !this.cancelConsumed && this.dialogue === null) {
      this.cancelConsumed = true
      this.scenes.push(
        new InventoryScene(
          this.scenes,
          this.inventory,
          this.playerStats,
          (inv, stats) => {
            this.inventory = inv
            this.playerStats = stats
          },
        ),
      )
      return
    }

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
      this.player = slideToward(this.player, dt, MOVE_SPEED)
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
      const result = readInput(this.player, this.facing, input, TOWN_MAP)
      this.player = result.state
      this.facing = result.facing
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
      const { x, y } = worldPos(this.player, TILE_SIZE)
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

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = ctx.canvas
    const { x: wx, y: wy } = worldPos(this.player, TILE_SIZE)

    this.cam.update(this.dt, width, height, MAP_W, MAP_H)

    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)

    // --- Tilemap ---
    const range = getVisibleTileRange(
      this.cam.camera.x,
      this.cam.camera.y,
      width,
      height,
      TOWN_MAP,
    )
    for (let row = range.minRow; row <= range.maxRow; row++) {
      for (let col = range.minCol; col <= range.maxCol; col++) {
        const tileId = getTileId(TOWN_MAP, col, row)
        const sx = Math.round(col * TILE_SIZE - this.cam.camera.x)
        const sy = Math.round(row * TILE_SIZE - this.cam.camera.y)
        ctx.fillStyle = TILE_COLOR[tileId] ?? "#000"
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE)
      }
    }

    // --- Trigger zones (development overlay) ---
    for (const trigger of this.triggers) {
      const ts = worldToScreen(trigger.x, trigger.y, this.cam.camera)
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
        this.cam.camera,
      )
      ctx.fillStyle = npc.color
      ctx.fillRect(Math.round(ns.x), Math.round(ns.y), TILE_SIZE, TILE_SIZE)
    }

    // --- Chest (tileX:8, tileY:7 — inside the small building) ---
    if (!this.chestCollected) {
      const cs = worldToScreen(8 * TILE_SIZE, 7 * TILE_SIZE, this.cam.camera)
      ctx.fillStyle = "#c8a83c"
      ctx.fillRect(
        Math.round(cs.x) + 4,
        Math.round(cs.y) + 4,
        TILE_SIZE - 8,
        TILE_SIZE - 8,
      )
      ctx.strokeStyle = "#7a6010"
      ctx.lineWidth = 2
      ctx.strokeRect(
        Math.round(cs.x) + 4,
        Math.round(cs.y) + 4,
        TILE_SIZE - 8,
        TILE_SIZE - 8,
      )
    }

    // --- Player ---
    const ps = worldToScreen(wx, wy, this.cam.camera)
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
      renderDialogueBox(ctx, this.dialogue, width, height)
    }
  }

  private renderStatsHud(ctx: CanvasRenderingContext2D): void {
    const s = this.playerStats
    const potions = this.inventory.items["potion"] ?? 0
    const pad = 10
    ctx.fillStyle = "rgba(0,0,0,0.55)"
    ctx.fillRect(pad, pad, 175, 82)
    ctx.font = "13px monospace"
    ctx.fillStyle = "#7ec8e3"
    ctx.fillText(`Lv ${s.level}  HP ${s.hp}/${s.maxHp}`, pad + 8, pad + 18)
    ctx.fillStyle = "#aaa"
    ctx.fillText(`XP ${s.xp} / ${s.level * 100}`, pad + 8, pad + 36)
    ctx.fillStyle = "#e8c86a"
    ctx.fillText(`Potions: ${potions}`, pad + 8, pad + 54)
    ctx.fillStyle = "#555"
    ctx.font = "11px monospace"
    ctx.fillText("[X] Inventory", pad + 8, pad + 68)
  }
}
