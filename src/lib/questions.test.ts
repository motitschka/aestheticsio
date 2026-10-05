import { describe, expect, it } from 'vitest'
import type { Aesthetic, Progress, ScoredMode } from '../types'
import { buildMixed, buildPractice, buildRound, buildTimeline, CHOICES, eligible, lessonSteps, pickTargets, rebuildLessonQuestion, ROUND_SIZE, timelineOrder, type ChoiceQuestion } from './questions'
import { BLANK, maskName } from './text'

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
  const withPins = all.map((a, i) => ({ ...a, pins: [`pin${i}-1`, `pin${i}-2`, `pin${i}-3`, `pin${i}-4`] }))

  it('full lessons alternate info and checks against close relatives', () => {
    const steps = lessonSteps(withPins[7], withPins, 'full', seeded())
    expect(steps.map((s) => (s.type === 'info' ? s.card : s.question.kind))).toEqual([
      'intro',
      'gallery',
      'name-to-image',
      'look',
      'pick-colours',
      'pick-motifs',
      'facts',
      'pick-decade',
      'related',
      'odd-one-out',
      'tell-apart',
    ])
  })

  it('later formats split info and questions', () => {
    expect(lessonSteps(withPins[7], withPins, 'info').every((s) => s.type === 'info')).toBe(true)
    expect(lessonSteps(withPins[7], withPins, 'questions').every((s) => s.type === 'question')).toBe(true)
  })

  it('checks use unseen images: pins, never the wiki photos the gallery showed', () => {
    for (let seed = 1; seed < 20; seed++) {
      for (const step of lessonSteps(withPins[7], withPins, 'questions', seeded(seed))) {
        if (step.type !== 'question' || !('choices' in step.question)) continue
        const q = step.question
        const images = [...q.choices.map((c) => c.image), q.image].filter(Boolean) as string[]
        expect(images.every((img) => img.startsWith('pin'))).toBe(true)
      }
    }
  })

  it('checks compare it with its close relatives', () => {
    const a = withPins[7]
    const family = new Set([a.id, ...a.similar!])
    for (let seed = 1; seed < 20; seed++) {
      for (const step of lessonSteps(a, withPins, 'questions', seeded(seed))) {
        if (step.type !== 'question' || !('lesson' in step.question) || !step.question.lesson) continue
        const q = step.question
        const shown = q.kind === 'odd-one-out' ? [q.odd!.id] : q.choices.map((c) => c.aesthetic!.id)
        expect(shown.every((id) => family.has(id))).toBe(true)
        expect(q.choices.filter((c) => c.key === q.answer)).toHaveLength(1)
      }
    }
  })

  it('"which is this?" is not always the lesson\'s own aesthetic', () => {
    const targets = new Set<string>()
    for (let seed = 1; seed < 40; seed++) {
      const step = lessonSteps(withPins[7], withPins, 'questions', seeded(seed)).find((s) => s.type === 'question' && s.question.kind === 'tell-apart')
      targets.add((step as { question: ChoiceQuestion }).question.answer)
    }
    expect(targets.has(withPins[7].id)).toBe(true)
    expect(targets.size).toBeGreaterThan(1)
  })

  it('a missed check is asked afresh', () => {
    const step = lessonSteps(withPins[7], withPins, 'questions', seeded(3)).find((s) => s.type === 'question' && s.question.kind === 'odd-one-out')
    const q = (step as { question: ChoiceQuestion }).question
    const again = rebuildLessonQuestion(q, withPins, seeded(9)) as ChoiceQuestion
    expect(again.kind).toBe('odd-one-out')
    expect(again.lesson).toEqual(q.lesson)
  })

  it('decade options are distinct and include the right one', () => {
    for (let seed = 1; seed < 20; seed++) {
      const step = lessonSteps(withPins[7], withPins, 'questions', seeded(seed)).find((s) => s.type === 'question' && s.question.kind === 'pick-decade')
      const q = (step as { question: ChoiceQuestion }).question
      expect(new Set(q.choices.map((c) => c.key)).size).toBe(CHOICES)
      expect(q.choices.map((c) => c.key)).toContain(String(withPins[7].year))
    }
  })

  it('steps without data are skipped', () => {
    const bare: Aesthetic = { id: 'x', name: 'Bare', wiki: '', images: ['one'] }
    expect(lessonSteps(bare, [...all, bare], 'full', seeded()).map((s) => (s.type === 'info' ? s.card : s.question.kind))).toEqual([
      'intro',
      'gallery',
      'name-to-image',
      'tell-apart',
    ])
  })

  it('colour options have exactly one right list', () => {
    const q = lessonSteps(withPins[7], withPins, 'questions', seeded(2)).find((s) => s.type === 'question' && s.question.kind === 'pick-colours')
    const question = (q as { question: ChoiceQuestion }).question
    expect(question.choices.find((c) => c.key === question.answer)!.label).toBe(withPins[7].colours!.join(', '))
  })
})

describe('masking', () => {
  it('masks names and their distinctive words, not generic ones', () => {
    const memphis: Aesthetic = { id: 'm', name: 'Memphis Design', wiki: '', images: [] }
    expect(maskName('Memphis Design was a design group in Memphis.', memphis)).toBe(`${BLANK} was a design group in ${BLANK}.`)
  })
})
