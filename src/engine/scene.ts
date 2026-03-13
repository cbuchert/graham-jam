import type { InputState } from "./input"

export interface Scene {
  update(dt: number, input: InputState): void
  render(ctx: CanvasRenderingContext2D): void
  onEnter?(): void
  onExit?(): void
}

export interface SceneManagerState {
  stack: readonly Scene[]
}

export function createSceneManagerState(): SceneManagerState {
  return { stack: [] }
}

export function activeScene(state: SceneManagerState): Scene | undefined {
  return state.stack[state.stack.length - 1]
}

export function push(
  state: SceneManagerState,
  scene: Scene,
): SceneManagerState {
  scene.onEnter?.()
  return { stack: [...state.stack, scene] }
}

export function pop(state: SceneManagerState): SceneManagerState {
  activeScene(state)?.onExit?.()
  return { stack: state.stack.slice(0, -1) }
}

export function replace(
  state: SceneManagerState,
  scene: Scene,
): SceneManagerState {
  activeScene(state)?.onExit?.()
  scene.onEnter?.()
  return { stack: [...state.stack.slice(0, -1), scene] }
}
