import type { Entry, PlayerStats, Profile, Progress, SavedProgress, ScoredMode, Tier } from '../types'

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
 * right the first time. Mastered never drops; learned drops to seen on a mistake.
 */
export function applyLesson(prev: Entry | undefined, perfect: boolean, now: number): Entry {
  const e = prev ?? emptyEntry()
  if (e.lt === 3) return e
  if (!perfect) return { ...e, lt: 1 }
  if (e.lt === 2) return e.la !== undefined && now - e.la >= MASTERY_WAIT ? { ...e, lt: 3 } : e
  return { ...e, lt: 2, la: now }
}

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

export function profileFrom(base: Pick<Profile, 'uid' | 'nickname' | 'avatar'>, saved: SavedProgress): Profile {
  const { stats } = saved
  const p: Profile = { ...base, lessonPoints: lessonPoints(saved.items), bestStreak: stats.bestStreak, ...practiceTotals(saved.items) }
  for (const m of MILESTONES) {
    const t = stats[bestKey(m)]
    if (t !== undefined) p[bestKey(m)] = t
  }
  return p
}

export const accuracy = (p: { correct: number; answered: number }) => (p.answered ? p.correct / p.answered : 0)

export const rankByLessons = (profiles: readonly Profile[]) =>
  [...profiles].sort((a, b) => b.lessonPoints - a.lessonPoints || accuracy(b) - accuracy(a) || a.nickname.localeCompare(b.nickname))

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
  return e
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
  }
  for (const m of MILESTONES) {
    const key = bestKey(m)
    const t = Math.min(a[key] ?? Infinity, g[key] ?? Infinity)
    if (t !== Infinity) stats[key] = t
  }
  return { items, stats }
}
