import { currentLine, type DialogueState } from "../jrpg/dialogue"
import { drawPanel } from "./ui"

/**
 * Render a dialogue box at the bottom of the screen.
 * Draws the background panel, optional speaker name tab, dialogue text,
 * and a blinking "continue" prompt.
 */
export function renderDialogueBox(
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

  drawPanel(ctx, boxX, boxY, boxW, boxH, "#1a1a2e", "#8888cc")

  if (state.speaker) {
    ctx.fillStyle = "#8888cc"
    ctx.fillRect(boxX, boxY - 24, 120, 24)
    ctx.fillStyle = "#fff"
    ctx.font = "bold 13px monospace"
    ctx.fillText(state.speaker, boxX + 10, boxY - 7)
  }

  ctx.font = "16px monospace"
  ctx.fillStyle = "#fff"
  ctx.fillText(currentLine(state), boxX + 16, boxY + 36)

  // Blink the continue prompt every half-second.
  const blink = Math.floor(Date.now() / 500) % 2 === 0
  if (blink) {
    ctx.font = "12px monospace"
    ctx.fillStyle = "#aaa"
    ctx.fillText("Z  continue", boxX + boxW - 100, boxY + boxH - 12)
  }
}
