import { useCallback, useState } from 'react'
import { MODE_INFO, type Question } from '../lib/questions'
import type { Aesthetic, PracticeMode } from '../types'
import { PinDeco } from './Moodboard'
import { QuestionView } from './QuestionView'

interface Answer {
  question: Question
  correct: boolean
  recognisedNow: boolean
}

interface Props {
  mode: PracticeMode
  questions: Question[]
  /** Records an answer; returns whether the aesthetic just became recognised in this mode. */
  onAnswer(q: Question, correct: boolean): boolean
  onLesson(a: Aesthetic): void
  /** Text for this mode's score, e.g. "12/174 recognised" */
  score: string
  onAgain(): void
  onExit(): void
}

export function PracticeRound({ mode, questions, onAnswer, onLesson, score, onAgain, onExit }: Props) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [done, setDone] = useState(false)

  const next = useCallback(() => {
    if (index + 1 >= questions.length) setDone(true)
    else {
      setIndex(index + 1)
      window.scrollTo({ top: 0 })
    }
  }, [index, questions.length])

  if (done) return <Results mode={mode} answers={answers} score={score} onLesson={onLesson} onAgain={onAgain} onExit={onExit} />

  const q = questions[index]
  return (
    <section className="page quiz">
      <div className="quiz-top">
        <button className="icon-btn" onClick={() => (answers.length ? setDone(true) : onExit())} aria-label="End round">
          ✕
        </button>
        <div className="bar bar-thin" aria-hidden>
          <div className="bar-fill" style={{ width: `${(answers.length / questions.length) * 100}%` }} />
        </div>
        <span className="muted small tabular">
          {index + 1}/{questions.length}
        </span>
      </div>
      <QuestionView
        key={index}
        question={q}
        onAnswer={(correct) => {
          const recognisedNow = onAnswer(q, correct)
          setAnswers((a) => [...a, { question: q, correct, recognisedNow }])
        }}
        onNext={next}
        nextLabel={index + 1 >= questions.length ? 'See results' : 'Next'}
        onLesson={onLesson}
        showMore
      />
    </section>
  )
}

function Results({ mode, answers, score, onLesson, onAgain, onExit }: { mode: PracticeMode; answers: Answer[]; score: string; onLesson(a: Aesthetic): void; onAgain(): void; onExit(): void }) {
  const right = answers.filter((a) => a.correct).length
  const recognised = answers.filter((a) => a.recognisedNow && 'target' in a.question).map((a) => (a.question as { target: Aesthetic }).target)
  const missed = [...new Map(answers.filter((a) => !a.correct && 'target' in a.question).map((a) => {
    const t = (a.question as { target: Aesthetic }).target
    return [t.id, t] as const
  })).values()]

  return (
    <section className="page results">
      <div className="results-hero">
        <div>
          <p className="eyebrow">{MODE_INFO[mode].title}</p>
          <h1 className="display">
            {right}
            <span className="display-of"> / {answers.length}</span>
          </h1>
          <p className="muted">{mode === 'timeline' ? 'orderings right' : 'correct'}</p>
        </div>
        <PinDeco n={3} />
      </div>

      {recognised.length > 0 && (
        <div className="card">
          <h2>Now recognised</h2>
          <ul className="chips">
            {recognised.map((a) => (
              <li key={a.id} className="chip chip-good">
                {a.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {missed.length > 0 && (
        <div className="card">
          <h2>Take a lesson on these</h2>
          <ul className="chips">
            {missed.map((a) => (
              <li key={a.id}>
                <button className="chip chip-button" onClick={() => onLesson(a)}>
                  {a.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card stat-row">
        <div>
          <strong className="tabular">{score}</strong>
          <span className="muted small">{MODE_INFO[mode].title}</span>
        </div>
      </div>

      <button className="btn btn-primary btn-big" onClick={onAgain}>
        Another round
      </button>
      <button className="btn btn-ghost" onClick={onExit}>
        Done
      </button>
    </section>
  )
}
