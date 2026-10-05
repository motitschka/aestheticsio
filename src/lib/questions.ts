import type { Aesthetic, PracticeMode, Progress, ScoredMode } from '../types'
import { eraOf } from './eras'
import { practiceStatus } from './progress'
import { pickOne, sample, shuffle, type Rng } from './random'
import { maskName, normalizeName } from './text'

export const ROUND_SIZE = 10
export const CHOICES = 4
/** Recognised aesthetics re-checked per round (least recently practised first). */
export const REVIEW_SLOTS = 2
/** New aesthetics introduced per round, even when many are still being learned. */
export const MIN_NEW = 3

export interface Choice {
  key: string
  label?: string
  image?: string
  aesthetic?: Aesthetic
}

export interface Clue {
  label: string
  value: string
}

type ChoiceKind = 'image-to-name' | 'tell-apart' | 'description-to-name' | 'clues-to-name' | 'name-to-image' | 'odd-one-out' | LessonChoiceKind
export type LessonChoiceKind = 'pick-colours' | 'pick-motifs' | 'pick-decade'

export interface ChoiceQuestion {
  kind: ChoiceKind
  /** The aesthetic this question is about (credited in practice). */
  target: Aesthetic
  image?: string
  text?: string
  clues?: Clue[]
  /** odd-one-out: the aesthetic of the odd image */
  odd?: Aesthetic
  choices: Choice[]
  answer: string
  /** Lesson checks: the lesson's aesthetic and which check this is, so a missed one can be asked afresh. */
  lesson?: { of: Aesthetic; check: LessonCheck }
}

/** The lesson's checks against close relatives (see lessonSteps). */
export type LessonCheck = 'spot' | 'odd' | 'name'

export interface TypeQuestion {
  kind: 'type-from-image' | 'type-from-description'
  target: Aesthetic
  image?: string
  text?: string
}

export interface TimelineQuestion {
  kind: 'timeline'
  /** In display order (shuffled); the answer is these sorted by year. */
  items: Aesthetic[]
}

export type Question = ChoiceQuestion | TypeQuestion | TimelineQuestion

export const MODE_INFO: Record<PracticeMode, { title: string; blurb: string }> = {
  'image-to-name': { title: 'Image → name', blurb: 'See an image, pick its aesthetic' },
  'name-to-image': { title: 'Name → image', blurb: 'See a name, pick its image' },
  'description-to-name': { title: 'Description → name', blurb: 'Read the wiki intro, name hidden' },
  'clues-to-name': { title: 'Clues → name', blurb: 'Motifs, colours, values and decade' },
  'tell-apart': { title: 'Tell them apart', blurb: 'Choose between related aesthetics' },
  'odd-one-out': { title: 'Odd one out', blurb: 'Which image doesn’t belong?' },
  timeline: { title: 'Timeline', blurb: 'Put four aesthetics in order' },
}

export const PRACTICE_MODES = Object.keys(MODE_INFO) as PracticeMode[]

// ---------- eligibility ----------

const MIN_DESCRIPTION = 80

const description = (a: Aesthetic) => (a.intro ? maskName(a.intro, a) : '')

function clues(a: Aesthetic): Clue[] {
  const list = (label: string, items: string[] | undefined, n: number) =>
    items?.length ? [{ label, value: maskName(items.slice(0, n).join(', '), a) }] : []
  return [
    ...(a.decade ? [{ label: 'Emerged', value: maskName(a.decade, a) }] : []),
    ...(a.origin ? [{ label: 'Origin', value: maskName(a.origin, a) }] : []),
    ...list('Motifs', a.motifs, 4),
    ...list('Colours', a.colours, 5),
    ...list('Values', a.values, 4),
  ]
}

const clueFieldCount = (a: Aesthetic) => [a.motifs, a.colours, a.values].filter((x) => x?.length).length

export function eligible(mode: PracticeMode, a: Aesthetic, byId: Map<string, Aesthetic>): boolean {
  switch (mode) {
    case 'image-to-name':
    case 'name-to-image':
      return a.images.length > 0
    case 'description-to-name':
      return description(a).length >= MIN_DESCRIPTION
    case 'clues-to-name':
      return clueFieldCount(a) >= 2
    case 'tell-apart':
      return (a.similar ?? []).filter((id) => byId.has(id)).length >= 2
    case 'odd-one-out':
      return a.images.length >= 3
    case 'timeline':
      return a.year !== undefined
  }
}

// ---------- practice questions ----------

const nameChoice = (a: Aesthetic): Choice => ({ key: a.id, label: a.name, aesthetic: a })

function randomOthers(target: Aesthetic, all: readonly Aesthetic[], n: number, rng: Rng, ok: (a: Aesthetic) => boolean = () => true) {
  return sample(
    all.filter((a) => a.id !== target.id && ok(a)),
    n,
    rng,
  )
}

export function buildPractice(mode: ScoredMode, target: Aesthetic, all: readonly Aesthetic[], byId: Map<string, Aesthetic>, rng: Rng = Math.random): ChoiceQuestion {
  switch (mode) {
    case 'image-to-name': {
      const options = shuffle([target, ...randomOthers(target, all, CHOICES - 1, rng)], rng)
      return { kind: mode, target, image: pickOne(target.images, rng), choices: options.map(nameChoice), answer: target.id }
    }
    case 'tell-apart': {
      const similar = (target.similar ?? []).map((id) => byId.get(id)).filter((a): a is Aesthetic => !!a)
      const picked = sample(similar.slice(0, 5), CHOICES - 1, rng)
      const fill = randomOthers(target, all, CHOICES - 1 - picked.length, rng, (a) => !picked.includes(a))
      const options = shuffle([target, ...picked, ...fill], rng)
      return { kind: mode, target, image: pickOne(target.images, rng), choices: options.map(nameChoice), answer: target.id }
    }
    case 'description-to-name': {
      const text = description(target)
      const plainText = normalizeName(text)
      // Leave out options whose name appears in the text (e.g. "an evolution of Memphis Design").
      const others = randomOthers(target, all, CHOICES - 1, rng, (a) => !plainText.includes(normalizeName(a.name)))
      return { kind: mode, target, text, choices: shuffle([target, ...others], rng).map(nameChoice), answer: target.id }
    }
    case 'clues-to-name': {
      const options = shuffle([target, ...randomOthers(target, all, CHOICES - 1, rng)], rng)
      return { kind: mode, target, clues: clues(target), choices: options.map(nameChoice), answer: target.id }
    }
    case 'name-to-image': {
      const options = shuffle([target, ...randomOthers(target, all, CHOICES - 1, rng)], rng)
      return {
        kind: mode,
        target,
        choices: options.map((a) => ({ key: a.id, image: pickOne(a.images, rng), aesthetic: a })),
        answer: target.id,
      }
    }
    case 'odd-one-out': {
      const odd = randomOthers(target, all, 1, rng)[0]
      const same = sample(target.images, 3, rng).map((image, i) => ({ key: `same${i}`, image, aesthetic: target }))
      const oddChoice = { key: 'odd', image: pickOne(odd.images, rng), aesthetic: odd }
      return { kind: mode, target, odd, choices: shuffle([...same, oddChoice], rng), answer: 'odd' }
    }
  }
}

export function buildTimeline(all: readonly Aesthetic[], rng: Rng = Math.random): TimelineQuestion {
  const byDecade = new Map<number, Aesthetic[]>()
  for (const a of all) if (a.year !== undefined) byDecade.set(a.year, [...(byDecade.get(a.year) ?? []), a])
  const decades = sample([...byDecade.keys()], CHOICES, rng)
  return { kind: 'timeline', items: shuffle(decades.map((d) => pickOne(byDecade.get(d)!, rng)), rng) }
}

export const timelineOrder = (q: TimelineQuestion) => [...q.items].sort((a, b) => a.year! - b.year!).map((a) => a.id)

/**
 * Picks the aesthetics for one round of a practice mode: a couple of recognised
 * ones to re-check, a few new ones (those with a lesson done first), and the
 * rest from those still being learned.
 */
export function pickTargets(pool: readonly Aesthetic[], items: Progress, mode: ScoredMode, rng: Rng = Math.random, size = ROUND_SIZE): Aesthetic[] {
  const status = (a: Aesthetic) => practiceStatus(items[a.id], mode)
  const known = pool.filter((a) => status(a) === 'recognised').sort((a, b) => items[a.id].t - items[b.id].t)
  const learning = shuffle(pool.filter((a) => status(a) === 'learning'), rng)
  const fresh = shuffle(pool.filter((a) => status(a) === 'new'), rng).sort((a, b) => (items[b.id]?.lt ? 1 : 0) - (items[a.id]?.lt ? 1 : 0))

  const review = known.slice(0, Math.min(REVIEW_SLOTS, size))
  const newCount = Math.min(fresh.length, Math.max(MIN_NEW, size - review.length - learning.length))
  const picked = [...review, ...fresh.slice(0, newCount), ...learning.slice(0, size - review.length - newCount)]
  for (const a of [...known.slice(review.length), ...fresh.slice(newCount), ...learning]) {
    if (picked.length >= size) break
    if (!picked.includes(a)) picked.push(a)
  }
  return shuffle(picked.slice(0, size), rng)
}

export function buildRound(mode: PracticeMode, all: readonly Aesthetic[], byId: Map<string, Aesthetic>, items: Progress, rng: Rng = Math.random): Question[] {
  if (mode === 'timeline') return Array.from({ length: ROUND_SIZE }, () => buildTimeline(all, rng))
  const pool = all.filter((a) => eligible(mode, a, byId))
  return pickTargets(pool, items, mode, rng).map((t) => buildPractice(mode, t, all, byId, rng))
}

/** A random question for the Mixed challenge. */
export function buildMixed(all: readonly Aesthetic[], byId: Map<string, Aesthetic>, rng: Rng = Math.random): Question {
  const mode = pickOne(PRACTICE_MODES, rng)
  if (mode === 'timeline') return buildTimeline(all, rng)
  const pool = all.filter((a) => eligible(mode, a, byId))
  return buildPractice(mode, pickOne(pool, rng), all, byId, rng)
}

// ---------- lessons ----------

/**
 * Images the player hasn't seen in the lesson: the published Pinterest pins
 * (the lesson's gallery shows the wiki's photos), or the wiki's when there are none.
 */
const unseen = (a: Aesthetic) => (a.pins?.length ? a.pins : a.images)

/**
 * Its closest relatives in the set, the ones worth telling apart: the wiki's
 * "similar" list first, then others from the same era.
 */
export function relativesOf(a: Aesthetic, all: readonly Aesthetic[], n: number, rng: Rng = Math.random): Aesthetic[] {
  const byId = new Map(all.map((x) => [x.id, x]))
  const similar = (a.similar ?? []).map((id) => byId.get(id)).filter((x): x is Aesthetic => !!x && x.id !== a.id && unseen(x).length > 0)
  const picked = sample(similar.slice(0, Math.max(n + 2, 5)), n, rng)
  if (picked.length < n) {
    const era = eraOf(a)
    const sameEra = all.filter((x) => x.id !== a.id && !picked.includes(x) && eraOf(x) === era && unseen(x).length > 0)
    picked.push(...sample(sameEra, n - picked.length, rng))
  }
  if (picked.length < n) picked.push(...randomOthers(a, all, n - picked.length, rng, (x) => !picked.includes(x) && unseen(x).length > 0))
  return picked
}

/** "Which one is X?": one unseen image of it among images of its relatives. */
function spotCheck(a: Aesthetic, all: readonly Aesthetic[], rng: Rng): ChoiceQuestion | null {
  if (!unseen(a).length) return null
  const options = shuffle([a, ...relativesOf(a, all, CHOICES - 1, rng)], rng)
  return {
    kind: 'name-to-image',
    target: a,
    choices: options.map((x) => ({ key: x.id, image: pickOne(unseen(x), rng), aesthetic: x })),
    answer: a.id,
    lesson: { of: a, check: 'spot' },
  }
}

/** Three unseen images of it and one of a close relative: which doesn't belong? */
function oddCheck(a: Aesthetic, all: readonly Aesthetic[], rng: Rng): ChoiceQuestion | null {
  if (unseen(a).length < 3) return null
  const odd = relativesOf(a, all, 1, rng)[0]
  if (!odd) return null
  const same = sample(unseen(a), 3, rng).map((image, i) => ({ key: `same${i}`, image, aesthetic: a }))
  const oddChoice = { key: 'odd', image: pickOne(unseen(odd), rng), aesthetic: odd }
  return { kind: 'odd-one-out', target: a, odd, choices: shuffle([...same, oddChoice], rng), answer: 'odd', lesson: { of: a, check: 'odd' } }
}

/** An unseen image that may be it or one of its relatives: which is it? */
function nameCheck(a: Aesthetic, all: readonly Aesthetic[], rng: Rng): ChoiceQuestion | null {
  const relatives = relativesOf(a, all, CHOICES - 1, rng)
  // Half the time the image is a relative's, so knowing which lesson this is doesn't give it away.
  const shown = rng() < 0.5 || !relatives.length ? a : pickOne(relatives, rng)
  if (!unseen(shown).length) return null
  const options = shuffle([a, ...relatives], rng)
  return { kind: 'tell-apart', target: shown, image: pickOne(unseen(shown), rng), choices: options.map(nameChoice), answer: shown.id, lesson: { of: a, check: 'name' } }
}

const CHECKS: Record<LessonCheck, (a: Aesthetic, all: readonly Aesthetic[], rng: Rng) => ChoiceQuestion | null> = {
  spot: spotCheck,
  odd: oddCheck,
  name: nameCheck,
}

const overlap = (a: string[], b: string[]) => {
  const x = new Set(a.map((s) => s.toLowerCase()))
  const shared = b.filter((s) => x.has(s.toLowerCase())).length
  return shared / Math.min(a.length, b.length)
}

/**
 * "Which are its colours/motifs?": the other options are other aesthetics' lists
 * that differ enough, its close relatives' first.
 */
function pickList(kind: 'pick-colours' | 'pick-motifs', target: Aesthetic, all: readonly Aesthetic[], rng: Rng): ChoiceQuestion | null {
  const field = kind === 'pick-colours' ? 'colours' : 'motifs'
  const n = kind === 'pick-colours' ? 4 : 3
  const mine = target[field]?.slice(0, n)
  if (!mine || mine.length < 2) return null
  const relatives = relativesOf(target, all, 6, rng)
  const rest = shuffle(all, rng).filter((a) => !relatives.includes(a))
  const pool = [...relatives, ...rest].filter((a) => a.id !== target.id && (a[field]?.length ?? 0) >= 2)
  const others: string[][] = []
  for (const a of pool) {
    const list = a[field]!.slice(0, n)
    if (overlap(mine, list) <= 0.34 && others.every((o) => overlap(o, list) < 1)) others.push(list)
    if (others.length === CHOICES - 1) break
  }
  if (others.length < CHOICES - 1) return null
  const choices = shuffle([mine, ...others], rng).map((list) => ({ key: list === mine ? 'answer' : list.join('|'), label: list.join(', ') }))
  return { kind, target, choices, answer: 'answer' }
}

/** "When did it first appear?": its relatives' decades where they differ, then nearby ones. */
function pickDecade(target: Aesthetic, all: readonly Aesthetic[], rng: Rng): ChoiceQuestion | null {
  if (target.year === undefined) return null
  const year = target.year
  const fromRelatives = relativesOf(target, all, 6, rng)
    .map((a) => a.year)
    .filter((y): y is number => y !== undefined && y !== year && y >= 1600)
  const near = [-30, -20, -10, 10, 20, 30].map((d) => year + d).filter((y) => y <= 2020)
  const options: number[] = []
  for (const y of [...shuffle([...new Set(fromRelatives)], rng), ...shuffle(near, rng)]) {
    if (options.length === CHOICES - 1) break
    if (!options.includes(y) && y !== year) options.push(y)
  }
  if (options.length < CHOICES - 1) return null
  const choices = shuffle([year, ...options], rng).sort((x, y) => x - y)
  return { kind: 'pick-decade', target, choices: choices.map((y) => ({ key: String(y), label: `${y}s` })), answer: String(year) }
}

export type InfoCard = 'intro' | 'gallery' | 'look' | 'facts' | 'related'
export type LessonStep = { type: 'info'; card: InfoCard } | { type: 'question'; question: Question }
export type LessonFormat = 'full' | 'info' | 'questions'

/** Builds a fresh question for a lesson step (used again when retrying a missed one). */
export function rebuildLessonQuestion(q: Question, all: readonly Aesthetic[], rng: Rng = Math.random): Question {
  if (q.kind === 'pick-colours' || q.kind === 'pick-motifs') return pickList(q.kind, q.target, all, rng) ?? q
  if (q.kind === 'pick-decade') return pickDecade(q.target, all, rng) ?? q
  if ('lesson' in q && q.lesson) return CHECKS[q.lesson.check](q.lesson.of, all, rng) ?? q
  return q
}

/**
 * A lesson: what the aesthetic is, what it looks like, its facts and its
 * relatives, with checks along the way. The checks are about telling it apart
 * from its close relatives on images the lesson hasn't shown.
 */
export function lessonSteps(a: Aesthetic, all: readonly Aesthetic[], format: LessonFormat, rng: Rng = Math.random): LessonStep[] {
  const info = (card: InfoCard): LessonStep => ({ type: 'info', card })
  const question = (q: Question | null): LessonStep[] => (q ? [{ type: 'question', question: q }] : [])
  const steps: LessonStep[] = [
    info('intro'),
    info('gallery'),
    ...question(spotCheck(a, all, rng)),
    ...(a.motifs?.length || a.colours?.length ? [info('look')] : []),
    ...question(pickList('pick-colours', a, all, rng)),
    ...question(pickList('pick-motifs', a, all, rng)),
    ...(a.decade || a.origin || a.values?.length ? [info('facts')] : []),
    ...question(pickDecade(a, all, rng)),
    ...(a.related?.length ? [info('related')] : []),
    ...question(oddCheck(a, all, rng)),
    ...question(nameCheck(a, all, rng)),
  ]
  if (format === 'info') return steps.filter((s) => s.type === 'info')
  if (format === 'questions') return steps.filter((s) => s.type === 'question')
  return steps
}

