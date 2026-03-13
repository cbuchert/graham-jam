import { type InputState, isActionDown } from "../engine/input"
import type { Scene, SceneManager } from "../engine/scene"
import {
  derivedStats,
  type EquipmentSlots,
  equip,
  type InventoryState,
  removeItem,
  unequip,
} from "../jrpg/inventory"
import { ITEM_REGISTRY, type ItemRegistry } from "../jrpg/items"
import type { PlayerStats } from "../jrpg/stats"
import { drawPanel } from "../rendering/ui"

// ---------------------------------------------------------------------------
// Row types — what the cursor navigates

type SlotRow = {
  kind: "slot"
  slot: keyof EquipmentSlots
  label: string
  itemId: string | null
}
type BagRow = {
  kind: "bag-equip"
  itemId: string
  name: string
  statLine: string
}
type ConsRow = {
  kind: "consumable"
  itemId: string
  name: string
  qty: number
  description: string
}
type Row = SlotRow | BagRow | ConsRow

// ---------------------------------------------------------------------------
// Layout — canvas is always 640×360

const M = 16
const PX = M,
  PY = M
const PW = 608,
  PH = 328
const TITLE_Y = PY + 20
const TAB_Y = PY + 40
const DIV_Y = PY + 52
const CONTENT_Y = PY + 64
const ROW_H = 22
const LEFT_W = 360
const RIGHT_X = PX + LEFT_W + 8
const HINT_Y = PY + PH - 10

const FONT_BOLD = "bold 14px monospace"
const FONT = "14px monospace"
const FONT_SM = "12px monospace"

export class InventoryScene implements Scene {
  private readonly scenes: SceneManager
  private readonly onClose: (inv: InventoryState, stats: PlayerStats) => void
  private readonly registry: ItemRegistry

  private tab: "equipment" | "consumable" = "equipment"
  private cursor = 0
  // Start true so we ignore whatever key triggered the scene push.
  // Resets to false only once all keys are released.
  private inputConsumed = true
  private inventory: InventoryState
  private stats: PlayerStats

  constructor(
    scenes: SceneManager,
    inventory: InventoryState,
    stats: PlayerStats,
    /** Called when the scene closes. Apply the returned state to the owner scene. */
    onClose: (inv: InventoryState, stats: PlayerStats) => void,
    registry: ItemRegistry = ITEM_REGISTRY,
  ) {
    this.scenes = scenes
    this.onClose = onClose
    this.registry = registry
    this.inventory = inventory
    this.stats = stats
  }

  update(_dt: number, input: InputState): void {
    const confirm = isActionDown(input, "confirm")
    const cancel = isActionDown(input, "cancel")
    const up = isActionDown(input, "up")
    const down = isActionDown(input, "down")
    const left = isActionDown(input, "left")
    const right = isActionDown(input, "right")

    if (!(confirm || cancel || up || down || left || right)) {
      this.inputConsumed = false
      return
    }
    if (this.inputConsumed) return
    this.inputConsumed = true

    if (cancel) {
      this.onClose(this.inventory, this.stats)
      this.scenes.pop()
      return
    }

    if (left || right) {
      this.tab = this.tab === "equipment" ? "consumable" : "equipment"
      this.cursor = 0
      return
    }

    const rows = this.buildRows()
    if (up) this.cursor = Math.max(0, this.cursor - 1)
    if (down) this.cursor = Math.min(rows.length - 1, this.cursor + 1)

    if (confirm && rows.length > 0) {
      const row = rows[this.cursor]
      if (row) this.activateRow(row)
    }
  }

  private activateRow(row: Row): void {
    if (row.kind === "slot") {
      if (row.itemId !== null) {
        this.inventory = unequip(this.inventory, row.slot)
      }
    } else if (row.kind === "bag-equip") {
      this.inventory = equip(this.inventory, row.itemId, this.registry)
      this.clampCursor()
    } else if (row.kind === "consumable") {
      const item = this.registry[row.itemId]
      if (item?.type === "consumable") {
        this.stats = item.effect(this.stats)
        try {
          this.inventory = removeItem(this.inventory, row.itemId)
        } catch {
          /* empty */
        }
        this.clampCursor()
      }
    }
  }

  private clampCursor(): void {
    this.cursor = Math.min(
      this.cursor,
      Math.max(0, this.buildRows().length - 1),
    )
  }

  // ---------------------------------------------------------------------------

  private buildRows(): Row[] {
    return this.tab === "equipment"
      ? this.buildEquipRows()
      : this.buildConsumableRows()
  }

  private buildEquipRows(): Row[] {
    const rows: Row[] = [
      {
        kind: "slot",
        slot: "weapon",
        label: "Weapon   ",
        itemId: this.inventory.equipped.weapon,
      },
      {
        kind: "slot",
        slot: "armour",
        label: "Armour   ",
        itemId: this.inventory.equipped.armour,
      },
      {
        kind: "slot",
        slot: "accessory",
        label: "Accessory",
        itemId: this.inventory.equipped.accessory,
      },
    ]
    for (const [itemId, qty] of Object.entries(this.inventory.items)) {
      if (qty <= 0) continue
      const item = this.registry[itemId]
      if (item?.type !== "equipment") continue
      const d = item.statDeltas
      const parts: string[] = []
      if (d.attack) parts.push(`ATK ${d.attack > 0 ? "+" : ""}${d.attack}`)
      if (d.defense) parts.push(`DEF ${d.defense > 0 ? "+" : ""}${d.defense}`)
      if (d.maxHp) parts.push(`HP ${d.maxHp > 0 ? "+" : ""}${d.maxHp}`)
      rows.push({
        kind: "bag-equip",
        itemId,
        name: item.name,
        statLine: parts.join(" ") || "—",
      })
    }
    return rows
  }

  private buildConsumableRows(): Row[] {
    const rows: ConsRow[] = []
    for (const [itemId, qty] of Object.entries(this.inventory.items)) {
      if (qty <= 0) continue
      const item = this.registry[itemId]
      if (item?.type !== "consumable") continue
      rows.push({
        kind: "consumable",
        itemId,
        name: item.name,
        qty,
        description: item.description,
      })
    }
    return rows
  }

  // ---------------------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    // Dim the overworld underneath.
    ctx.fillStyle = "rgba(0,0,0,0.75)"
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    drawPanel(ctx, PX, PY, PW, PH)

    // Title
    ctx.font = FONT_BOLD
    ctx.fillStyle = "#e0d0a0"
    ctx.fillText("INVENTORY", PX + 12, TITLE_Y)

    // Tab headers
    const TABS: Array<["equipment" | "consumable", string]> = [
      ["equipment", "Equipment"],
      ["consumable", "Consumables"],
    ]
    let tx = PX + 110
    for (const [tab, label] of TABS) {
      const active = this.tab === tab
      if (active) {
        const w = ctx.measureText(label).width + 10
        ctx.fillStyle = "rgba(74,74,138,0.7)"
        ctx.fillRect(tx - 5, TAB_Y - 14, w, 18)
      }
      ctx.font = active ? FONT_BOLD : FONT
      ctx.fillStyle = active ? "#fff" : "#666"
      ctx.fillText(label, tx, TAB_Y)
      tx += 140
    }

    // Divider
    ctx.strokeStyle = "#4a4a8a"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(PX + 6, DIV_Y)
    ctx.lineTo(PX + PW - 6, DIV_Y)
    ctx.stroke()

    const rows = this.buildRows()
    if (this.tab === "equipment") {
      this.renderEquipTab(ctx, rows)
    } else {
      this.renderConsumableTab(ctx, rows as ConsRow[])
    }

    // Hint bar
    ctx.font = FONT_SM
    ctx.fillStyle = "#555"
    const hint =
      this.tab === "equipment"
        ? "[Z] Equip/Unequip   [←→] Tab   [X] Close"
        : "[Z] Use   [←→] Tab   [X] Close"
    ctx.fillText(hint, PX + 12, HINT_Y)
  }

  private renderEquipTab(ctx: CanvasRenderingContext2D, rows: Row[]): void {
    let y = CONTENT_Y

    ctx.font = FONT_SM
    ctx.fillStyle = "#555"
    ctx.fillText("EQUIPPED", PX + 24, y)
    y += ROW_H

    // Slot rows (always 3: weapon, armour, accessory)
    for (let i = 0; i < 3; i++) {
      const row = rows[i] as SlotRow
      const name = row.itemId
        ? (this.registry[row.itemId]?.name ?? row.itemId)
        : "——"
      this.drawRow(ctx, y, this.cursor === i, row.label, name)
      y += ROW_H
    }

    y += 8

    ctx.font = FONT_SM
    ctx.fillStyle = "#555"
    ctx.fillText("IN BAG", PX + 24, y)
    y += ROW_H

    const bagRows = rows.slice(3) as BagRow[]
    if (bagRows.length === 0) {
      ctx.font = FONT
      ctx.fillStyle = "#444"
      ctx.fillText("  Nothing to equip", PX + 24, y)
    }
    for (let i = 0; i < bagRows.length; i++) {
      this.drawRow(
        ctx,
        y,
        this.cursor === 3 + i,
        bagRows[i].name,
        bagRows[i].statLine,
      )
      y += ROW_H
    }

    this.renderStatPanel(ctx, rows)
  }

  private renderConsumableTab(
    ctx: CanvasRenderingContext2D,
    rows: ConsRow[],
  ): void {
    let y = CONTENT_Y
    if (rows.length === 0) {
      ctx.font = FONT
      ctx.fillStyle = "#444"
      ctx.fillText("  No items", PX + 24, y)
      return
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      this.drawRow(
        ctx,
        y,
        this.cursor === i,
        `${r.name}  x${r.qty}`,
        r.description,
      )
      y += ROW_H
    }
  }

  private drawRow(
    ctx: CanvasRenderingContext2D,
    y: number,
    selected: boolean,
    left: string,
    right: string,
  ): void {
    if (selected) {
      ctx.fillStyle = "rgba(255,255,255,0.07)"
      ctx.fillRect(PX + 6, y - ROW_H + 5, LEFT_W - 2, ROW_H)
    }
    ctx.font = FONT
    ctx.fillStyle = selected ? "#fff" : "#aaa"
    ctx.fillText((selected ? "▶ " : "  ") + left, PX + 12, y)
    ctx.fillStyle = selected ? "#e8e880" : "#666"
    ctx.fillText(right, PX + 220, y)
  }

  private renderStatPanel(ctx: CanvasRenderingContext2D, rows: Row[]): void {
    // Vertical divider
    ctx.strokeStyle = "#4a4a8a"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(RIGHT_X - 2, DIV_Y + 4)
    ctx.lineTo(RIGHT_X - 2, PY + PH - 24)
    ctx.stroke()

    const cur = derivedStats(this.stats, this.inventory, this.registry)
    let y = CONTENT_Y

    ctx.font = FONT_SM
    ctx.fillStyle = "#555"
    ctx.fillText("STATS", RIGHT_X, y)
    y += ROW_H

    ctx.font = FONT
    ctx.fillStyle = "#aaa"
    ctx.fillText(`ATK  ${cur.attack}`, RIGHT_X, y)
    y += ROW_H
    ctx.fillText(`DEF  ${cur.defense}`, RIGHT_X, y)
    y += ROW_H
    ctx.fillText(`HP   ${this.stats.hp}/${cur.maxHp}`, RIGHT_X, y)
    y += ROW_H

    // Preview diff: only when hovering a bag-equip row
    const hovered = rows[this.cursor]
    if (hovered?.kind !== "bag-equip") return

    const preview = derivedStats(
      this.stats,
      equip(this.inventory, hovered.itemId, this.registry),
      this.registry,
    )

    y += 8
    ctx.font = FONT_SM
    ctx.fillStyle = "#555"
    ctx.fillText("IF EQUIPPED", RIGHT_X, y)
    y += ROW_H

    ctx.font = FONT
    this.drawStatDiff(ctx, RIGHT_X, y, "ATK", cur.attack, preview.attack)
    y += ROW_H
    this.drawStatDiff(ctx, RIGHT_X, y, "DEF", cur.defense, preview.defense)
    y += ROW_H
    this.drawStatDiff(ctx, RIGHT_X, y, "HP", cur.maxHp, preview.maxHp)
  }

  private drawStatDiff(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    label: string,
    cur: number,
    next: number,
  ): void {
    ctx.fillStyle = "#aaa"
    ctx.fillText(`${label}  ${cur}`, x, y)
    const diff = next - cur
    if (diff !== 0) {
      ctx.fillStyle = diff > 0 ? "#7ec87e" : "#e87e7e"
      ctx.fillText(` → ${next}`, x + 70, y)
    }
  }
}
