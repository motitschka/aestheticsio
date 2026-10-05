import type { Aesthetic, CircleEvent, Entry, PlayerStats, Profile, Progress, SavedProgress, ScoredMode, Tier } from '../types'
import { eraCounts } from './eras'

/** Right answers in a row for an aesthetic to count as recognised in a practice mode. */
export const RECOGNISE_STREAK = 3
const DAY = 24 * 60 * 60 * 1000
/** A learned lesson can be mastered once it has stayed learned this long. */
export const MASTERY_WAIT = 30 * DAY

export const emptyStats = (): PlayerStats => ({ timelineRight: 0, timelineTotal: 0, bestStreak: 0 })
const emptyEntry = (): Entry => ({ c: 0, w: 0, t: 0 })

// ---------- practice ----------

export function applyPractice(prev: Entry | undefined, mode: ScoredMode, correct: boolean, now: number): Entry {
  const e = prev ?? emptyEntry()
  const streak = correct ? (e.m?.[mode] ?? 0) + 1 : 0
  return { ...e, m: { ...e.m, [mode]: streak }, c: e.c + (correct ? 1 : 0), w: e.w + (correct ? 0 : 1), t: now }
}

export const recognised = (e: Entry | undefined, mode: ScoredMode) => (e?.m?.[mode] ?? 0) >= RECOGNISE_STREAK

export type PracticeStatus = 'new' | 'learning' | 'recognised'

export function practiceStatus(e: Entry | undefined, mode: ScoredMode): PracticeStatus {
  const streak = e?.m?.[mode]
  if (streak === undefined) return 'new'
  return streak >= RECOGNISE_STREAK ? 'recognised' : 'learning'
}

// ---------- lessons ----------

export type LessonState = 'new' | 'seen' | 'learned' | 'ready' | 'mastered'

export const LESSON_LABEL: Record<LessonState, string> = {
  new: 'New',
  seen: 'Seen',
  learned: 'Learned',
  ready: 'Ready to master',
  mastered: 'Mastered',
}

export function lessonState(e: Entry | undefined, now: number): LessonState {
  switch (e?.lt) {
    case 3:
      return 'mastered'
    case 2:
      return e.la !== undefined && now - e.la >= MASTERY_WAIT ? 'ready' : 'learned'
    case 1:
      return 'seen'
    default:
      return 'new'
  }
}

/**
 * A finished lesson (first time, or questions only). Perfect = every question
 * right the first time. Learned and mastered are never lost: a mistake on a
 * learned lesson only restarts its month before it can be mastered.
 */
export function applyLesson(prev: Entry | undefined, perfect: boolean, now: number): Entry {
  const e = prev ?? emptyEntry()
  if (e.lt === 3) return e
  if (e.lt === 2) {
    if (!perfect) return { ...e, la: now }
    return e.la !== undefined && now - e.la >= MASTERY_WAIT ? { ...e, lt: 3 } : e
  }
  if (!perfect) return { ...e, lt: 1 }
  return { ...e, lt: 2, la: now, u: 1 }
}

// ---------- the journey and the daily goal ----------

/** The journey through time (version 2). Progress from before it is reset once, with a backup. */
export const JOURNEY = 2
/** Lessons a day that keep the day streak going */
export const DAILY_GOAL = 1
/** Doing twice the goal in a day banks a freeze, up to this many */
export const MAX_FREEZES = 2
/** How many moments each player keeps for the circle feed */
export const RECENT = 6

const pad = (n: number) => String(n).padStart(2, '0')

/** The local calendar day, as YYYY-MM-DD. */
export function dayKey(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Whole days from day a to day b (YYYY-MM-DD). */
export function daysBetween(a: string, b: string) {
  const utc = (k: string) => {
    const [y, m, d] = k.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((utc(b) - utc(a)) / DAY)
}

export const lessonsToday = (s: Pick<PlayerStats, 'today'>, now: number) => (s.today?.d === dayKey(now) ? s.today.n : 0)

/**
 * The day streak as it stands now. It survives missed days as long as there
 * are freezes to cover them (they're used up when the goal is next met).
 */
export function dayStreakNow(s: Pick<PlayerStats, 'goalDay' | 'dayStreak' | 'freezes'>, now: number): number {
  if (!s.goalDay || !s.dayStreak) return 0
  const missed = daysBetween(s.goalDay, dayKey(now)) - 1
  return missed <= (s.freezes ?? 0) ? s.dayStreak : 0
}

/** Freezes that will be used up to keep the streak alive when the goal is next met. */
export function freezesNeeded(s: Pick<PlayerStats, 'goalDay'>, now: number) {
  return s.goalDay ? Math.max(0, daysBetween(s.goalDay, dayKey(now)) - 1) : 0
}

export interface DailyOutcome {
  stats: PlayerStats
  /** The goal was met just now (the first lesson of the day) */
  goalMet: boolean
  freezeEarned: boolean
}

/** Counts a finished lesson toward today's goal, the day streak and freezes. */
export function applyDailyLesson(stats: PlayerStats, now: number): DailyOutcome {
  const d = dayKey(now)
  const n = lessonsToday(stats, now) + 1
  const next: PlayerStats = { ...stats, today: { d, n } }
  let goalMet = false
  let freezeEarned = false
  if (n === DAILY_GOAL && stats.goalDay !== d) {
    let streak = 1
    let freezes = stats.freezes ?? 0
    if (stats.goalDay) {
      const missed = daysBetween(stats.goalDay, d) - 1
      if (missed === 0) streak = (stats.dayStreak ?? 0) + 1
      else if (missed > 0 && missed <= freezes) {
        freezes -= missed
        streak = (stats.dayStreak ?? 0) + 1
      }
    }
    next.goalDay = d
    next.dayStreak = streak
    next.bestDayStreak = Math.max(stats.bestDayStreak ?? 0, streak)
    next.freezes = freezes
    goalMet = true
  }
  if (n === DAILY_GOAL * 2 && (next.freezes ?? 0) < MAX_FREEZES) {
    next.freezes = (next.freezes ?? 0) + 1
    freezeEarned = true
  }
  return { stats: next, goalMet, freezeEarned }
}

/** Adds moments to the circle feed (newest first, the latest few kept). */
export const withRecent = (stats: PlayerStats, events: CircleEvent[]): PlayerStats =>
  events.length ? { ...stats, recent: [...events, ...(stats.recent ?? [])].slice(0, RECENT) } : stats

/** Progress made before the journey through time; it's reset once (see freshStart). */
export const needsFreshStart = (s: SavedProgress) => s.stats.v !== JOURNEY

export const hasProgress = (p: SavedProgress) =>
  Object.keys(p.items).length > 0 || p.stats.timelineTotal > 0 || p.stats.bestStreak > 0 || !!p.stats.theme

/** Everyone starts the journey fresh: an empty record (the caller keeps a backup of the old one). */
export const freshStart = (hadProgress: boolean): SavedProgress => ({
  items: {},
  stats: { ...emptyStats(), v: JOURNEY, ...(hadProgress ? { journeyNote: 1 as const } : {}) },
})

const tierPoints = (lt: Tier | undefined) => (lt === 3 ? 2 : lt === 2 ? 1 : 0)

/** Learned lessons count 1, mastered 2. */
export const lessonPoints = (items: Progress) => Object.values(items).reduce((n, e) => n + tierPoints(e.lt), 0)

/** 100 when every lesson is learned, 200 when every lesson is mastered. */
export const overallPercent = (points: number, total: number) => (total ? Math.floor((points / total) * 100) : 0)

// ---------- challenge ----------

export const MILESTONES = [25, 50, 100] as const
export type Milestone = (typeof MILESTONES)[number]

export interface Badge {
  id: string
  label: string
  detail: string
  earned(s: Pick<PlayerStats, 'bestStreak' | 'best25' | 'best50' | 'best100'>): boolean
}

const minutes = (m: number) => m * 60 * 1000

export const BADGES: Badge[] = [
  ...[10, 25, 50, 100].map((n) => ({
    id: `streak${n}`,
    label: `${n} in a row`,
    detail: `Get ${n} right in a row in the Mixed challenge`,
    earned: (s: PlayerStats) => s.bestStreak >= n,
  })),
  ...(
    [
      [25, 3, 'best25'],
      [50, 6, 'best50'],
      [100, 12, 'best100'],
    ] as const
  ).map(([n, mins, key]) => ({
    id: `fast${n}`,
    label: `${n} in ${mins}:00`,
    detail: `Get ${n} right in a row in under ${mins} minutes`,
    earned: (s: PlayerStats) => s[key] !== undefined && s[key] <= minutes(mins),
  })),
]

export const earnedBadges = (s: Pick<PlayerStats, 'bestStreak' | 'best25' | 'best50' | 'best100'>) =>
  BADGES.filter((b) => b.earned(s)).map((b) => b.id)

const bestKey = (m: Milestone) => `best${m}` as const

/** Records a finished challenge run. `splits` are the times when each milestone was reached. */
export function applyChallenge(stats: PlayerStats, streak: number, splits: Partial<Record<Milestone, number>>): PlayerStats {
  const next = { ...stats, bestStreak: Math.max(stats.bestStreak, streak) }
  for (const m of MILESTONES) {
    const t = splits[m]
    const key = bestKey(m)
    if (t !== undefined && (next[key] === undefined || t < next[key])) next[key] = t
  }
  return next
}

// ---------- profiles & leaderboard ----------

export function practiceTotals(items: Progress) {
  let correct = 0
  let answered = 0
  for (const e of Object.values(items)) {
    correct += e.c
    answered += e.c + e.w
  }
  return { correct, answered }
}

export function profileFrom(base: Pick<Profile, 'uid' | 'nickname' | 'avatar'>, saved: SavedProgress, all: readonly Aesthetic[]): Profile {
  const { stats } = saved
  const p: Profile = { ...base, lessonPoints: lessonPoints(saved.items), bestStreak: stats.bestStreak, ...practiceTotals(saved.items) }
  for (const m of MILESTONES) {
    const t = stats[bestKey(m)]
    if (t !== undefined) p[bestKey(m)] = t
  }
  if (all.length) p.eras = eraCounts(all, saved.items)
  if (stats.goalDay) {
    p.goalDay = stats.goalDay
    p.dayStreak = stats.dayStreak ?? 0
    p.freezes = stats.freezes ?? 0
  }
  if (stats.recent?.length) p.recent = stats.recent
  return p
}

/** Lessons learned (or mastered), from a profile's era counts. */
export const learnedCount = (p: Pick<Profile, 'eras'>) => (p.eras ?? []).reduce((n, x) => n + x, 0)

export const accuracy = (p: { correct: number; answered: number }) => (p.answered ? p.correct / p.answered : 0)

/** Most learned first, then most mastered (lesson points count mastered twice). */
export const rankByLessons = (profiles: readonly Profile[]) =>
  [...profiles].sort(
    (a, b) => learnedCount(b) - learnedCount(a) || b.lessonPoints - a.lessonPoints || accuracy(b) - accuracy(a) || a.nickname.localeCompare(b.nickname),
  )

export const rankByStreak = (profiles: readonly Profile[]) =>
  [...profiles].sort(
    (a, b) => b.bestStreak - a.bestStreak || (a.best25 ?? Infinity) - (b.best25 ?? Infinity) || a.nickname.localeCompare(b.nickname),
  )

// ---------- loading & merging ----------

/** Accepts the current format and the first version ({s, l} = streak/learned across image questions). */
export function normalizeEntry(raw: Record<string, unknown>): Entry {
  const e: Entry = { c: Number(raw.c ?? 0), w: Number(raw.w ?? 0), t: Number(raw.t ?? 0) }
  if (raw.m && typeof raw.m === 'object') e.m = raw.m as Entry['m']
  else if ('s' in raw || 'l' in raw) {
    const streak = raw.l ? RECOGNISE_STREAK : Number(raw.s ?? 0)
    e.m = { 'image-to-name': streak, 'name-to-image': streak }
  }
  if (raw.lt === 1 || raw.lt === 2 || raw.lt === 3) e.lt = raw.lt
  if (typeof raw.la === 'number') e.la = raw.la
  if (raw.u === 1 || (e.lt ?? 0) >= 2) e.u = 1
  return e
}

/** Accepts { items, stats } or the first version's bare items map. */
export function normalizeSaved(raw: unknown): SavedProgress {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const hasItems = obj.items && typeof obj.items === 'object'
  const rawItems = (hasItems ? obj.items : obj) as Record<string, Record<string, unknown>>
  const items: Progress = {}
  for (const [id, e] of Object.entries(rawItems)) if (e && typeof e === 'object') items[id] = normalizeEntry(e)
  return { items, stats: { ...emptyStats(), ...((obj.stats as Partial<PlayerStats>) ?? {}) } }
}

function mergeEntry(a: Entry, b: Entry): Entry {
  const newer = a.t >= b.t ? a : b
  const tierOwner = (b.lt ?? 0) > (a.lt ?? 0) || ((b.lt ?? 0) === (a.lt ?? 0) && (b.la ?? 0) > (a.la ?? 0)) ? b : a
  const e: Entry = { c: a.c + b.c, w: a.w + b.w, t: Math.max(a.t, b.t) }
  if (newer.m) e.m = newer.m
  if (tierOwner.lt) e.lt = tierOwner.lt
  if (tierOwner.la !== undefined) e.la = tierOwner.la
  if (a.u || b.u) e.u = 1
  return e
}

/** The daily-goal fields of whichever record met its goal last. */
function laterDaily(a: PlayerStats, b: PlayerStats): Partial<PlayerStats> {
  const pick = (b.goalDay ?? '') > (a.goalDay ?? '') ? b : a
  const out: Partial<PlayerStats> = {}
  if (pick.goalDay) {
    out.goalDay = pick.goalDay
    out.dayStreak = pick.dayStreak
    out.freezes = pick.freezes
  }
  const best = Math.max(a.bestDayStreak ?? 0, b.bestDayStreak ?? 0)
  if (best) out.bestDayStreak = best
  const today = (b.today?.d ?? '') > (a.today?.d ?? '') ? b.today : (a.today?.d ?? '') > (b.today?.d ?? '') ? a.today : a.today && b.today ? { d: a.today.d, n: Math.max(a.today.n, b.today.n) } : (a.today ?? b.today)
  if (today) out.today = today
  return out
}

const eventKey = (e: CircleEvent) => `${e.k}:${e.k === 'learned' ? e.id : e.e}:${e.t}`

function mergeRecent(a: CircleEvent[] = [], b: CircleEvent[] = []): CircleEvent[] | undefined {
  const seen = new Set<string>()
  const out = [...a, ...b].filter((e) => !seen.has(eventKey(e)) && seen.add(eventKey(e))).sort((x, y) => y.t - x.t).slice(0, RECENT)
  return out.length ? out : undefined
}

/** Combines guest progress into an account's. */
export function mergeSaved(account: SavedProgress, guest: SavedProgress): SavedProgress {
  const items = { ...account.items }
  for (const [id, e] of Object.entries(guest.items)) items[id] = items[id] ? mergeEntry(items[id], e) : e
  const a = account.stats
  const g = guest.stats
  const stats: PlayerStats = {
    timelineRight: a.timelineRight + g.timelineRight,
    timelineTotal: a.timelineTotal + g.timelineTotal,
    bestStreak: Math.max(a.bestStreak, g.bestStreak),
    ...laterDaily(a, g),
  }
  const theme = a.theme || g.theme
  if (theme) stats.theme = theme
  for (const m of MILESTONES) {
    const key = bestKey(m)
    const t = Math.min(a[key] ?? Infinity, g[key] ?? Infinity)
    if (t !== Infinity) stats[key] = t
  }
  if (a.v === JOURNEY || g.v === JOURNEY) stats.v = JOURNEY
  if (a.journeyNote || g.journeyNote) stats.journeyNote = a.journeyNote === 0 || g.journeyNote === 0 ? 0 : 1
  const recent = mergeRecent(a.recent, g.recent)
  if (recent) stats.recent = recent
  return { items, stats }
}

/** One aesthetic's progress, as the same record seen from two devices: nothing goes backwards. */
function syncEntry(local: Entry, remote: Entry): Entry {
  const newer = remote.t >= local.t ? remote : local
  const tierOwner = (local.lt ?? 0) > (remote.lt ?? 0) ? local : remote
  const e: Entry = { c: Math.max(local.c, remote.c), w: Math.max(local.w, remote.w), t: Math.max(local.t, remote.t) }
  if (newer.m) e.m = newer.m
  if (tierOwner.lt) e.lt = tierOwner.lt
  if (tierOwner.la !== undefined) e.la = tierOwner.la
  if (local.u || remote.u) e.u = 1
  return e
}

/**
 * The account as this device has it, updated with what the server has (written
 * by another device, or this one). Records only move forward, so a device
 * that was left open with old data can't roll anything back.
 */
export function syncMerge(local: SavedProgress, remote: SavedProgress): SavedProgress {
  // A fresh start on the server (or here) wins over older records.
  if (remote.stats.v === JOURNEY && local.stats.v !== JOURNEY) return remote
  if (local.stats.v === JOURNEY && remote.stats.v !== JOURNEY) return local
  const items: Progress = { ...remote.items }
  for (const [id, e] of Object.entries(local.items)) items[id] = items[id] ? syncEntry(e, items[id]) : e
  const l = local.stats
  const r = remote.stats
  const stats: PlayerStats = {
    ...r,
    timelineRight: Math.max(l.timelineRight, r.timelineRight),
    timelineTotal: Math.max(l.timelineTotal, r.timelineTotal),
    bestStreak: Math.max(l.bestStreak, r.bestStreak),
    ...laterDaily(l, r),
  }
  for (const m of MILESTONES) {
    const key = bestKey(m)
    const t = Math.min(l[key] ?? Infinity, r[key] ?? Infinity)
    if (t !== Infinity) stats[key] = t
  }
  const recent = mergeRecent(l.recent, r.recent)
  if (recent) stats.recent = recent
  return { items, stats }
}
