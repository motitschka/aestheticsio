import { describe, expect, it } from 'vitest'
import type { Entry, PlayerStats, Profile } from '../types'
import {
  applyChallenge,
  applyLesson,
  applyPractice,
  earnedBadges,
  emptyStats,
  lessonPoints,
  lessonState,
  MASTERY_WAIT,
  mergeSaved,
  normalizeSaved,
  overallPercent,
  practiceStatus,
  rankByLessons,
  rankByStreak,
  recognised,
} from './progress'

const DAY = 24 * 60 * 60 * 1000

describe('practice', () => {
  it('recognised after three right in a row, per mode', () => {
    let e = applyPractice(undefined, 'tell-apart', true, 1)
    e = applyPractice(e, 'tell-apart', true, 2)
    expect(practiceStatus(e, 'tell-apart')).toBe('learning')
    e = applyPractice(e, 'tell-apart', true, 3)
    expect(recognised(e, 'tell-apart')).toBe(true)
    expect(practiceStatus(e, 'odd-one-out')).toBe('new')
    expect(e).toMatchObject({ c: 3, w: 0, t: 3 })
  })

  it('a mistake resets that mode only', () => {
    let e: Entry = { m: { 'tell-apart': 5, 'image-to-name': 4 }, c: 9, w: 0, t: 1 }
    e = applyPractice(e, 'tell-apart', false, 2)
    expect(e.m).toEqual({ 'tell-apart': 0, 'image-to-name': 4 })
    expect(e.w).toBe(1)
  })
})

describe('lessons', () => {
  const now = 1_000 * DAY

  it('first time: perfect → learned, otherwise seen', () => {
    expect(applyLesson(undefined, true, now)).toMatchObject({ lt: 2, la: now })
    expect(applyLesson(undefined, false, now)).toMatchObject({ lt: 1 })
  })

  it('seen → learned with a perfect run', () => {
    expect(applyLesson({ lt: 1, c: 0, w: 0, t: 0 }, true, now)).toMatchObject({ lt: 2, la: now })
  })

  it('learned → mastered only after 30 days', () => {
    const learned: Entry = { lt: 2, la: now, c: 0, w: 0, t: 0 }
    expect(applyLesson(learned, true, now + MASTERY_WAIT - 1)).toEqual(learned)
    expect(lessonState(learned, now + MASTERY_WAIT - 1)).toBe('learned')
    expect(lessonState(learned, now + MASTERY_WAIT)).toBe('ready')
    expect(applyLesson(learned, true, now + MASTERY_WAIT).lt).toBe(3)
  })

  it('learned drops to seen on a mistake; relearning restarts the 30 days', () => {
    const dropped = applyLesson({ lt: 2, la: now, c: 0, w: 0, t: 0 }, false, now + 40 * DAY)
    expect(dropped.lt).toBe(1)
    const relearned = applyLesson(dropped, true, now + 41 * DAY)
    expect(relearned).toMatchObject({ lt: 2, la: now + 41 * DAY })
    expect(lessonState(relearned, now + 50 * DAY)).toBe('learned')
  })

  it('mastered never drops', () => {
    const mastered: Entry = { lt: 3, la: now, c: 0, w: 0, t: 0 }
    expect(applyLesson(mastered, false, now)).toEqual(mastered)
  })

  it('overall % goes to 200 when everything is mastered', () => {
    const items = { a: { lt: 2 as const, c: 0, w: 0, t: 0 }, b: { lt: 3 as const, c: 0, w: 0, t: 0 }, c: { lt: 1 as const, c: 0, w: 0, t: 0 } }
    expect(lessonPoints(items)).toBe(3)
    expect(overallPercent(3, 3)).toBe(100)
    expect(overallPercent(6, 3)).toBe(200)
    expect(overallPercent(1, 3)).toBe(33)
  })
})

describe('challenge', () => {
  it('keeps the best streak and fastest milestone times', () => {
    let s = applyChallenge(emptyStats(), 30, { 25: 200_000 })
    s = applyChallenge(s, 12, {})
    s = applyChallenge(s, 26, { 25: 150_000 })
    expect(s).toMatchObject({ bestStreak: 30, best25: 150_000 })
    expect(s.best50).toBeUndefined()
  })

  it('awards streak and speed badges', () => {
    const s: PlayerStats = { ...emptyStats(), bestStreak: 27, best25: 179_000 }
    expect(earnedBadges(s)).toEqual(['streak10', 'streak25', 'fast25'])
    expect(earnedBadges({ ...s, best25: 181_000 })).toEqual(['streak10', 'streak25'])
  })
})

describe('ranking', () => {
  const p = (nickname: string, lessonPoints: number, bestStreak: number, correct = 5, answered = 10, best25?: number): Profile => ({
    uid: nickname,
    nickname,
    avatar: '',
    lessonPoints,
    bestStreak,
    correct,
    answered,
    ...(best25 ? { best25 } : {}),
  })

  it('lessons: points, then accuracy', () => {
    expect(rankByLessons([p('low', 1, 0), p('sloppy', 5, 0, 5), p('sharp', 5, 0, 9)]).map((x) => x.nickname)).toEqual(['sharp', 'sloppy', 'low'])
  })

  it('streak: best streak, then fastest 25', () => {
    expect(rankByStreak([p('a', 0, 30, 0, 0, 200_000), p('b', 0, 30, 0, 0, 100_000), p('c', 0, 40)]).map((x) => x.nickname)).toEqual(['c', 'b', 'a'])
  })
})

describe('loading and merging', () => {
  it('upgrades first-version progress', () => {
    const saved = normalizeSaved({ x: { s: 1, l: true, c: 4, w: 1, t: 9 }, y: { s: 2, l: false, c: 2, w: 0, t: 8 } })
    expect(saved.items.x).toEqual({ m: { 'image-to-name': 3, 'name-to-image': 3 }, c: 4, w: 1, t: 9 })
    expect(saved.items.y.m).toEqual({ 'image-to-name': 2, 'name-to-image': 2 })
    expect(saved.stats).toEqual(emptyStats())
  })

  it('merges guest progress into an account', () => {
    const account = normalizeSaved({ items: { a: { lt: 2, la: 5, m: { 'tell-apart': 1 }, c: 1, w: 0, t: 10 } }, stats: { ...emptyStats(), bestStreak: 8, best25: 300 } })
    const guest = normalizeSaved({ items: { a: { lt: 1, m: { 'tell-apart': 3 }, c: 3, w: 1, t: 20 }, b: { c: 1, w: 0, t: 1 } }, stats: { timelineRight: 2, timelineTotal: 3, bestStreak: 12, best25: 400 } })
    const merged = mergeSaved(account, guest)
    expect(merged.items.a).toEqual({ lt: 2, la: 5, m: { 'tell-apart': 3 }, c: 4, w: 1, t: 20 })
    expect(merged.items.b).toEqual(guest.items.b)
    expect(merged.stats).toEqual({ timelineRight: 2, timelineTotal: 3, bestStreak: 12, best25: 300 })
  })
})
