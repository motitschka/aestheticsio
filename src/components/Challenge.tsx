import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTime } from '../lib/format'
import { BADGES, MILESTONES, type Milestone } from '../lib/progress'
import { buildMixed, type Question } from '../lib/questions'
import type { Aesthetic } from '../types'
import { BadgeIcon } from './Badges'
import { QuestionView } from './QuestionView'

export interface ChallengeOutcome {
  records: string[]
  newBadges: string[]
}

interface Props {
  all: Aesthetic[]
  byId: Map<string, Aesthetic>
  /** Records the finished run. */
  onEnd(streak: number, splits: Partial<Record<Milestone, number>>): ChallengeOutcome
  onLesson(a: Aesthetic): void
  loadRank?(): Promise<{ rank: number; total: number } | null>
  onAgain(): void
  onExit(): void
}

const targetId = (q: Question) => ('target' in q ? q.target.id : q.items.map((a) => a.id).join())

/** A mixed question that avoids aesthetics from the last few questions. */
function freshQuestion(all: Aesthetic[], byId: Map<string, Aesthetic>, recent: string[]) {
  let q = buildMixed(all, byId)
  for (let i = 0; i < 5 && recent.includes(targetId(q)); i++) q = buildMixed(all, byId)
  return q
}

export function Challenge({ all, byId, onEnd, onLesson, loadRank, onAgain, onExit }: Props) {
  const [question, setQuestion] = useState<Question>(() => freshQuestion(all, byId, []))
  const recent = useRef<string[]>([])
  const [count, setCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [startedAt] = useState(() => performance.now())
  const [now, setNow] = useState(startedAt)
  const [splits, setSplits] = useState<Partial<Record<Milestone, number>>>({})
  const [end, setEnd] = useState<{ time: number; missed: Question; outcome: ChallengeOutcome } | null>(null)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    if (end) return
    const t = window.setInterval(() => setNow(performance.now()), 250)
    return () => window.clearInterval(t)
  }, [end])

  const answer = (correct: boolean) => {
    const elapsed = Math.round(performance.now() - startedAt)
    if (correct) {
      const s = streak + 1
      setStreak(s)
      if ((MILESTONES as readonly number[]).includes(s)) setSplits((x) => ({ ...x, [s]: elapsed }))
    } else {
      setEnd({ time: elapsed, missed: question, outcome: onEnd(streak, splits) })
    }
  }

  // Leaving mid-run still counts the streak so far: no mistake was made.
  const leave = () => {
    if (!end && streak > 0) onEnd(streak, splits)
    onExit()
  }

  const next = useCallback(() => {
    if (end) setShowResults(true)
    else {
      recent.current = [targetId(question), ...recent.current].slice(0, 20)
      setQuestion(freshQuestion(all, byId, recent.current))
      setCount((c) => c + 1)
      window.scrollTo({ top: 0 })
    }
  }, [end, question, all, byId])

  if (end && showResults) return <ChallengeResults streak={streak} time={end.time} splits={splits} missed={end.missed} outcome={end.outcome} onLesson={onLesson} loadRank={loadRank} onAgain={onAgain} onExit={onExit} />

  return (
    <section className="page quiz">
      <div className="quiz-top">
        <button className="icon-btn" onClick={leave} aria-label="Leave challenge">
          ✕
        </button>
        <span className="challenge-streak">
          <strong className="tabular">{streak}</strong> in a row
        </span>
        <span className="challenge-timer tabular">{formatTime((end?.time ?? now - startedAt) | 0)}</span>
      </div>
      <QuestionView key={count} question={question} onAnswer={answer} onNext={next} autoAdvanceMs={450} nextLabel="See results" />
    </section>
  )
}

function ChallengeResults({ streak, time, splits, missed, outcome, onLesson, loadRank, onAgain, onExit }: {
  streak: number
  time: number
  splits: Partial<Record<Milestone, number>>
  missed: Question
  outcome: ChallengeOutcome
  onLesson(a: Aesthetic): void
  loadRank?(): Promise<{ rank: number; total: number } | null>
  onAgain(): void
  onExit(): void
}) {
  const [rank, setRank] = useState<{ rank: number; total: number } | null>(null)
  useEffect(() => {
    loadRank?.().then(setRank, () => setRank(null))
  }, [loadRank])

  const badges = BADGES.filter((b) => outcome.newBadges.includes(b.id))
  const target = 'target' in missed ? missed.target : null

  return (
    <section className="page results">
      <p className="eyebrow">Mixed challenge</p>
      <h1 className="display">{streak}</h1>
      <p className="muted">in a row · {formatTime(time)}</p>

      {outcome.records.length > 0 && (
        <div className="card">
          <h2>New personal best</h2>
          <ul className="chips">
            {outcome.records.map((r) => (
              <li key={r} className="chip chip-good">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {badges.length > 0 && (
        <div className="card">
          <h2>Badges unlocked</h2>
          <ul className="badge-list">
            {badges.map((b) => (
              <li key={b.id}>
                <BadgeIcon id={b.id} earned />
                <span>
                  <strong>{b.label}</strong>
                  <span className="muted small">{b.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(loadRank || splits[25] !== undefined) && (
      <div className="card stat-row">
        {MILESTONES.filter((m) => splits[m] !== undefined).map((m) => (
          <div key={m}>
            <strong className="tabular">{formatTime(splits[m]!)}</strong>
            <span className="muted small">to {m} in a row</span>
          </div>
        ))}
        {loadRank && (
          <div>
            <strong className="tabular">{rank ? `#${rank.rank}` : '–'}</strong>
            <span className="muted small">{rank ? `of ${rank.total} for best streak` : 'streak rank'}</span>
          </div>
        )}
      </div>
      )}

      {target && (
        <button className="btn btn-secondary" onClick={() => onLesson(target)}>
          Take the lesson on {target.name}
        </button>
      )}
      <button className="btn btn-primary btn-big" onClick={onAgain}>
        Try again
      </button>
      <button className="btn btn-ghost" onClick={onExit}>
        Done
      </button>
    </section>
  )
}
