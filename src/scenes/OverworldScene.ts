import { type InputState, isActionDown } from "../engine/input"
import type { Scene, SceneManager } from "../engine/scene"
import {
  advanceDialogue,
  createDialogue,
  type DialogueState,
} from "../jrpg/dialogue"
import {
  createInventory,
  type InventoryState,
} from "../jrpg/inventory"
import { createPlayerStats, type PlayerStats } from "../jrpg/stats"
import {
  type CameraController,
  createCameraController,
  worldToScreen,
} from "../rendering/camera"
import { renderDialogueBox } from "../rendering/dialogueBox"
import {
  type AnimationState,
  advanceAnimation,
  type SpriteDirection,
  WALK_CYCLE,
} from "../rendering/sprite"
import {
  getVisibleTileRange,
  renderTilemap,
  type Tilemap,
} from "../rendering/tilemap"
import {
  facingTile,
  readInput,
  slideToward,
  type TileMovementState,
  worldPos,
} from "../world/tileMovement"
// Vite resolves this to the correct URL (hashed in prod).
import tilesheetUrl from "../assets/tilesheet.png"
import { checkTriggers, type Trigger } from "../world/trigger"
import type { OverworldTransitionContext } from "../world/worldGraph"
import type { OverworldSceneConfig } from "./overworldConfig"
import {
  type BattleConsumable,
  type BattleOutcome,
  BattleScene,
} from "./BattleScene"
import { InventoryScene } from "./InventoryScene"

const MOVE_SPEED = 160 // px/s — 32 / 160 = 200ms per tile

// ---------------------------------------------------------------------------

export class OverworldScene implements Scene {
  private readonly scenes: SceneManager
  private readonly config: OverworldSceneConfig
  private readonly map: Tilemap
  private triggers: readonly Trigger[]
  private playerStats: PlayerStats
  private inventory: InventoryState
  private chestCollected: boolean

  /** Owns camera position and target tracking. */
  readonly cam: CameraController = createCameraController()
  /** Cached dt from update() so render() can drive lerp without changing the Scene interface. */
  private dt = 0

  private player: TileMovementState
  private facing: SpriteDirection = "down"
  private anim: AnimationState = { frame: 0, accumulator: 0 }
  private activeTriggers = new Set<number>()
  private dialogue: DialogueState | null = null
  // Prevents Z/X held from spamming across scene transitions.
  private confirmConsumed = false
  private cancelConsumed = false

  private tilesheet: HTMLImageElement | null = null

  constructor(
    scenes: SceneManager,
    spawnPoint: string,
    context: OverworldTransitionContext | undefined,
    config: OverworldSceneConfig,
  ) {
    this.scenes = scenes
    this.config = config
    this.map = config.map
    const tileSize = this.map.tileSize

    if (context) {
      this.playerStats = context.playerStats
      this.inventory = context.inventory
      this.chestCollected = context.chestCollected
    } else {
      this.playerStats = createPlayerStats()
      this.inventory = createInventory()
      this.chestCollected = false
    }

    const sp = config.spawnPoints[spawnPoint]
    if (!sp) {
      throw new Error(`Unknown spawn point "${spawnPoint}" in scene.`)
    }
    this.player = {
      tileX: sp.x,
      tileY: sp.y,
      offsetX: 0,
      offsetY: 0,
      moving: false,
    }

    this.cam.target = () => worldPos(this.player, tileSize)
    this.cam.lerpSpeed = null

    this.triggers = config.getTriggers(this)
  }

  getTransitionContext(): OverworldTransitionContext {
    return {
      playerStats: this.playerStats,
      inventory: this.inventory,
      chestCollected: this.chestCollected,
    }
  }

  getPlayerStats(): PlayerStats {
    return this.playerStats
  }
  setPlayerStats(s: PlayerStats): void {
    this.playerStats = s
  }
  getInventory(): InventoryState {
    return this.inventory
  }
  setInventory(inv: InventoryState): void {
    this.inventory = inv
  }
  getChestCollected(): boolean {
    return this.chestCollected
  }
  setChestCollected(v: boolean): void {
    this.chestCollected = v
  }
  setDialogue(d: DialogueState): void {
    this.dialogue = d
  }

  pushBattleScene(
    effective: PlayerStats,
    consumables: BattleConsumable[],
    onExit: (
      outcome: BattleOutcome,
      partial: PlayerStats,
      consumablesUsed: number,
    ) => void,
  ): void {
    this.scenes.push(
      new BattleScene(this.scenes, effective, consumables, onExit),
    )
  }

  onEnter() {
    console.log("OverworldScene entered")
    if (!this.tilesheet) {
      this.tilesheet = new Image()
      this.tilesheet.src = tilesheetUrl
    }
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
      const result = readInput(this.player, this.facing, input, this.map)
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
      const tileSize = this.map.tileSize
      const { x, y } = worldPos(this.player, tileSize)
      this.activeTriggers = checkTriggers(
        x,
        y,
        tileSize,
        tileSize,
        this.triggers,
        this.activeTriggers,
        (door) => {
          this.scenes.replaceWithScene?.(door.toScene, door.toSpawn)
        },
      )
    }
  }

  /** Return the NPC on the tile the player is currently facing, if any. */
  private findFacingNpc() {
    const npcs = this.config.npcs ?? []
    const { col, row } = facingTile(this.player, this.facing)
    return npcs.find((npc) => npc.tileX === col && npc.tileY === row)
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = ctx.canvas
    const tileSize = this.map.tileSize
    const mapW = this.map.tiles[0].length * tileSize
    const mapH = this.map.tiles.length * tileSize
    const { x: wx, y: wy } = worldPos(this.player, tileSize)

    this.cam.update(this.dt, width, height, mapW, mapH)

    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)

    // --- Tilemap ---
    const range = getVisibleTileRange(
      this.cam.camera.x,
      this.cam.camera.y,
      width,
      height,
      this.map,
    )
    renderTilemap(
      ctx,
      this.map,
      range,
      this.cam.camera.x,
      this.cam.camera.y,
      this.tilesheet,
    )

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
    for (const npc of this.config.npcs ?? []) {
      const ns = worldToScreen(
        npc.tileX * tileSize,
        npc.tileY * tileSize,
        this.cam.camera,
      )
      ctx.fillStyle = npc.color
      ctx.fillRect(Math.round(ns.x), Math.round(ns.y), tileSize, tileSize)
    }

    // --- Chest ---
    const chest = this.config.chest
    if (chest && !this.chestCollected) {
      const cs = worldToScreen(
        chest.tileX * tileSize,
        chest.tileY * tileSize,
        this.cam.camera,
      )
      ctx.fillStyle = "#c8a83c"
      ctx.fillRect(
        Math.round(cs.x) + 4,
        Math.round(cs.y) + 4,
        tileSize - 8,
        tileSize - 8,
      )
      ctx.strokeStyle = "#7a6010"
      ctx.lineWidth = 2
      ctx.strokeRect(
        Math.round(cs.x) + 4,
        Math.round(cs.y) + 4,
        tileSize - 8,
        tileSize - 8,
      )
    }

    // --- Player ---
    const ps = worldToScreen(wx, wy, this.cam.camera)
    ctx.fillStyle = "#3c78d8"
    ctx.fillRect(Math.round(ps.x), Math.round(ps.y), tileSize, tileSize)

    const cx = Math.round(ps.x + tileSize / 2)
    const cy = Math.round(ps.y + tileSize / 2)
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
    const potions = this.inventory.items.potion ?? 0
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
