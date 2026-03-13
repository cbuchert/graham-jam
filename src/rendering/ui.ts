/**
 * Draw a filled rectangle with a 2px border — the standard panel style
 * used by battle boxes, dialogue frames, menus, and HUDs.
 */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill = "#1a1a2e",
  stroke = "#4a4a8a",
): void {
  ctx.fillStyle = fill
  ctx.fillRect(x, y, width, height)
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, width, height)
}
