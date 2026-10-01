import { useCallback, useMemo, useState } from 'react'
import { SIZE } from '../lib/images'
import { LESSON_LABEL, MASTERY_WAIT, type LessonState } from '../lib/progress'
import { lessonSteps, rebuildLessonQuestion, type InfoCard, type LessonFormat, type LessonStep, type Question } from '../lib/questions'
import type { Aesthetic, Entry } from '../types'
import { Avatar } from './Avatar'
import { Photo } from './Photo'
import { QuestionView } from './QuestionView'
import { StateBadge } from './StateBadge'

interface Props {
  aesthetic: Aesthetic
  all: Aesthetic[]
  byId: Map<string, Aesthetic>
  entry: Entry | undefined
  state: LessonState
  /** Records a finished lesson run; returns the lesson state before and after. */
  onFinish(perfect: boolean): { before: LessonState; after: LessonState }
  onClose(): void
}

type Phase = { k: 'choose' } | { k: 'steps'; format: LessonFormat } | { k: 'done'; format: LessonFormat; perfect: boolean; before: LessonState; after: LessonState }

export function Lesson({ aesthetic: a, all, byId, entry, state, onFinish, onClose }: Props) {
  // The first time is always the full lesson; after that, info and questions are separate.
  const [phase, setPhase] = useState<Phase>(state === 'new' ? { k: 'steps', format: 'full' } : { k: 'choose' })

  return (
    <div className="lesson-screen">
      <div className="lesson-top">
        <button className="icon-btn" onClick={onClose} aria-label="Close lesson">
          ✕
        </button>
        <span className="lesson-title">{a.name}</span>
      </div>

      {phase.k === 'choose' && <Choose a={a} entry={entry} state={state} onPick={(format) => setPhase({ k: 'steps', format })} />}
      {phase.k === 'steps' && (
        <Steps
          key={phase.format}
          a={a}
          all={all}
          byId={byId}
          format={phase.format}
          onDone={(perfect) => {
            const change = phase.format === 'info' ? { before: state, after: state } : onFinish(perfect)
            setPhase({ k: 'done', format: phase.format, perfect, ...change })
          }}
        />
      )}
      {phase.k === 'done' && <Done a={a} {...phase} onAgain={() => setPhase({ k: 'choose' })} onClose={onClose} />}
    </div>
  )
}

function Choose({ a, entry, state, onPick }: { a: Aesthetic; entry: Entry | undefined; state: LessonState; onPick(f: LessonFormat): void }) {
  const masterOn = entry?.la !== undefined ? new Date(entry.la + MASTERY_WAIT) : null
  return (
    <section className="page">
      <Photo src={a.images[0]} width={SIZE.large} alt={a.name} className="lesson-hero" />
      <div className="lesson-status">
        <StateBadge state={state} />
        <p className="muted small">
          {state === 'seen' && 'Answer every question right in one go to learn it.'}
          {state === 'learned' && masterOn && `Learned. Get every question right again from ${masterOn.toLocaleDateString()} to master it.`}
          {state === 'ready' && 'It’s been a month: answer every question right now to master it.'}
          {state === 'mastered' && 'Mastered for good. Review it any time.'}
        </p>
      </div>
      <button className="btn btn-primary btn-big" onClick={() => onPick('questions')}>
        Questions only
      </button>
      <button className="btn btn-secondary btn-big" onClick={() => onPick('info')}>
        Info only
      </button>
    </section>
  )
}

interface QueueItem {
  step: LessonStep
  retry: boolean
}

function Steps({ a, all, byId, format, onDone }: { a: Aesthetic; all: Aesthetic[]; byId: Map<string, Aesthetic>; format: LessonFormat; onDone(perfect: boolean): void }) {
  const initial = useMemo(() => lessonSteps(a, all, format), [a, all, format])
  const [queue, setQueue] = useState<QueueItem[]>(() => initial.map((step) => ({ step, retry: false })))
  const [index, setIndex] = useState(0)
  const [mistakes, setMistakes] = useState(0)

  const current = queue[index]
  const total = queue.length

  const next = useCallback(() => {
    if (index + 1 >= queue.length) onDone(mistakes === 0)
    else {
      setIndex(index + 1)
      window.scrollTo({ top: 0 })
    }
  }, [index, queue.length, mistakes, onDone])

  const answer = (q: Question, correct: boolean) => {
    if (correct) return
    setMistakes((m) => m + 1)
    // Missed questions come back at the end until they're right.
    const again: QueueItem = { step: { type: 'question', question: rebuildLessonQuestion(q, all) }, retry: true }
    setQueue((items) => [...items, again])
  }

  if (!current) return null

  return (
    <section className="page lesson">
      <div className="bar bar-thin" aria-hidden>
        <div className="bar-fill" style={{ width: `${(index / total) * 100}%` }} />
      </div>
      {current.retry && <p className="eyebrow">Try this one again</p>}
      {current.step.type === 'info' ? (
        <>
          <InfoView card={current.step.card} a={a} byId={byId} />
          <button className="btn btn-primary btn-big" onClick={next}>
            {index + 1 >= total ? 'Finish' : 'Continue'}
          </button>
        </>
      ) : (
        <QuestionView
          key={index}
          question={current.step.question}
          onAnswer={(correct) => answer((current.step as { question: Question }).question, correct)}
          onNext={next}
          nextLabel="Continue"
        />
      )}
    </section>
  )
}

const cssColour = (name: string) => {
  const c = name.toLowerCase().replace(/\s+/g, '')
  return typeof CSS !== 'undefined' && CSS.supports('color', c) ? c : null
}

function InfoView({ card, a, byId }: { card: InfoCard; a: Aesthetic; byId: Map<string, Aesthetic> }) {
  switch (card) {
    case 'intro':
      return (
        <div className="info-card">
          <Photo src={a.images[0]} width={SIZE.large} alt={a.name} className="lesson-hero" />
          <h1 className="title">{a.name}</h1>
          {(a.decade || a.aliases?.length) && (
            <p className="muted small">
              {a.decade}
              {a.decade && a.aliases?.length ? ' · ' : ''}
              {a.aliases?.length ? `Also called ${a.aliases.slice(0, 3).join(', ')}` : ''}
            </p>
          )}
          {a.intro?.split('\n\n').map((p, i) => (
            <p key={i} className="info-text">
              {p}
            </p>
          ))}
        </div>
      )
    case 'gallery':
      return (
        <div className="info-card">
          <h2 className="info-heading">What {a.name} looks like</h2>
          <div className="gallery gallery-2">
            {a.images.map((src) => (
              <Photo key={src} src={src} width={SIZE.medium} alt={a.name} lazy />
            ))}
          </div>
        </div>
      )
    case 'look':
      return (
        <div className="info-card">
          {a.motifs?.length ? (
            <>
              <h2 className="info-heading">Key motifs</h2>
              <ul className="fact-list">
                {a.motifs.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          ) : null}
          {a.colours?.length ? (
            <>
              <h2 className="info-heading">Key colours</h2>
              <ul className="chips">
                {a.colours.map((c) => {
                  const swatch = cssColour(c)
                  return (
                    <li key={c} className="chip colour-chip">
                      {swatch && <span className="swatch" style={{ background: swatch }} />}
                      {c}
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </div>
      )
    case 'facts':
      return (
        <div className="info-card">
          <dl className="clues">
            {a.decade && (
              <div>
                <dt>Emerged</dt>
                <dd>{a.decade}</dd>
              </div>
            )}
            {a.origin && (
              <div>
                <dt>Origin</dt>
                <dd>{a.origin}</dd>
              </div>
            )}
          </dl>
          {a.values?.length ? (
            <>
              <h2 className="info-heading">Key values</h2>
              <ul className="chips">
                {a.values.map((v) => (
                  <li key={v} className="chip">
                    {v}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      )
    case 'related': {
      const byName = new Map([...byId.values()].map((x) => [x.name.toLowerCase(), x]))
      return (
        <div className="info-card">
          <h2 className="info-heading">Related aesthetics</h2>
          <p className="muted small">Similar styles worth telling apart from {a.name}.</p>
          <ul className="related-list">
            {a.related!.map((r) => {
              const match = byName.get(r.toLowerCase())
              return (
                <li key={r}>
                  {match ? <Avatar aesthetic={match} nickname={r} size={36} /> : <span className="avatar avatar-letter" style={{ width: 36, height: 36 }}>{r[0]}</span>}
                  <span>{r}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )
    }
  }
}

function Done({ a, format, perfect, before, after, onAgain, onClose }: { a: Aesthetic; format: LessonFormat; perfect: boolean; before: LessonState; after: LessonState; onAgain(): void; onClose(): void }) {
  const changed = before !== after
  let headline = 'Lesson complete'
  let text = ''
  if (format === 'info') {
    headline = 'All caught up'
    text = `You’ve reviewed everything about ${a.name}.`
  } else if (after === 'mastered' && changed) {
    headline = 'Mastered!'
    text = `${a.name} is mastered for good. It now counts double toward your total.`
  } else if (after === 'learned' && changed) {
    headline = 'Learned!'
    text = `Every question right. Come back in a month and do it perfectly again to master it.`
  } else if (before === 'learned' && after === 'seen') {
    headline = 'Back to seen'
    text = `A mistake dropped ${a.name} back to seen. Get everything right in one go to learn it again.`
  } else if (perfect) {
    text = after === 'mastered' ? `${a.name} stays mastered.` : `Every question right. ${a.name} stays ${LESSON_LABEL[after].toLowerCase()}.`
  } else {
    headline = changed ? 'Seen' : 'Lesson complete'
    text = `You finished, with some retries. Get every question right first time to learn ${a.name}.`
  }

  return (
    <section className="page lesson-done">
      <Avatar aesthetic={a} nickname={a.name} size={96} />
      <h1 className="title center">{headline}</h1>
      <StateBadge state={after} />
      <p className="muted center">{text}</p>
      <button className="btn btn-primary btn-big" onClick={onClose}>
        Done
      </button>
      <button className="btn btn-ghost" onClick={onAgain}>
        Go again
      </button>
    </section>
  )
}
