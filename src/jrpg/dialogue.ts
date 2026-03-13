export interface DialogueState {
  lines: readonly string[]
  currentLine: number
  speaker?: string
}

export function createDialogue(
  lines: readonly string[],
  speaker?: string,
): DialogueState {
  return { lines, currentLine: 0, speaker }
}

/** Advance to the next line. Returns null when the script is exhausted. */
export function advanceDialogue(state: DialogueState): DialogueState | null {
  const next = state.currentLine + 1
  if (next >= state.lines.length) return null
  return { ...state, currentLine: next }
}

/** The line of text currently on screen. */
export function currentLine(state: DialogueState): string {
  return state.lines[state.currentLine] ?? ""
}
