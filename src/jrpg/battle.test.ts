import { describe, expect, it } from "vitest"
import {
  advanceBattle,
  applyEnemyAction,
  applyPlayerAction,
  type BattleState,
  type Combatant,
  createBattleState,
  ITEM_HEAL,
} from "./battle"

const player: Combatant = {
  name: "Hero",
  hp: 50,
  maxHp: 50,
  attack: 12,
  defense: 5,
}

const enemy: Combatant = {
  name: "Slime",
  hp: 30,
  maxHp: 30,
  attack: 8,
  defense: 3,
}

// Hero attacks Slime: max(1, 12 - 3) = 9 damage
// Slime attacks Hero: max(1, 8 - 5) = 3 damage
const PLAYER_DAMAGE = 9
const ENEMY_DAMAGE = 3

function freshState(overrides?: Partial<BattleState>): BattleState {
  return { ...createBattleState(player, enemy, 3), ...overrides }
}

// ---------------------------------------------------------------------------

describe("applyPlayerAction — attack", () => {
  it("deals max(1, attack - defense) damage to enemy", () => {
    const next = applyPlayerAction(freshState(), "attack")
    expect(next.enemy.hp).toBe(enemy.hp - PLAYER_DAMAGE)
  })

  it("always deals at least 1 damage when defense exceeds attack", () => {
    const weakPlayer = { ...player, attack: 1 }
    const tankEnemy = { ...enemy, defense: 99 }
    const state = createBattleState(weakPlayer, tankEnemy)
    const next = applyPlayerAction(state, "attack")
    expect(next.enemy.hp).toBe(tankEnemy.hp - 1)
  })

  it("clamps enemy hp to 0, not below", () => {
    const glassEnemy = { ...enemy, hp: 1 }
    const state = createBattleState(player, glassEnemy)
    const next = applyPlayerAction(state, "attack")
    expect(next.enemy.hp).toBe(0)
  })

  it("appends a message to the log", () => {
    const next = applyPlayerAction(freshState(), "attack")
    expect(next.log.length).toBe(1)
    expect(next.log[0]).toMatch(/Hero/)
  })

  it("transitions to resolving with next='enemy-turn' when enemy survives", () => {
    const next = applyPlayerAction(freshState(), "attack")
    expect(next.phase).toMatchObject({ tag: "resolving", next: "enemy-turn" })
  })

  it("transitions to resolving with next='victory' when attack kills the enemy", () => {
    const dyingEnemy = { ...enemy, hp: 1, defense: 0 }
    const state = createBattleState({ ...player, attack: 99 }, dyingEnemy)
    const next = applyPlayerAction(state, "attack")
    expect(next.phase).toMatchObject({ tag: "resolving", next: "victory" })
  })
})

// ---------------------------------------------------------------------------

describe("applyPlayerAction — item", () => {
  it("heals player by ITEM_HEAL when not at full hp", () => {
    const woundedPlayer = { ...player, hp: 10 }
    const state = createBattleState(woundedPlayer, enemy, 1)
    const next = applyPlayerAction(state, "item")
    expect(next.player.hp).toBe(10 + ITEM_HEAL)
  })

  it("does not heal player above maxHp", () => {
    const nearFullPlayer = { ...player, hp: player.maxHp - 5 }
    const state = createBattleState(nearFullPlayer, enemy, 1)
    const next = applyPlayerAction(state, "item")
    expect(next.player.hp).toBe(player.maxHp)
  })

  it("decrements the item count by 1", () => {
    const state = createBattleState(player, enemy, 3)
    const next = applyPlayerAction(state, "item")
    expect(next.playerItems).toBe(2)
  })

  it("transitions to resolving with next='enemy-turn' after using an item", () => {
    const state = createBattleState(player, enemy, 1)
    const next = applyPlayerAction(state, "item")
    expect(next.phase).toMatchObject({ tag: "resolving", next: "enemy-turn" })
  })

  it("shows a no-items message when playerItems is 0", () => {
    const state = createBattleState(player, enemy, 0)
    const next = applyPlayerAction(state, "item")
    expect(next.phase).toMatchObject({ tag: "resolving", next: "player-menu" })
    expect(next.log[0]).toMatch(/[Nn]o items/i)
  })

  it("does not decrement items when count is already 0", () => {
    const state = createBattleState(player, enemy, 0)
    const next = applyPlayerAction(state, "item")
    expect(next.playerItems).toBe(0)
  })
})

// ---------------------------------------------------------------------------

describe("applyPlayerAction — run", () => {
  it("transitions immediately to fled", () => {
    const next = applyPlayerAction(freshState(), "run")
    expect(next.phase.tag).toBe("fled")
  })
})

// ---------------------------------------------------------------------------

describe("applyEnemyAction", () => {
  it("deals max(1, enemy.attack - player.defense) damage to player", () => {
    const next = applyEnemyAction(freshState())
    expect(next.player.hp).toBe(player.hp - ENEMY_DAMAGE)
  })

  it("always deals at least 1 damage", () => {
    const weakEnemy = { ...enemy, attack: 1 }
    const state = createBattleState({ ...player, defense: 99 }, weakEnemy)
    const next = applyEnemyAction(state)
    expect(next.player.hp).toBe(player.hp - 1)
  })

  it("appends a message to the log", () => {
    const next = applyEnemyAction(freshState())
    expect(next.log.length).toBe(1)
    expect(next.log[0]).toMatch(/Slime/)
  })

  it("transitions to resolving with next='player-menu' when player survives", () => {
    const next = applyEnemyAction(freshState())
    expect(next.phase).toMatchObject({ tag: "resolving", next: "player-menu" })
  })

  it("transitions to resolving with next='defeat' when enemy attack kills the player", () => {
    const dyingPlayer = { ...player, hp: 1, defense: 0 }
    const state = createBattleState(dyingPlayer, { ...enemy, attack: 99 })
    const next = applyEnemyAction(state)
    expect(next.phase).toMatchObject({ tag: "resolving", next: "defeat" })
  })
})

// ---------------------------------------------------------------------------

describe("advanceBattle", () => {
  it("does nothing in player-menu with no input", () => {
    const state = freshState()
    expect(advanceBattle(state, null)).toBe(state)
  })

  it("does nothing in player-menu with confirm input (wrong type)", () => {
    const state = freshState()
    expect(advanceBattle(state, { type: "confirm" })).toBe(state)
  })

  it("processes player action from player-menu with select-action input", () => {
    const state = freshState()
    const next = advanceBattle(state, {
      type: "select-action",
      action: "attack",
    })
    expect(next.phase.tag).toBe("resolving")
  })

  it("does nothing in resolving with no input", () => {
    const state = freshState({
      phase: { tag: "resolving", message: "Hero attacks!", next: "enemy-turn" },
    })
    expect(advanceBattle(state, null)).toBe(state)
  })

  it("confirm in resolving(next='enemy-turn') auto-processes enemy action", () => {
    const state = freshState({
      phase: { tag: "resolving", message: "Hero attacks!", next: "enemy-turn" },
    })
    const next = advanceBattle(state, { type: "confirm" })
    // Enemy auto-attacked, landed in a new resolving phase
    expect(next.phase.tag).toBe("resolving")
    expect(next.player.hp).toBe(player.hp - ENEMY_DAMAGE)
  })

  it("confirm in resolving(next='player-menu') returns to player-menu", () => {
    const state = freshState({
      phase: {
        tag: "resolving",
        message: "Slime attacks!",
        next: "player-menu",
      },
    })
    const next = advanceBattle(state, { type: "confirm" })
    expect(next.phase.tag).toBe("player-menu")
  })

  it("confirm in resolving(next='victory') transitions to victory", () => {
    const state = freshState({
      phase: { tag: "resolving", message: "Hero wins!", next: "victory" },
    })
    expect(advanceBattle(state, { type: "confirm" }).phase.tag).toBe("victory")
  })

  it("confirm in resolving(next='defeat') transitions to defeat", () => {
    const state = freshState({
      phase: { tag: "resolving", message: "Hero falls...", next: "defeat" },
    })
    expect(advanceBattle(state, { type: "confirm" }).phase.tag).toBe("defeat")
  })

  it("enemy-turn auto-processes without any input", () => {
    const state = freshState({ phase: { tag: "enemy-turn" } })
    const next = advanceBattle(state, null)
    expect(next.phase.tag).toBe("resolving")
    expect(next.player.hp).toBe(player.hp - ENEMY_DAMAGE)
  })

  it("victory is a terminal state — no further advance", () => {
    const state = freshState({ phase: { tag: "victory" } })
    expect(advanceBattle(state, { type: "confirm" })).toBe(state)
  })

  it("defeat is a terminal state — no further advance", () => {
    const state = freshState({ phase: { tag: "defeat" } })
    expect(advanceBattle(state, { type: "confirm" })).toBe(state)
  })

  it("fled is a terminal state — no further advance", () => {
    const state = freshState({ phase: { tag: "fled" } })
    expect(advanceBattle(state, { type: "confirm" })).toBe(state)
  })
})
