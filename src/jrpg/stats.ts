import type { Combatant } from "./battle"

export interface PlayerStats {
  hp: number
  maxHp: number
  attack: number
  defense: number
  level: number
  xp: number
}

/** XP required to advance from `level` to `level + 1`. Scales linearly. */
export function xpToNextLevel(level: number): number {
  return level * 100
}

export function createPlayerStats(): PlayerStats {
  return { hp: 50, maxHp: 50, attack: 12, defense: 5, level: 1, xp: 0 }
}

/** Add `xpGained` to stats, levelling up automatically if the threshold is crossed. */
export function applyXp(stats: PlayerStats, xpGained: number): PlayerStats {
  const newXp = stats.xp + xpGained
  const threshold = xpToNextLevel(stats.level)
  if (newXp >= threshold) {
    // Level up and carry over the excess XP
    return levelUp({ ...stats, xp: newXp - threshold })
  }
  return { ...stats, xp: newXp }
}

/** Advance level by 1 and increase base stats. Full heal on level-up. */
export function levelUp(stats: PlayerStats): PlayerStats {
  const newMaxHp = stats.maxHp + 5
  return {
    ...stats,
    level: stats.level + 1,
    maxHp: newMaxHp,
    hp: newMaxHp, // full heal
    attack: stats.attack + 2,
    defense: stats.defense + 1,
  }
}

/** Convert persistent player stats into a battle combatant. */
export function statsToCombatant(stats: PlayerStats, name: string): Combatant {
  return {
    name,
    hp: stats.hp,
    maxHp: stats.maxHp,
    attack: stats.attack,
    defense: stats.defense,
  }
}
