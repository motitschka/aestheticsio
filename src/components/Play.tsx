import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { preload, SIZE } from '../lib/images'
import { buildRound, shuffle, statsOf, statusOf, type ModeSetting, type Question } from '../lib/quiz'
import type { Aesthetic, Progress } from '../types'
import { Photo } from './Photo'

interface Answer {
  target: Aesthetic
  correct: boolean
  learnedNow: boolean
}

interface Props {
  aesthetics: Aesthetic[]
  progress: Progress
  mode: ModeSetting
  /** undefined for guests */
  nickname?: string
  /** Records an answer; returns whether it just became learned. */
  onAnswer(aestheticId: string, correct: boolean): boolean
  /** undefined for guests, who aren't on the leaderboard */
  loadRank?(): Promise<{ rank: number; total: number } | null>
  onRoundActive(active: boolean): void
}

const MODE_LABEL: Record<ModeSetting, string> = {
  mixed: 'Mixed questions',
  'image-to-name': 'Image → name',
  'name-to-image': 'Name → image',
}

export function Play({ aesthetics, progress, mode, nickname, onAnswer, loadRank, onRoundActive }: Props) {
  const [round, setRound] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Answer[] | null>(null)

  const start = () => {
    const questions = buildRound(aesthetics, progress, mode)
    preload([questions[0].image, ...questions[0].options.map((o) => o.image)], SIZE.medium)
    setAnswers(null)
    setRound(questions)
    onRoundActive(true)
  }

  const finish = (result: Answer[] | null) => {
    setRound(null)
    setAnswers(result)
    onRoundActive(false)
  }

  if (round) return <QuizView questions={round} onAnswer={onAnswer} onFinish={finish} />
  if (answers) return <Results answers={answers} progress={progress} total={aesthetics.length} loadRank={loadRank} onAgain={start} onDone={() => setAnswers(null)} />

  const stats = statsOf(progress)
  const learning = aesthetics.filter((a) => statusOf(progress[a.id]) === 'learning').length
  const pct = (stats.learned / aesthetics.length) * 100

  return (
    <section className="page start">
      <p className="eyebrow">{nickname ? `Hi ${nickname}` : 'Welcome'}</p>
      <h1 className="display">
        {stats.learned}
        <span className="display-of"> / {aesthetics.length}</span>
      </h1>
      <p className="muted">design aesthetics learned</p>
      <div className="bar" aria-hidden>
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="muted small">
        {learning} in progress · {aesthetics.length - stats.learned - learning} not seen yet
      </p>
      <button className="btn btn-primary btn-big" onClick={start}>
        {stats.answered ? 'Start a round' : 'Start your first round'}
      </button>
      <p className="muted small center">
        10 questions · {MODE_LABEL[mode]} · an aesthetic is learned after 3 right in a row
      </p>
    </section>
  )
}

function QuizView({ questions, onAnswer, onFinish }: { questions: Question[]; onAnswer: Props['onAnswer']; onFinish(a: Answer[] | null): void }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const timer = useRef<number | undefined>(undefined)
  const nextBtn = useRef<HTMLButtonElement>(null)

  const q = questions[index]
  const answered = picked !== null
  const correct = picked === q.target.id

  const pickedName = q.options.find((o) => o.aesthetic.id === picked)?.aesthetic.name
  const more = useMemo(() => shuffle(q.target.images.filter((i) => i !== q.image)).slice(0, 3), [q])

  useEffect(() => {
    const next = questions[index + 1]
    if (next) preload([next.image, ...next.options.map((o) => o.image)], next.mode === 'image-to-name' ? SIZE.large : SIZE.medium)
  }, [questions, index])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const next = useCallback(() => {
    window.clearTimeout(timer.current)
    if (index + 1 >= questions.length) {
      onFinish(answers)
    } else {
      setIndex(index + 1)
      setPicked(null)
      window.scrollTo({ top: 0 })
    }
  }, [answers, index, onFinish, questions.length])

  const pick = useCallback(
    (id: string) => {
      if (picked !== null) return
      const isRight = id === q.target.id
      const learnedNow = onAnswer(q.target.id, isRight)
      setPicked(id)
      setAnswers((a) => [...a, { target: q.target, correct: isRight, learnedNow }])
    },
    [onAnswer, picked, q],
  )

  // Correct answers move on by themselves; wrong ones wait for "Next".
  useEffect(() => {
    if (!answered) return
    if (correct) {
      timer.current = window.setTimeout(next, 900)
      return () => window.clearTimeout(timer.current)
    }
    nextBtn.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [answered, correct, next])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= q.options.length) pick(q.options[n - 1].aesthetic.id)
      else if (e.key === 'Enter' && answered) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answered, next, pick, q.options])

  const optionState = (id: string) => {
    if (!answered) return ''
    if (id === q.target.id) return 'is-right'
    if (id === picked) return 'is-wrong'
    return 'is-dim'
  }

  return (
    <section className="page quiz">
      <div className="quiz-top">
        <button className="icon-btn" onClick={() => onFinish(answers.length ? answers : null)} aria-label="End round">
          ✕
        </button>
        <div className="bar bar-thin" aria-hidden>
          <div className="bar-fill" style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
        </div>
        <span className="muted small tabular">
          {index + 1}/{questions.length}
        </span>
      </div>

      {q.mode === 'image-to-name' ? (
        <>
          <p className="prompt">Which aesthetic is this?</p>
          <Photo key={q.image} src={q.image} width={SIZE.large} alt="Mystery aesthetic" fit="contain" className="quiz-image" />
          <div className="choices">
            {q.options.map((o, i) => (
              <button key={o.aesthetic.id} className={`choice ${optionState(o.aesthetic.id)}`} onClick={() => pick(o.aesthetic.id)} disabled={answered}>
                <span className="choice-key">{i + 1}</span>
                {o.aesthetic.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="prompt">
            Which one is <strong>{q.target.name}?</strong>
          </p>
          <div className="image-choices">
            {q.options.map((o, i) => (
              <button key={o.aesthetic.id} className={`image-choice ${optionState(o.aesthetic.id)}`} onClick={() => pick(o.aesthetic.id)} disabled={answered} aria-label={`Option ${i + 1}`}>
                <Photo key={o.image} src={o.image} width={SIZE.medium} alt={answered ? o.aesthetic.name : `Option ${i + 1}`} />
                {answered && <span className="image-label">{o.aesthetic.name}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {answered && correct && <p className="feedback feedback-right">Correct!</p>}

      {answered && !correct && (
        <div className="feedback-panel">
          <p className="feedback feedback-wrong">
            {q.mode === 'image-to-name' ? (
              <>
                Not quite. This is <strong>{q.target.name}</strong>, not {pickedName}.
              </>
            ) : (
              <>
                Not quite. You picked {pickedName}; <strong>{q.target.name}</strong> is highlighted in green.
              </>
            )}
          </p>
          {more.length > 0 && (
            <>
              <p className="muted small">More {q.target.name}:</p>
              <div className="more-images">
                {more.map((src) => (
                  <Photo key={src} src={src} width={SIZE.medium} alt={q.target.name} />
                ))}
              </div>
            </>
          )}
          <a className="link" href={q.target.wiki} target="_blank" rel="noreferrer">
            Read about {q.target.name} on the Aesthetics Wiki ↗
          </a>
          <button ref={nextBtn} className="btn btn-primary" onClick={next}>
            {index + 1 >= questions.length ? 'See results' : 'Next'}
          </button>
        </div>
      )}
    </section>
  )
}

function Results({ answers, progress, total, loadRank, onAgain, onDone }: {
  answers: Answer[]
  progress: Progress
  total: number
  loadRank: Props['loadRank']
  onAgain(): void
  onDone(): void
}) {
  const [rank, setRank] = useState<{ rank: number; total: number } | null>(null)
  useEffect(() => {
    loadRank?.().then(setRank, () => setRank(null))
  }, [loadRank])

  const right = answers.filter((a) => a.correct).length
  const learned = answers.filter((a) => a.learnedNow)
  const missed = answers.filter((a) => !a.correct)
  const stats = statsOf(progress)

  return (
    <section className="page results">
      <p className="eyebrow">Round done</p>
      <h1 className="display">
        {right}
        <span className="display-of"> / {answers.length}</span>
      </h1>
      <p className="muted">correct</p>

      {learned.length > 0 && (
        <div className="card">
          <h2>Newly learned</h2>
          <ul className="chips">
            {learned.map((a) => (
              <li key={a.target.id} className="chip chip-good">
                {a.target.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {missed.length > 0 && (
        <div className="card">
          <h2>Look at these again</h2>
          <ul className="chips">
            {missed.map((a) => (
              <li key={a.target.id}>
                <a className="chip" href={a.target.wiki} target="_blank" rel="noreferrer">
                  {a.target.name} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card stat-row">
        <div>
          <strong className="tabular">
            {stats.learned}/{total}
          </strong>
          <span className="muted small">learned overall</span>
        </div>
        {loadRank && (
          <div>
            <strong className="tabular">{rank ? `#${rank.rank}` : '–'}</strong>
            <span className="muted small">{rank ? `of ${rank.total} on the leaderboard` : 'leaderboard rank'}</span>
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-big" onClick={onAgain}>
        Play another round
      </button>
      <button className="btn btn-ghost" onClick={onDone}>
        Done
      </button>
    </section>
  )
}
