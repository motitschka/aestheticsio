import { describe, expect, it } from 'vitest'
import type { Aesthetic, Progress } from '../types'
import { applyAnswer, buildQuestion, CHOICES, mergeProgress, pickRound, rankProfiles, ROUND_SIZE, statsOf, statusOf } from './quiz'

const make = (n: number): Aesthetic[] =>
  Array.from({ length: n }, (_, i) => ({ id: `a${i}`, name: `A${i}`, wiki: '', images: [`img${i}-0`, `img${i}-1`] }))

// Deterministic PRNG so failures are reproducible.
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

const entry = (l: boolean, t = 0) => ({ s: l ? 3 : 1, l, c: l ? 3 : 1, w: 0, t })

describe('applyAnswer', () => {
  it('learns after three correct in a row', () => {
    let e = applyAnswer(undefined, true, 1)
    e = applyAnswer(e, true, 2)
    expect(e.l).toBe(false)
    e = applyAnswer(e, true, 3)
    expect(e).toEqual({ s: 3, l: true, c: 3, w: 0, t: 3 })
  })

  it('a wrong answer resets the streak and unlearns', () => {
    const e = applyAnswer({ s: 5, l: true, c: 5, w: 0, t: 1 }, false, 2)
    expect(e).toEqual({ s: 0, l: false, c: 5, w: 1, t: 2 })
    expect(statusOf(e)).toBe('learning')
  })
})

describe('pickRound', () => {
  it('first round is all new and distinct', () => {
    const round = pickRound(make(173), {}, seeded())
    expect(round).toHaveLength(ROUND_SIZE)
    expect(new Set(round.map((a) => a.id)).size).toBe(ROUND_SIZE)
  })

  it('re-checks the least recently seen learned ones and still introduces new ones', () => {
    const all = make(50)
    const progress: Progress = {}
    for (let i = 0; i < 10; i++) progress[`a${i}`] = entry(true, 100 - i) // a9 is oldest
    for (let i = 10; i < 30; i++) progress[`a${i}`] = entry(false)
    const ids = pickRound(all, progress, seeded()).map((a) => a.id)
    expect(ids).toContain('a9')
    expect(ids).toContain('a8')
    expect(ids.filter((id) => !progress[id])).toHaveLength(3)
    expect(ids.filter((id) => progress[id] && !progress[id].l)).toHaveLength(5)
  })

  it('fills the round when almost everything is learned', () => {
    const all = make(12)
    const progress: Progress = Object.fromEntries(all.map((a, i) => [a.id, entry(true, i)]))
    expect(pickRound(all, progress, seeded())).toHaveLength(ROUND_SIZE)
  })

  it('works with fewer aesthetics than a round', () => {
    expect(pickRound(make(5), {}, seeded())).toHaveLength(5)
  })
})

describe('buildQuestion', () => {
  it('has the target once among distinct options', () => {
    const all = make(20)
    for (let seed = 1; seed < 50; seed++) {
      const q = buildQuestion(all[3], all, 'mixed', seeded(seed))
      const ids = q.options.map((o) => o.aesthetic.id)
      expect(ids).toHaveLength(CHOICES)
      expect(new Set(ids).size).toBe(CHOICES)
      expect(ids.filter((id) => id === 'a3')).toHaveLength(1)
      expect(all[3].images).toContain(q.image)
    }
  })

  it('respects a locked mode', () => {
    const all = make(10)
    expect(buildQuestion(all[0], all, 'name-to-image', seeded()).mode).toBe('name-to-image')
  })
})

describe('mergeProgress', () => {
  it('keeps the most recent entry for each aesthetic', () => {
    const account: Progress = { a: { s: 3, l: true, c: 3, w: 0, t: 10 }, b: { s: 0, l: false, c: 0, w: 1, t: 50 } }
    const guest: Progress = { a: { s: 0, l: false, c: 3, w: 1, t: 20 }, b: { s: 1, l: false, c: 1, w: 0, t: 5 }, c: { s: 1, l: false, c: 1, w: 0, t: 1 } }
    expect(mergeProgress(account, guest)).toEqual({ a: guest.a, b: account.b, c: guest.c })
  })
})

describe('stats and ranking', () => {
  it('counts learned and accuracy', () => {
    expect(statsOf({ a: { s: 3, l: true, c: 3, w: 1, t: 0 }, b: { s: 0, l: false, c: 0, w: 2, t: 0 } })).toEqual({
      learned: 1,
      correct: 3,
      answered: 6,
    })
  })

  it('ranks by learned, then accuracy', () => {
    const p = (nickname: string, learned: number, correct: number, answered: number) => ({ uid: nickname, nickname, avatar: '', learned, correct, answered })
    const ranked = rankProfiles([p('low', 1, 10, 10), p('sloppy', 5, 5, 10), p('sharp', 5, 9, 10)])
    expect(ranked.map((r) => r.nickname)).toEqual(['sharp', 'sloppy', 'low'])
  })
})
