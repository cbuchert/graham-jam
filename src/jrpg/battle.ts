export interface Combatant {
  name: string
  hp: number
  maxHp: number
  attack: number
  defense: number
}

export type PlayerAction = "attack" | "item" | "run"

/** next field encodes where resolving transitions to after the player confirms. */
type ResolveNext = "enemy-turn" | "player-menu" | "victory" | "defeat"

export type BattlePhase =
  | { tag: "player-menu" }
  | { tag: "resolving"; message: string; next: ResolveNext }
  | { tag: "enemy-turn" }
  | { tag: "victory" }
  | { tag: "defeat" }
  | { tag: "fled" }

export interface BattleState {
  phase: BattlePhase
  player: Combatant
  enemy: Combatant
  log: readonly string[]
  playerItems: number
}

export type BattleInput =
  | { type: "select-action"; action: PlayerAction }
  | { type: "confirm" }

export const ITEM_HEAL = 30

export function createBattleState(
  player: Combatant,
  enemy: Combatant,
  playerItems = 0,
): BattleState {
  return { phase: { tag: "player-menu" }, player, enemy, log: [], playerItems }
}

/** Damage formula: at least 1 so combat never stalls. */
function calcDamage(attacker: Combatant, defender: Combatant): number {
  return Math.max(1, attacker.attack - defender.defense)
}

export function applyPlayerAction(
  state: BattleState,
  action: PlayerAction,
): BattleState {
  switch (action) {
    case "attack": {
      const damage = calcDamage(state.player, state.enemy)
      const newEnemy = {
        ...state.enemy,
        hp: Math.max(0, state.enemy.hp - damage),
      }
      const message = `${state.player.name} attacks for ${damage} damage!`
      const next: ResolveNext = newEnemy.hp <= 0 ? "victory" : "enemy-turn"
      return {
        ...state,
        enemy: newEnemy,
        log: [...state.log, message],
        phase: { tag: "resolving", message, next },
      }
    }

    case "item": {
      if (state.playerItems <= 0) {
        const message = "No items left!"
        return {
          ...state,
          log: [...state.log, message],
          phase: { tag: "resolving", message, next: "player-menu" },
        }
      }
      const healed = Math.min(ITEM_HEAL, state.player.maxHp - state.player.hp)
      const newPlayer = { ...state.player, hp: state.player.hp + healed }
      const message = `${state.player.name} used a potion and recovered ${healed} HP!`
      return {
        ...state,
        player: newPlayer,
        playerItems: state.playerItems - 1,
        log: [...state.log, message],
        phase: { tag: "resolving", message, next: "enemy-turn" },
      }
    }

    case "run":
      return { ...state, phase: { tag: "fled" } }
  }
}

export function applyEnemyAction(state: BattleState): BattleState {
  const damage = calcDamage(state.enemy, state.player)
  const newPlayer = {
    ...state.player,
    hp: Math.max(0, state.player.hp - damage),
  }
  const message = `${state.enemy.name} attacks for ${damage} damage!`
  const next: ResolveNext = newPlayer.hp <= 0 ? "defeat" : "player-menu"
  return {
    ...state,
    player: newPlayer,
    log: [...state.log, message],
    phase: { tag: "resolving", message, next },
  }
}

export function advanceBattle(
  state: BattleState,
  input: BattleInput | null,
): BattleState {
  const { phase } = state

  switch (phase.tag) {
    case "player-menu":
      if (!input || input.type !== "select-action") return state
      return applyPlayerAction(state, input.action)

    case "resolving":
      if (!input || input.type !== "confirm") return state
      switch (phase.next) {
        case "enemy-turn":
          // Auto-process enemy turn — arrives in a new resolving state
          return applyEnemyAction(state)
        case "player-menu":
          return { ...state, phase: { tag: "player-menu" } }
        case "victory":
          return { ...state, phase: { tag: "victory" } }
        case "defeat":
          return { ...state, phase: { tag: "defeat" } }
      }
      break

    case "enemy-turn":
      // Auto-processes without player input
      return applyEnemyAction(state)

    default:
      // Terminal states: victory, defeat, fled
      return state
  }
}
