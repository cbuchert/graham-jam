import type { Scene } from "../engine/scene"

/** Placeholder scene — proves the loop, canvas, and scene stack are all wired up. */
export class BootScene implements Scene {
  private elapsed = 0

  onEnter() {
    console.log("BootScene entered")
  }

  update(dt: number) {
    this.elapsed += dt
  }

  render(ctx: CanvasRenderingContext2D) {
    const { width, height } = ctx.canvas

    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = "#e0e0e0"
    ctx.font = `bold ${Math.round(height * 0.05)}px monospace`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("Codie Butt Off", width / 2, height / 2 - height * 0.04)

    ctx.fillStyle = "#888"
    ctx.font = `${Math.round(height * 0.025)}px monospace`
    ctx.fillText(
      `t = ${this.elapsed.toFixed(2)}s`,
      width / 2,
      height / 2 + height * 0.04,
    )
  }
}
