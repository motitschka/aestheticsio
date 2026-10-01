import type { Aesthetic, Entry, Profile, Progress, Stats } from '../types'

export const ROUND_SIZE = 10
export const CHOICES = 4
export const LEARN_STREAK = 3
/** Learned aesthetics re-checked per round (least recently seen first). */
export const REVIEW_SLOTS = 2
/** New aesthetics introduced per round, even when many are still being learned. */
export const MIN_NEW = 3

export type Mode = 'image-to-name' | 'name-to-image'
export type ModeSetting = 'mixed' | Mode

export interface Option {
  aesthetic: Aesthetic
  image: string
}

export interface Question {
  mode: Mode
  target: Aesthetic
  /** image shown in image-to-name mode */
  image: string
  options: Option[]
}

export type Rng = () => number

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pickOne = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)]

export type Status = 'new' | 'learning' | 'learned'

export function statusOf(entry: Entry | undefined): Status {
  if (!entry) return 'new'
  return entry.l ? 'learned' : 'learning'
}

/**
 * Picks the aesthetics for one round: a couple of learned ones to re-check,
 * a few new ones, and the rest from those still being learned.
 */
export function pickRound(all: readonly Aesthetic[], progress: Progress, rng: Rng = Math.random, size = ROUND_SIZE): Aesthetic[] {
  const learned = all.filter((a) => statusOf(progress[a.id]) === 'learned').sort((a, b) => progress[a.id].t - progress[b.id].t)
  const learning = shuffle(all.filter((a) => statusOf(progress[a.id]) === 'learning'), rng)
  const fresh = shuffle(all.filter((a) => statusOf(progress[a.id]) === 'new'), rng)

  const review = learned.slice(0, Math.min(REVIEW_SLOTS, size))
  const newCount = Math.min(fresh.length, Math.max(MIN_NEW, size - review.length - learning.length))
  const picked = [...review, ...fresh.slice(0, newCount), ...learning.slice(0, size - review.length - newCount)]

  // Not enough in the other groups (e.g. nearly everything learned): top up.
  const rest = [...learned.slice(review.length), ...fresh.slice(newCount), ...learning]
  for (const a of rest) {
    if (picked.length >= size) break
    if (!picked.includes(a)) picked.push(a)
  }
  return shuffle(picked.slice(0, size), rng)
}

export function buildQuestion(target: Aesthetic, all: readonly Aesthetic[], setting: ModeSetting, rng: Rng = Math.random): Question {
  const mode: Mode = setting === 'mixed' ? (rng() < 0.5 ? 'image-to-name' : 'name-to-image') : setting
  const others = shuffle(all.filter((a) => a.id !== target.id), rng).slice(0, CHOICES - 1)
  const options = shuffle([target, ...others], rng).map((aesthetic) => ({ aesthetic, image: pickOne(aesthetic.images, rng) }))
  const image = options.find((o) => o.aesthetic.id === target.id)!.image
  return { mode, target, image, options }
}

export function buildRound(all: readonly Aesthetic[], progress: Progress, setting: ModeSetting, rng: Rng = Math.random): Question[] {
  return pickRound(all, progress, rng).map((t) => buildQuestion(t, all, setting, rng))
}

export function applyAnswer(prev: Entry | undefined, correct: boolean, now: number): Entry {
  const e = prev ?? { s: 0, l: false, c: 0, w: 0, t: 0 }
  if (!correct) return { s: 0, l: false, c: e.c, w: e.w + 1, t: now }
  const s = e.s + 1
  return { s, l: e.l || s >= LEARN_STREAK, c: e.c + 1, w: e.w, t: now }
}

export function statsOf(progress: Progress): Stats {
  let learned = 0
  let correct = 0
  let answered = 0
  for (const e of Object.values(progress)) {
    if (e.l) learned++
    correct += e.c
    answered += e.c + e.w
  }
  return { learned, correct, answered }
}

/** Combines two progress maps, keeping the more recently answered entry per aesthetic. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const merged = { ...a }
  for (const [id, entry] of Object.entries(b)) {
    if (!merged[id] || entry.t > merged[id].t) merged[id] = entry
  }
  return merged
}

export const accuracy = (s: Stats) => (s.answered ? s.correct / s.answered : 0)

/** Most learned first; ties go to better accuracy. */
export function rankProfiles(profiles: readonly Profile[]): Profile[] {
  return [...profiles].sort(
    (a, b) => b.learned - a.learned || accuracy(b) - accuracy(a) || a.nickname.localeCompare(b.nickname),
  )
}
