import { describe, expect, it } from 'vitest'
import json from '../../data/aesthetics.json'
import type { Aesthetic, AestheticsData, PlayerStats, SavedProgress } from '../types'
import { eraOf, eraProgress, erasFinished, ERAS, journeyOrder, nextOnJourney } from './eras'
import {
  applyDailyLesson,
  dayKey,
  dayStreakNow,
  emptyStats,
  freshStart,
  hasProgress,
  JOURNEY,
  MAX_FREEZES,
  mergeSaved,
  needsFreshStart,
  normalizeSaved,
  profileFrom,
  syncMerge,
  withRecent,
} from './progress'

const data = json as AestheticsData
const all = data.items
const DAY = 24 * 60 * 60 * 1000
// Noon, so adding days never crosses midnight because of daylight saving.
const day0 = new Date(2026, 9, 5, 12).getTime()
const at = (days: number) => day0 + days * DAY

describe('eras', () => {
  it('every aesthetic has exactly one era, and every era has some', () => {
    const counts = eraProgress(all, {}).map((p) => p.total)
    expect(counts).toHaveLength(ERAS.length)
    expect(counts.every((n) => n > 0)).toBe(true)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(all.length)
  })

  it('places aesthetics by their decade, the 1940s with the post-war era', () => {
    const era = (id: string) => eraOf(all.find((a) => a.id === id)!)
    expect(era('baroque')).toBe(0)
    expect(era('art-deco')).toBe(1)
    expect(era('atomic-age')).toBe(2)
    expect(era('memphis-design')).toBe(4)
    expect(era('frutiger-aero')).toBe(6)
    expect(era('kid-science')).toBe(5) // undated on the wiki, placed by hand
  })

  it('the journey runs oldest era first and suggests the first lesson not yet learned', () => {
    const order = journeyOrder(all)
    expect(order.map(eraOf)).toEqual([...order.map(eraOf)].sort((a, b) => a - b))
    const first = order[0]
    expect(nextOnJourney(all, {})).toBe(first)
    const items = { [first.id]: { lt: 2 as const, c: 0, w: 0, t: 0 } }
    expect(nextOnJourney(all, items)).toBe(order[1])
  })

  it('notices when an era is finished', () => {
    const era0 = all.filter((a) => eraOf(a) === 0)
    const almost = Object.fromEntries(era0.slice(1).map((a) => [a.id, { lt: 2 as const, c: 0, w: 0, t: 0 }]))
    const done = { ...almost, [era0[0].id]: { lt: 2 as const, c: 0, w: 0, t: 0 } }
    expect(erasFinished(all, almost, done)).toEqual([0])
    expect(erasFinished(all, done, done)).toEqual([])
  })

  it('profiles carry learned counts per era', () => {
    const a = all[0]
    const p = profileFrom({ uid: 'u', nickname: 'N', avatar: a.id }, { items: { [a.id]: { lt: 3, c: 0, w: 0, t: 0 } }, stats: emptyStats() }, all)
    expect(p.eras![eraOf(a)]).toBe(1)
    expect(p.lessonPoints).toBe(2)
  })
})

describe('daily goal', () => {
  const lesson = (s: PlayerStats, days: number) => applyDailyLesson(s, at(days)).stats

  it('a lesson a day builds a day streak', () => {
    let s = emptyStats()
    const first = applyDailyLesson(s, at(0))
    expect(first.goalMet).toBe(true)
    s = lesson(first.stats, 1)
    s = lesson(s, 2)
    expect(s.dayStreak).toBe(3)
    expect(dayStreakNow(s, at(2))).toBe(3)
    expect(dayStreakNow(s, at(3))).toBe(3) // today isn't over yet
    expect(dayStreakNow(s, at(4))).toBe(0) // a day missed, no freeze
  })

  it('a second lesson in a day banks a freeze, at most two', () => {
    let s = emptyStats()
    for (let d = 0; d < 4; d++) {
      s = lesson(lesson(s, d), d)
    }
    expect(s.freezes).toBe(MAX_FREEZES)
    expect(applyDailyLesson(s, at(3)).goalMet).toBe(false)
  })

  it('freezes cover missed days and are used up then', () => {
    let s = lesson(lesson(emptyStats(), 0), 0) // streak 1, one freeze
    expect(s.freezes).toBe(1)
    expect(dayStreakNow(s, at(2))).toBe(1) // one day missed, covered
    s = lesson(s, 2)
    expect(s).toMatchObject({ dayStreak: 2, freezes: 0 })
    expect(dayStreakNow(s, at(4))).toBe(0)
    s = lesson(s, 4)
    expect(s.dayStreak).toBe(1)
    expect(s.bestDayStreak).toBe(2)
  })

  it('counts days by the local calendar', () => {
    expect(dayKey(new Date(2026, 0, 31, 23, 59).getTime())).toBe('2026-01-31')
    expect(dayKey(new Date(2026, 1, 1, 0, 1).getTime())).toBe('2026-02-01')
  })
})

describe('fresh start', () => {
  const old: SavedProgress = normalizeSaved({ items: { 'art-deco': { lt: 2, la: 1, c: 3, w: 1, t: 1 } }, stats: { bestStreak: 12, timelineRight: 1, timelineTotal: 2, theme: 'art-deco' } })

  it('progress from before the journey needs one; a fresh record does not', () => {
    expect(needsFreshStart(old)).toBe(true)
    const next = freshStart(hasProgress(old))
    expect(needsFreshStart(next)).toBe(false)
    expect(next).toEqual({ items: {}, stats: { ...emptyStats(), v: JOURNEY, journeyNote: 1 } })
    expect(freshStart(false).stats.journeyNote).toBeUndefined()
  })

  it('a stored fresh record stays fresh when loaded again', () => {
    expect(needsFreshStart(normalizeSaved(JSON.parse(JSON.stringify(freshStart(true)))))).toBe(false)
  })
})

describe('sync between devices', () => {
  const base = (stats: Partial<PlayerStats>, items: SavedProgress['items'] = {}): SavedProgress => ({ items, stats: { ...emptyStats(), v: JOURNEY, ...stats } })

  it('never rolls records back', () => {
    const local = base({ bestStreak: 5, best25: 90_000, timelineRight: 1, timelineTotal: 1 }, { x: { lt: 1, c: 1, w: 0, t: 1 } })
    const remote = base({ bestStreak: 20, best25: 120_000, timelineRight: 3, timelineTotal: 4 }, { x: { lt: 2, la: 5, u: 1, c: 2, w: 1, t: 5 } })
    const merged = syncMerge(local, remote)
    expect(merged.stats).toMatchObject({ bestStreak: 20, best25: 90_000, timelineRight: 3, timelineTotal: 4 })
    expect(merged.items.x).toMatchObject({ lt: 2, u: 1, c: 2, w: 1 })
  })

  it('the day streak comes from whichever device met the goal last', () => {
    const merged = syncMerge(base({ goalDay: '2026-10-04', dayStreak: 3 }), base({ goalDay: '2026-10-05', dayStreak: 4, freezes: 1 }))
    expect(merged.stats).toMatchObject({ goalDay: '2026-10-05', dayStreak: 4, freezes: 1 })
  })

  it('a fresh start on the server wins over a device holding old progress', () => {
    const stale: SavedProgress = { items: { x: { lt: 2, c: 0, w: 0, t: 0 } }, stats: emptyStats() }
    expect(syncMerge(stale, freshStart(true))).toEqual(freshStart(true))
  })

  it('feed moments are kept once, newest first', () => {
    const a = withRecent(base({}).stats, [{ k: 'learned', id: 'x', t: 2 }])
    const b = withRecent(base({}).stats, [{ k: 'learned', id: 'x', t: 2 }, { k: 'era', e: 0, t: 3 }])
    expect(mergeSaved({ items: {}, stats: a }, { items: {}, stats: b }).stats.recent).toEqual([
      { k: 'era', e: 0, t: 3 },
      { k: 'learned', id: 'x', t: 2 },
    ])
  })
})

// Keeps the real data and the eras in step: a wiki refresh that renames an aesthetic shows up here.
describe('data', () => {
  it('ids are unique', () => {
    expect(new Set(all.map((a: Aesthetic) => a.id)).size).toBe(all.length)
  })
})
