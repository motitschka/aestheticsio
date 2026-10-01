import { describe, expect, it } from 'vitest'
import type { Aesthetic, Progress, ScoredMode } from '../types'
import { buildMixed, buildPractice, buildRound, buildTimeline, CHOICES, eligible, lessonSteps, pickTargets, ROUND_SIZE, timelineOrder, type ChoiceQuestion } from './questions'
import { BLANK, matchesName, maskName } from './text'

// Deterministic PRNG so failures are reproducible.
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

const COLOURS = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet', 'Black', 'White', 'Grey', 'Brown', 'Pink', 'Gold', 'Silver', 'Teal', 'Cyan', 'Beige', 'Navy', 'Olive', 'Maroon']

const make = (n: number): Aesthetic[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `a${i}`,
    name: `Style${i}`,
    wiki: '',
    images: [`img${i}-0`, `img${i}-1`, `img${i}-2`, `img${i}-3`],
    intro: `Style${i} is an aesthetic number ${i} with a long enough description to be used in a question about it.`,
    year: 1900 + (i % 12) * 10,
    decade: `${1900 + (i % 12) * 10}s`,
    colours: [COLOURS[i % 20], COLOURS[(i + 5) % 20], COLOURS[(i + 10) % 20]],
    motifs: [`Motif ${i}a`, `Motif ${i}b`],
    values: [`Value ${i}`],
    similar: [`a${(i + 1) % n}`, `a${(i + 2) % n}`, `a${(i + 3) % n}`],
    related: [`Style${(i + 1) % n}`],
  }))

const all = make(40)
const byId = new Map(all.map((a) => [a.id, a]))

describe('practice questions', () => {
  const modes: ScoredMode[] = ['image-to-name', 'name-to-image', 'description-to-name', 'clues-to-name', 'tell-apart', 'odd-one-out']

  it.each(modes)('%s: one right answer among distinct choices', (mode) => {
    for (let seed = 1; seed < 30; seed++) {
      const q = buildPractice(mode, all[7], all, byId, seeded(seed))
      expect(q.choices).toHaveLength(CHOICES)
      expect(new Set(q.choices.map((c) => c.key)).size).toBe(CHOICES)
      expect(q.choices.filter((c) => c.key === q.answer)).toHaveLength(1)
    }
  })

  it('tell-apart uses related aesthetics as the wrong answers', () => {
    const q = buildPractice('tell-apart', all[7], all, byId, seeded(3))
    expect(q.choices.map((c) => c.key).sort()).toEqual(['a10', 'a7', 'a8', 'a9'])
  })

  it('odd one out: three images of the target and one of another aesthetic', () => {
    const q = buildPractice('odd-one-out', all[7], all, byId, seeded(5))
    expect(q.choices.filter((c) => c.aesthetic?.id === 'a7')).toHaveLength(3)
    expect(q.choices.find((c) => c.key === q.answer)!.aesthetic!.id).toBe(q.odd!.id)
  })

  it('descriptions and clues hide the name', () => {
    const d = buildPractice('description-to-name', all[7], all, byId, seeded(1))
    expect(d.text).not.toContain('Style7')
    expect(d.text).toContain(BLANK)
  })

  it('timeline picks four different decades', () => {
    for (let seed = 1; seed < 20; seed++) {
      const q = buildTimeline(all, seeded(seed))
      expect(new Set(q.items.map((a) => a.year)).size).toBe(4)
      const order = timelineOrder(q).map((id) => byId.get(id)!.year!)
      expect(order).toEqual([...order].sort((x, y) => x - y))
    }
  })

  it('mixed questions come from every mode', () => {
    const rng = seeded(7)
    const kinds = new Set(Array.from({ length: 200 }, () => buildMixed(all, byId, rng).kind))
    expect(kinds.size).toBe(7)
  })

  it('eligibility follows the data', () => {
    const bare: Aesthetic = { id: 'x', name: 'Bare', wiki: '', images: ['one'] }
    expect(eligible('image-to-name', bare, byId)).toBe(true)
    expect(eligible('odd-one-out', bare, byId)).toBe(false)
    expect(eligible('clues-to-name', bare, byId)).toBe(false)
    expect(eligible('timeline', bare, byId)).toBe(false)
    expect(eligible('tell-apart', bare, byId)).toBe(false)
  })
})

describe('rounds', () => {
  it('a first round is ten different new aesthetics', () => {
    const round = buildRound('image-to-name', all, byId, {}, seeded())
    expect(round).toHaveLength(ROUND_SIZE)
    expect(new Set(round.map((q) => (q as ChoiceQuestion).target.id)).size).toBe(ROUND_SIZE)
  })

  it('re-checks recognised ones, introduces new ones (lesson-done first) and fills with the rest', () => {
    const items: Progress = {}
    for (let i = 0; i < 10; i++) items[`a${i}`] = { m: { 'tell-apart': 3 }, c: 3, w: 0, t: 100 - i }
    for (let i = 10; i < 30; i++) items[`a${i}`] = { m: { 'tell-apart': 1 }, c: 1, w: 0, t: 50 }
    items.a35 = { lt: 2, la: 1, c: 0, w: 0, t: 0 }
    const ids = pickTargets(all, items, 'tell-apart', seeded()).map((a) => a.id)
    expect(ids).toContain('a9')
    expect(ids).toContain('a8')
    expect(ids).toContain('a35')
    expect(ids.filter((id) => !items[id]?.m)).toHaveLength(3)
  })
})

describe('lessons', () => {
  it('full lessons alternate info and every question type', () => {
    const steps = lessonSteps(all[7], all, 'full', seeded())
    expect(steps.map((s) => (s.type === 'info' ? s.card : s.question.kind))).toEqual([
      'intro',
      'gallery',
      'type-from-image',
      'look',
      'pick-colours',
      'pick-motifs',
      'facts',
      'pick-decade',
      'related',
      'type-from-description',
    ])
  })

  it('later formats split info and questions', () => {
    expect(lessonSteps(all[7], all, 'info').every((s) => s.type === 'info')).toBe(true)
    expect(lessonSteps(all[7], all, 'questions').every((s) => s.type === 'question')).toBe(true)
  })

  it('steps without data are skipped', () => {
    const bare: Aesthetic = { id: 'x', name: 'Bare', wiki: '', images: ['one'] }
    expect(lessonSteps(bare, all, 'full').map((s) => (s.type === 'info' ? s.card : s.question.kind))).toEqual(['intro', 'gallery', 'type-from-image'])
  })

  it('colour options have exactly one right list', () => {
    const q = lessonSteps(all[7], all, 'questions', seeded(2)).find((s) => s.type === 'question' && s.question.kind === 'pick-colours')
    const question = (q as { question: ChoiceQuestion }).question
    expect(question.choices.find((c) => c.key === question.answer)!.label).toBe(all[7].colours!.join(', '))
  })
})

describe('typed answers', () => {
  const a: Aesthetic = { id: 'v', name: 'Vector Música', aliases: ['Idol Pop Vector'], wiki: '', images: [] }

  it('ignores case, accents and punctuation, forgives small typos, accepts aliases', () => {
    expect(matchesName('vector musica', a)).toBe(true)
    expect(matchesName('Vektor Musica', a)).toBe(true)
    expect(matchesName('idol-pop vector', a)).toBe(true)
    expect(matchesName('Vector', a)).toBe(false)
    expect(matchesName('', a)).toBe(false)
  })

  it('short names must be exact', () => {
    expect(matchesName('8-bit', { id: 'b', name: '8-Bit', wiki: '', images: [] })).toBe(true)
    expect(matchesName('7-bit', { id: 'b', name: '8-Bit', wiki: '', images: [] })).toBe(false)
  })

  it('masks names and their distinctive words, not generic ones', () => {
    const memphis: Aesthetic = { id: 'm', name: 'Memphis Design', wiki: '', images: [] }
    expect(maskName('Memphis Design was a design group in Memphis.', memphis)).toBe(`${BLANK} was a design group in ${BLANK}.`)
  })
})
