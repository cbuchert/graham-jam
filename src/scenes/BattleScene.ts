import { type InputState, isActionDown } from "../engine/input"
import type { Scene, SceneManager } from "../engine/scene"
import {
  advanceBattle,
  type BattleInput,
  type BattlePhase,
  type BattleState,
  type Combatant,
  createBattleState,
} from "../jrpg/battle"
import { type PlayerStats, statsToCombatant } from "../jrpg/stats"

const SLIME: Combatant = {
  name: "Slime",
  hp: 30,
  maxHp: 30,
  attack: 8,
  defense: 3,
}

const SLIME_XP = 25

// --- Layout constants ---
const BOX_MARGIN = 20
const BOX_H = 140
const LINE_H = 24
const FONT_BODY = "16px monospace"
const FONT_TITLE = "bold 18px monospace"

export type BattleOutcome = "victory" | "defeat" | "fled"
export type BattleExitHandler = (
  outcome: BattleOutcome,
  updatedStats: PlayerStats,
  /** Number of potions consumed during this battle. */
  potionsUsed: number,
) => void

export class BattleScene implements Scene {
  private readonly scenes: SceneManager
  private readonly exitHandler: BattleExitHandler
  private state: BattleState
  private readonly initialPotions: number
  private actionConsumed = false
  private exitTimer: number | null = null
  // Cached so render can show XP/level-up after victory resolves.
  private victoryMessage = ""

  constructor(
    scenes: SceneManager,
    playerStats: PlayerStats,
    potionCount: number,
    onExit: BattleExitHandler,
  ) {
    this.scenes = scenes
    this.exitHandler = onExit
    this.initialPotions = potionCount
    this.state = createBattleState(
      statsToCombatant(playerStats, "Hero"),
      SLIME,
      potionCount,
    )
  }

  onEnter() {
    console.log("BattleScene entered")
  }

  update(dt: number, input: InputState): void {
    if (this.exitTimer !== null) {
      this.exitTimer -= dt
      if (this.exitTimer <= 0) {
        this.scenes.pop()
      }
      return
    }

    const confirmDown = isActionDown(input, "confirm")
    const cancelDown = isActionDown(input, "cancel")
    const itemDown = isActionDown(input, "up")

    if (!confirmDown && !cancelDown && !itemDown) {
      this.actionConsumed = false
    }

    if (this.actionConsumed) return

    let battleInput: BattleInput | null = null

    if (this.state.phase.tag === "player-menu") {
      if (confirmDown) battleInput = { type: "select-action", action: "attack" }
      else if (cancelDown) battleInput = { type: "select-action", action: "run" }
      else if (itemDown) battleInput = { type: "select-action", action: "item" }
    } else if (this.state.phase.tag === "resolving") {
      if (confirmDown) battleInput = { type: "confirm" }
    }

    if (battleInput) {
      this.actionConsumed = true
      this.state = advanceBattle(this.state, battleInput)
      this.startExitTimerIfTerminal(this.state.phase)
    }
  }

  private startExitTimerIfTerminal(phase: BattlePhase): void {
    if (this.exitTimer !== null) return
    if (
      phase.tag === "victory" ||
      phase.tag === "defeat" ||
      phase.tag === "fled"
    ) {
      this.exitTimer = 1.5
      this.fireExitCallback(phase.tag)
    }
  }

  /** Build updated PlayerStats from the battle result and call the exit handler. */
  private fireExitCallback(outcome: BattleOutcome): void {
    const finalHp = Math.max(0, this.state.player.hp)
    // Potions consumed = however many the battle state machine decremented.
    const potionsUsed = this.initialPotions - this.state.playerItems

    if (outcome === "victory") {
      this.victoryMessage = `+${SLIME_XP} XP`
      this.exitHandler(
        "victory",
        {
          hp: finalHp,
          maxHp: this.state.player.maxHp,
          attack: this.state.player.attack,
          defense: this.state.player.defense,
          level: 0, // caller fills from its own stats + applyXp
          xp: SLIME_XP, // caller interprets this as XP gained
        },
        potionsUsed,
      )
    } else {
      this.exitHandler(
        outcome,
        {
          hp: finalHp,
          maxHp: this.state.player.maxHp,
          attack: this.state.player.attack,
          defense: this.state.player.defense,
          level: 0,
          xp: 0,
        },
        potionsUsed,
      )
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = ctx.canvas

    ctx.fillStyle = "rgba(0, 0, 0, 0.85)"
    ctx.fillRect(0, 0, width, height)

    this.drawCombatantBox(
      ctx,
      this.state.enemy,
      BOX_MARGIN,
      BOX_MARGIN,
      width / 2 - BOX_MARGIN * 1.5,
      false,
    )
    this.drawCombatantBox(
      ctx,
      this.state.player,
      width / 2 + BOX_MARGIN / 2,
      BOX_MARGIN,
      width / 2 - BOX_MARGIN * 1.5,
      true,
    )

    const boxY = height - BOX_H - BOX_MARGIN
    const boxW = width - BOX_MARGIN * 2
    this.drawBox(ctx, BOX_MARGIN, boxY, boxW, BOX_H)

    const phase = this.state.phase
    const textX = BOX_MARGIN + 16
    const textY = boxY + 16 + LINE_H

    ctx.font = FONT_BODY
    ctx.fillStyle = "#fff"

    if (phase.tag === "player-menu") {
      ctx.font = FONT_TITLE
      ctx.fillText("Your turn!", textX, textY - LINE_H)
      ctx.font = FONT_BODY
      ctx.fillText("Z / Enter  →  Attack", textX, textY)
      ctx.fillText("X / Escape  →  Run", textX, textY + LINE_H)
      const potionLabel =
        this.state.playerItems > 0
          ? `↑ / W  →  Use Potion  (${this.state.playerItems} left)`
          : "No potions"
      ctx.fillStyle = this.state.playerItems > 0 ? "#fff" : "#666"
      ctx.fillText(potionLabel, textX, textY + LINE_H * 2)
    } else if (phase.tag === "resolving") {
      ctx.fillText(phase.message, textX, textY)
      ctx.fillStyle = "#aaa"
      ctx.fillText("Press Z to continue…", textX, textY + LINE_H * 2)
    } else if (phase.tag === "victory") {
      ctx.font = FONT_TITLE
      ctx.fillStyle = "#ffd700"
      ctx.fillText("Victory!", textX, textY)
      ctx.font = FONT_BODY
      ctx.fillStyle = "#fff"
      ctx.fillText(this.victoryMessage, textX, textY + LINE_H)
      ctx.fillStyle = "#aaa"
      ctx.fillText("Returning to overworld…", textX, textY + LINE_H * 2)
    } else if (phase.tag === "defeat") {
      ctx.font = FONT_TITLE
      ctx.fillStyle = "#ff4444"
      ctx.fillText("Defeated…", textX, textY)
      ctx.font = FONT_BODY
      ctx.fillStyle = "#fff"
      ctx.fillText("Returning to overworld…", textX, textY + LINE_H)
    } else if (phase.tag === "fled") {
      ctx.fillText("Got away safely!", textX, textY)
    }
  }

  private drawBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = "#4a4a8a"
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)
  }

  private drawCombatantBox(
    ctx: CanvasRenderingContext2D,
    combatant: Combatant,
    x: number,
    y: number,
    w: number,
    isPlayer: boolean,
  ): void {
    const boxH = 70
    this.drawBox(ctx, x, y, w, boxH)

    ctx.font = FONT_TITLE
    ctx.fillStyle = isPlayer ? "#7ec8e3" : "#ff9999"
    ctx.fillText(combatant.name, x + 12, y + 22)

    const barX = x + 12
    const barY = y + 34
    const barW = w - 24
    const barH = 14
    ctx.fillStyle = "#333"
    ctx.fillRect(barX, barY, barW, barH)

    const ratio = Math.max(0, combatant.hp / combatant.maxHp)
    ctx.fillStyle =
      ratio > 0.5 ? "#4caf50" : ratio > 0.25 ? "#ff9800" : "#f44336"
    ctx.fillRect(barX, barY, Math.round(barW * ratio), barH)

    ctx.font = "12px monospace"
    ctx.fillStyle = "#fff"
    ctx.fillText(`${combatant.hp}/${combatant.maxHp}`, barX, barY + barH + 14)
  }
}
