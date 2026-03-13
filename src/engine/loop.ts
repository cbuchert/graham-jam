export interface GameState {
  /** Total elapsed game time in seconds. */
  time: number
}

const DT_CAP = 0.05 // 50ms — prevents physics explosion after tab loses focus

export function update(state: GameState, dt: number): GameState {
  const cappedDt = Math.min(dt, DT_CAP)
  return { ...state, time: state.time + cappedDt }
}
