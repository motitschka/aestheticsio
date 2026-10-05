import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SIZE } from '../lib/images'
import { timelineOrder, type ChoiceQuestion, type Question, type TimelineQuestion } from '../lib/questions'
import { shuffle } from '../lib/random'
import { BLANK } from '../lib/text'
import type { Aesthetic } from '../types'
import { Photo } from './Photo'

interface Props {
  question: Question
  /** Called once, when the question is answered. */
  onAnswer(correct: boolean): void
  onNext(): void
  /** After a right answer, move on by itself after this many ms. */
  autoAdvanceMs?: number
  nextLabel?: string
  /** Offer "Take the lesson" after a mistake. */
  onLesson?(a: Aesthetic): void
  /** Show a few more images of the right aesthetic after a mistake. */
  showMore?: boolean
  /** Number keys pick answers (desktop). Off while something else has focus. */
  keys?: boolean
  /**
   * Moves on without scoring. Offered when an image the question needs didn't
   * load: a missing picture must never cost a point, a streak or a lesson.
   */
  onSkip?(): void
}

interface Result {
  correct: boolean
  picked?: string
  order?: string[]
}

/** Text with the hidden name shown as a blank. */
export function Masked({ text }: { text: string }) {
  const parts = text.split(BLANK)
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <span className="blank" aria-label="hidden name" />}
        </span>
      ))}
    </>
  )
}

const name = (q: Question) => ('target' in q ? q.target.name : '')

function prompt(q: Question): ReactNode {
  switch (q.kind) {
    case 'image-to-name':
      return 'Which aesthetic is this?'
    case 'tell-apart':
      return 'Which of these related aesthetics is this?'
    case 'description-to-name':
      return 'Which aesthetic is this describing?'
    case 'clues-to-name':
      return 'Which aesthetic has these traits?'
    case 'name-to-image':
      return (
        <>
          Which one is <strong>{name(q)}?</strong>
        </>
      )
    case 'odd-one-out':
      return 'Three of these share an aesthetic. Which one doesn’t belong?'
    case 'pick-colours':
      return (
        <>
          Which are the key colours of <strong>{name(q)}?</strong>
        </>
      )
    case 'pick-motifs':
      return (
        <>
          Which motifs belong to <strong>{name(q)}?</strong>
        </>
      )
    case 'pick-decade':
      return (
        <>
          When did <strong>{name(q)}</strong> first appear?
        </>
      )
    case 'timeline':
      return 'Tap them in order, earliest first'
  }
}

export function QuestionView({ question: q, onAnswer, onNext, autoAdvanceMs = 900, nextLabel = 'Next', onLesson, showMore = false, keys = true, onSkip }: Props) {
  const [result, setResult] = useState<Result | null>(null)
  // An image the question needs didn't load: it can be skipped, and an answer doesn't count.
  const [broken, setBroken] = useState(false)
  const unscored = broken && !!onSkip
  const nextBtn = useRef<HTMLButtonElement>(null)
  const onImageFail = useCallback(() => setBroken(true), [])

  const finish = (r: Result) => {
    if (result) return
    setResult(r)
    if (!unscored) onAnswer(r.correct)
  }
  const proceed = unscored ? onSkip! : onNext

  useEffect(() => {
    if (!result) return
    if (result.correct && autoAdvanceMs > 0) {
      const t = window.setTimeout(proceed, autoAdvanceMs)
      return () => window.clearTimeout(t)
    }
    nextBtn.current?.focus({ preventScroll: true })
    nextBtn.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [result, autoAdvanceMs, proceed])

  const target = 'target' in q ? q.target : undefined
  const shown = 'image' in q ? q.image : undefined
  const more = useMemo(() => (target ? shuffle(target.images.filter((i) => i !== shown)).slice(0, 3) : []), [target, shown])

  return (
    <div className="question">
      <p className="prompt">{prompt(q)}</p>

      {q.kind === 'timeline' && <TimelineView q={q} result={result} onSubmit={(order) => finish({ correct: order.join() === timelineOrder(q).join(), order })} />}
      {'choices' in q && <ChoiceView q={q} result={result} keys={keys && !result} onPick={(key) => finish({ correct: key === q.answer, picked: key })} onImageFail={onImageFail} />}

      {unscored && !result && (
        <div className="notice notice-soft" role="status">
          <span>An image didn’t load, so this one won’t count.</span>
          <button className="btn btn-secondary btn-small" onClick={onSkip}>
            Skip it
          </button>
        </div>
      )}

      {result?.correct && autoAdvanceMs > 0 && (
        <p className="feedback feedback-right" role="status">
          <span className="mark" aria-hidden>
            ✓
          </span>{' '}
          Correct!
        </p>
      )}

      {result && (!result.correct || autoAdvanceMs === 0) && (
        <div className={`feedback-panel ${result.correct ? 'is-good' : ''}`}>
          <p className={`feedback ${result.correct ? 'feedback-right' : 'feedback-wrong'}`} role="status">
            <span className="mark" aria-hidden>
              {result.correct ? '✓' : '✗'}
            </span>{' '}
            {explain(q, result)}
            {unscored && <span className="muted"> This one doesn’t count: an image didn’t load.</span>}
          </p>
          {!result.correct && showMore && target && more.length > 0 && (
            <>
              <p className="muted small">More {target.name}:</p>
              <div className="more-images">
                {more.map((src) => (
                  <Photo key={src} src={src} width={SIZE.medium} alt={target.name} />
                ))}
              </div>
            </>
          )}
          {!result.correct && target && (
            <div className="feedback-links">
              {onLesson && (
                <button className="btn btn-secondary btn-small" onClick={() => onLesson(target)}>
                  Take the lesson on {target.name}
                </button>
              )}
              <a className="link" href={target.wiki} target="_blank" rel="noreferrer">
                Aesthetics Wiki ↗
              </a>
            </div>
          )}
          <button ref={nextBtn} className="btn btn-primary" onClick={proceed}>
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  )
}

function explain(q: Question, r: Result): ReactNode {
  if (r.correct) return 'Correct!'
  switch (q.kind) {
    case 'name-to-image':
      return (
        <>
          Not quite. <strong>{q.target.name}</strong> is the one marked ✓.
        </>
      )
    case 'odd-one-out':
      return (
        <>
          The odd one out was from <strong>{q.odd!.name}</strong>. The other three are <strong>{q.target.name}</strong>.
        </>
      )
    case 'pick-colours':
    case 'pick-motifs':
    case 'pick-decade':
      return 'Not quite. The right answer is marked ✓.'
    case 'timeline':
      return 'Not quite. Here’s the right order.'
    default: {
      const picked = q.choices.find((c) => c.key === r.picked)?.label
      return (
        <>
          Not quite. This is <strong>{q.target.name}</strong>
          {picked ? `, not ${picked}` : ''}.
        </>
      )
    }
  }
}

function ChoiceView({ q, result, keys, onPick, onImageFail }: { q: ChoiceQuestion; result: Result | null; keys: boolean; onPick(key: string): void; onImageFail(): void }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!keys) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // A round paused under a lesson is hidden and must not react.
      if (!root.current || root.current.offsetParent === null) return
      const n = Number(e.key)
      if (n >= 1 && n <= q.choices.length) onPick(q.choices[n - 1].key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keys, onPick, q.choices])

  const state = (key: string) => {
    if (!result) return ''
    if (key === q.answer) return 'is-right'
    if (key === result.picked) return 'is-wrong'
    return 'is-dim'
  }
  const images = q.choices.every((c) => c.image)

  return (
    <>
      {q.image && <Photo key={q.image} src={q.image} width={SIZE.large} alt="Mystery aesthetic" fit="contain" className="quiz-image" onFail={onImageFail} />}
      {q.text && (
        <blockquote className="description">
          <Masked text={q.text} />
        </blockquote>
      )}
      {q.clues && (
        <dl className="clues">
          {q.clues.map((c) => (
            <div key={c.label}>
              <dt>{c.label}</dt>
              <dd>
                <Masked text={c.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {images ? (
        <div className="image-choices" ref={root}>
          {q.choices.map((c, i) => (
            <button
              key={c.key}
              className={`image-choice ${state(c.key)}`}
              onClick={() => onPick(c.key)}
              disabled={!!result}
              aria-label={result ? `${c.aesthetic?.name ?? `Option ${i + 1}`}${mark(state(c.key))}` : `Option ${i + 1}`}
            >
              <Photo key={c.image} src={c.image!} width={SIZE.medium} alt={result ? (c.aesthetic?.name ?? '') : `Option ${i + 1}`} onFail={onImageFail} />
              {result && c.aesthetic && <span className="image-label">{c.aesthetic.name}</span>}
              <Mark state={state(c.key)} />
            </button>
          ))}
        </div>
      ) : (
        <div className="choices" ref={root}>
          {q.choices.map((c, i) => (
            <button key={c.key} className={`choice ${state(c.key)}`} onClick={() => onPick(c.key)} disabled={!!result}>
              <span className="choice-key">{i + 1}</span>
              <span>{c.label}</span>
              <Mark state={state(c.key)} />
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/** Right and wrong are marked with a sign as well as colour (not everyone tells red from green). */
function Mark({ state }: { state: string }) {
  if (state !== 'is-right' && state !== 'is-wrong') return null
  return (
    <span className="choice-mark" aria-hidden>
      {state === 'is-right' ? '✓' : '✗'}
    </span>
  )
}

const mark = (state: string) => (state === 'is-right' ? ', right answer' : state === 'is-wrong' ? ', your answer' : '')

function TimelineView({ q, result, onSubmit }: { q: TimelineQuestion; result: Result | null; onSubmit(order: string[]): void }) {
  const [order, setOrder] = useState<string[]>([])
  const correct = useMemo(() => timelineOrder(q), [q])
  const tap = (id: string) => {
    if (result) return
    const at = order.indexOf(id)
    setOrder(at >= 0 ? order.slice(0, at) : [...order, id].slice(0, q.items.length))
  }
  const items = result ? correct.map((id) => q.items.find((a) => a.id === id)!) : q.items

  return (
    <>
      <ol className="timeline">
        {items.map((a, i) => {
          const pos = order.indexOf(a.id)
          const state = result ? (order[i] === a.id ? 'is-right' : 'is-wrong') : pos >= 0 ? 'is-picked' : ''
          return (
            <li key={a.id}>
              <button className={`timeline-item ${state}`} onClick={() => tap(a.id)} disabled={!!result}>
                <span className="timeline-pos">{result ? i + 1 : pos >= 0 ? pos + 1 : ''}</span>
                <Photo src={a.images[0]} width={SIZE.small} alt="" className="timeline-thumb" />
                <span className="row-main">
                  <span className="row-name">{a.name}</span>
                  {result && <span className="muted small">{a.year}s</span>}
                </span>
                <Mark state={state} />
              </button>
            </li>
          )
        })}
      </ol>
      {!result && (
        <div className="timeline-actions">
          <button className="btn btn-ghost btn-small" onClick={() => setOrder([])} disabled={!order.length}>
            Clear
          </button>
          <button className="btn btn-primary" onClick={() => onSubmit(order)} disabled={order.length < q.items.length}>
            Check order
          </button>
        </div>
      )}
    </>
  )
}
