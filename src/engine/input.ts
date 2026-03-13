export interface InputState {
  heldKeys: ReadonlySet<string>
}

export const BINDINGS = {
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  confirm: ["KeyZ", "Enter"],
  cancel: ["KeyX", "Escape"],
} as const

export type Action = keyof typeof BINDINGS

export function createInputState(): InputState {
  return { heldKeys: new Set() }
}

export function keyDown(state: InputState, key: string): InputState {
  const next = new Set(state.heldKeys)
  next.add(key)
  return { heldKeys: next }
}

export function keyUp(state: InputState, key: string): InputState {
  const next = new Set(state.heldKeys)
  next.delete(key)
  return { heldKeys: next }
}

export function isDown(state: InputState, key: string): boolean {
  return state.heldKeys.has(key)
}

export function isActionDown(state: InputState, action: Action): boolean {
  return BINDINGS[action].some((key) => state.heldKeys.has(key))
}
