import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { SIZE } from '../lib/images'
import { timelineOrder, type ChoiceQuestion, type Question, type TimelineQuestion, type TypeQuestion } from '../lib/questions'
import { shuffle } from '../lib/random'
import { BLANK, matchesName } from '../lib/text'
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
}

interface Result {
  correct: boolean
  picked?: string
  typed?: string
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
    case 'type-from-image':
      return 'Type the name of this aesthetic'
    case 'type-from-description':
      return 'Type the name of the aesthetic described here'
    case 'timeline':
      return 'Tap them in order, earliest first'
  }
}

export function QuestionView({ question: q, onAnswer, onNext, autoAdvanceMs = 900, nextLabel = 'Next', onLesson, showMore = false, keys = true }: Props) {
  const [result, setResult] = useState<Result | null>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)

  const finish = (r: Result) => {
    if (result) return
    setResult(r)
    onAnswer(r.correct)
  }

  useEffect(() => {
    if (!result) return
    if (result.correct && autoAdvanceMs > 0) {
      const t = window.setTimeout(onNext, autoAdvanceMs)
      return () => window.clearTimeout(t)
    }
    nextBtn.current?.focus({ preventScroll: true })
    nextBtn.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [result, autoAdvanceMs, onNext])

  const target = 'target' in q ? q.target : undefined
  const shown = 'image' in q ? q.image : undefined
  const more = useMemo(() => (target ? shuffle(target.images.filter((i) => i !== shown)).slice(0, 3) : []), [target, shown])

  return (
    <div className="question">
      <p className="prompt">{prompt(q)}</p>

      {(q.kind === 'type-from-image' || q.kind === 'type-from-description') && <TypeView q={q} result={result} onSubmit={(typed) => finish({ correct: matchesName(typed, q.target), typed })} />}
      {q.kind === 'timeline' && <TimelineView q={q} result={result} onSubmit={(order) => finish({ correct: order.join() === timelineOrder(q).join(), order })} />}
      {'choices' in q && <ChoiceView q={q} result={result} keys={keys && !result} onPick={(key) => finish({ correct: key === q.answer, picked: key })} />}

      {result?.correct && autoAdvanceMs > 0 && <p className="feedback feedback-right">Correct!</p>}

      {result && (!result.correct || autoAdvanceMs === 0) && (
        <div className={`feedback-panel ${result.correct ? 'is-good' : ''}`}>
          <p className={`feedback ${result.correct ? 'feedback-right' : 'feedback-wrong'}`}>{explain(q, result)}</p>
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
          <button ref={nextBtn} className="btn btn-primary" onClick={onNext}>
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
          Not quite. <strong>{q.target.name}</strong> is the one in green.
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
      return 'Not quite. The right answer is in green.'
    case 'type-from-image':
    case 'type-from-description':
      return (
        <>
          It’s <strong>{q.target.name}</strong>
          {r.typed ? <span className="muted">. You typed “{r.typed}”.</span> : '.'}
        </>
      )
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

function ChoiceView({ q, result, keys, onPick }: { q: ChoiceQuestion; result: Result | null; keys: boolean; onPick(key: string): void }) {
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
      {q.image && <Photo key={q.image} src={q.image} width={SIZE.large} alt="Mystery aesthetic" fit="contain" className="quiz-image" />}
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
            <button key={c.key} className={`image-choice ${state(c.key)}`} onClick={() => onPick(c.key)} disabled={!!result} aria-label={`Option ${i + 1}`}>
              <Photo key={c.image} src={c.image!} width={SIZE.medium} alt={result ? (c.aesthetic?.name ?? '') : `Option ${i + 1}`} />
              {result && c.aesthetic && <span className="image-label">{c.aesthetic.name}</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="choices" ref={root}>
          {q.choices.map((c, i) => (
            <button key={c.key} className={`choice ${state(c.key)}`} onClick={() => onPick(c.key)} disabled={!!result}>
              <span className="choice-key">{i + 1}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function TypeView({ q, result, onSubmit }: { q: TypeQuestion; result: Result | null; onSubmit(typed: string): void }) {
  const [typed, setTyped] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (typed.trim()) onSubmit(typed.trim())
  }
  return (
    <>
      {q.image && <Photo key={q.image} src={q.image} width={SIZE.large} alt="Mystery aesthetic" fit="contain" className="quiz-image" />}
      {q.text && (
        <blockquote className="description">
          <Masked text={q.text} />
        </blockquote>
      )}
      <form className={`type-form ${result ? (result.correct ? 'is-right' : 'is-wrong') : ''}`} onSubmit={submit}>
        <input
          className="input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Aesthetic name"
          disabled={!!result}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="Aesthetic name"
        />
        <button className="btn btn-primary" disabled={!!result || !typed.trim()}>
          Check
        </button>
      </form>
    </>
  )
}

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
