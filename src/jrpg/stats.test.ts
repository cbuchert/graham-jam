import { describe, expect, it } from "vitest"
import {
  applyXp,
  createPlayerStats,
  levelUp,
  statsToCombatant,
  xpToNextLevel,
} from "./stats"

describe("createPlayerStats", () => {
  it("starts at level 1", () => {
    expect(createPlayerStats().level).toBe(1)
  })

  it("starts with 0 xp", () => {
    expect(createPlayerStats().xp).toBe(0)
  })

  it("starts with hp equal to maxHp", () => {
    const s = createPlayerStats()
    expect(s.hp).toBe(s.maxHp)
  })
})

describe("xpToNextLevel", () => {
  it("level 1 requires a positive amount of XP", () => {
    expect(xpToNextLevel(1)).toBeGreaterThan(0)
  })

  it("higher levels require more XP than lower levels", () => {
    expect(xpToNextLevel(2)).toBeGreaterThan(xpToNextLevel(1))
  })
})

describe("applyXp", () => {
  const base = createPlayerStats()
  const threshold = xpToNextLevel(base.level)

  it("adds XP to current total", () => {
    const next = applyXp(base, 20)
    expect(next.xp).toBe(20)
  })

  it("does not level up when XP is below the threshold", () => {
    const next = applyXp(base, threshold - 1)
    expect(next.level).toBe(base.level)
  })

  it("levels up when XP reaches the threshold", () => {
    const next = applyXp(base, threshold)
    expect(next.level).toBe(base.level + 1)
  })

  it("carries excess XP over after a level-up", () => {
    const excess = 10
    const next = applyXp(base, threshold + excess)
    expect(next.xp).toBe(excess)
  })

  it("does not mutate the original stats", () => {
    const original = { ...base }
    applyXp(base, 99)
    expect(base.xp).toBe(original.xp)
    expect(base.level).toBe(original.level)
  })
})

describe("levelUp", () => {
  const base = createPlayerStats()

  it("increments level by 1", () => {
    expect(levelUp(base).level).toBe(base.level + 1)
  })

  it("increases maxHp", () => {
    expect(levelUp(base).maxHp).toBeGreaterThan(base.maxHp)
  })

  it("increases attack", () => {
    expect(levelUp(base).attack).toBeGreaterThan(base.attack)
  })

  it("increases defense", () => {
    expect(levelUp(base).defense).toBeGreaterThan(base.defense)
  })

  it("restores hp to the new maxHp", () => {
    const levelled = levelUp(base)
    expect(levelled.hp).toBe(levelled.maxHp)
  })
})

describe("statsToCombatant", () => {
  it("uses the provided name", () => {
    const c = statsToCombatant(createPlayerStats(), "Hero")
    expect(c.name).toBe("Hero")
  })

  it("maps hp, maxHp, attack, defense from stats", () => {
    const stats = createPlayerStats()
    const c = statsToCombatant(stats, "Hero")
    expect(c.hp).toBe(stats.hp)
    expect(c.maxHp).toBe(stats.maxHp)
    expect(c.attack).toBe(stats.attack)
    expect(c.defense).toBe(stats.defense)
  })
})
