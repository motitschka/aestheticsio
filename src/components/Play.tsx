import { useMemo, useState } from 'react'
import { ERAS, eraOf, eraProgress, nextOnJourney } from '../lib/eras'
import { formatTime } from '../lib/format'
import { lessonState, MILESTONES, recognised, type Milestone } from '../lib/progress'
import { buildRound, eligible, MODE_INFO, PRACTICE_MODES, type Question } from '../lib/questions'
import type { Aesthetic, PracticeMode, SavedProgress } from '../types'
import { Avatar } from './Avatar'
import { BadgeRow } from './Badges'
import { Challenge, type ChallengeOutcome } from './Challenge'
import { DailyGoal, EraStrip, JourneyNote } from './Journey'
import { Moodboard, PinDeco } from './Moodboard'
import { PracticeRound } from './PracticeRound'
import { StateBadge } from './StateBadge'

interface Props {
  all: Aesthetic[]
  byId: Map<string, Aesthetic>
  saved: SavedProgress
  now: number
  /** undefined for guests */
  nickname?: string
  /** Records a practice answer; returns whether the aesthetic just became recognised in that mode. */
  onPractice(mode: PracticeMode, q: Question, correct: boolean): boolean
  onChallengeEnd(streak: number, splits: Partial<Record<Milestone, number>>): ChallengeOutcome
  onLesson(a: Aesthetic): void
  /** undefined for guests, who aren't on the leaderboard */
  loadStreakRank?(): Promise<{ rank: number; total: number } | null>
  onRoundActive(active: boolean): void
  /** Dismisses the one-time card about the journey through time. */
  onDismissNote(): void
}

type View = { k: 'hub' } | { k: 'round'; mode: PracticeMode; questions: Question[]; n: number } | { k: 'challenge'; target?: Milestone; n: number }

export function Play({ all, byId, saved, now, nickname, onPractice, onChallengeEnd, onLesson, loadStreakRank, onRoundActive, onDismissNote }: Props) {
  const [view, setView] = useState<View>({ k: 'hub' })

  const scores = useMemo(() => {
    const out = {} as Record<PracticeMode, { done: number; of: number; label: string }>
    for (const mode of PRACTICE_MODES) {
      if (mode === 'timeline') {
        const { timelineRight: r, timelineTotal: t } = saved.stats
        out[mode] = { done: r, of: t, label: t ? `${r}/${t} right` : 'Not played yet' }
      } else {
        const pool = all.filter((a) => eligible(mode, a, byId))
        const done = pool.filter((a) => recognised(saved.items[a.id], mode)).length
        out[mode] = { done, of: pool.length, label: `${done}/${pool.length} recognised` }
      }
    }
    return out
  }, [all, byId, saved])

  // The next lesson walks the journey from the oldest era; once all are learned, ones ready to master.
  const nextLesson = useMemo(
    () => nextOnJourney(all, saved.items) ?? all.find((a) => lessonState(saved.items[a.id], now) === 'ready') ?? null,
    [all, saved, now],
  )
  const eras = useMemo(() => eraProgress(all, saved.items), [all, saved])

  const start = (mode: PracticeMode) => {
    const questions = buildRound(mode, all, byId, saved.items)
    setView((v) => ({ k: 'round', mode, questions, n: v.k === 'round' ? v.n + 1 : 0 }))
    onRoundActive(true)
  }
  const startChallenge = (target?: Milestone) => {
    setView((v) => ({ k: 'challenge', target, n: v.k === 'challenge' ? v.n + 1 : 0 }))
    onRoundActive(true)
  }
  const exit = () => {
    setView({ k: 'hub' })
    onRoundActive(false)
    window.scrollTo({ top: 0 })
  }

  if (view.k === 'round') {
    return (
      <PracticeRound
        key={view.n}
        mode={view.mode}
        questions={view.questions}
        onAnswer={(q, correct) => onPractice(view.mode, q, correct)}
        onLesson={onLesson}
        score={scores[view.mode].label}
        onAgain={() => start(view.mode)}
        onExit={exit}
      />
    )
  }
  if (view.k === 'challenge') {
    return (
      <Challenge
        key={view.n}
        all={all}
        byId={byId}
        target={view.target}
        onEnd={onChallengeEnd}
        onLesson={onLesson}
        loadRank={view.target ? undefined : loadStreakRank}
        onAgain={() => startChallenge(view.target)}
        onExit={exit}
      />
    )
  }

  const learned = eras.reduce((n, e) => n + e.learned, 0)
  const mastered = all.filter((a) => lessonState(saved.items[a.id], now) === 'mastered').length
  const { stats } = saved
  const nextEra = nextLesson ? eraOf(nextLesson) : null

  return (
    <section className="page start">
      <Moodboard from={1} />
      <p className="eyebrow">{nickname ? `Hi ${nickname}` : 'Welcome'}</p>
      <h1 className="display">
        {learned}
        <span className="display-of">/{all.length}</span>
      </h1>
      <EraStrip learned={eras.map((e) => e.learned)} totals={eras.map((e) => e.total)} labels />
      <p className="muted small">
        {learned === all.length
          ? `Every aesthetic learned: the journey is done.${mastered < all.length ? ' Mastering them is the next lap.' : ''}`
          : `${learned} learned${mastered ? ` · ${mastered} mastered` : ''}. Learn all ${all.length}, from before 1900 to now, to finish the journey.`}
      </p>

      {stats.journeyNote === 1 && <JourneyNote onDismiss={onDismissNote} />}

      <DailyGoal stats={stats} now={now} />

      {nextLesson && (
        <button className="card next-lesson" onClick={() => onLesson(nextLesson)}>
          <Avatar aesthetic={nextLesson} nickname={nextLesson.name} size={56} />
          <span className="row-main">
            <span className="muted small">{nextEra !== null && learned < all.length ? `Next on the journey · ${ERAS[nextEra].label}` : 'Ready to master'}</span>
            <span className="row-name">{nextLesson.name}</span>
          </span>
          <StateBadge state={lessonState(saved.items[nextLesson.id], now)} />
        </button>
      )}

      <div className="card challenge-card has-pin">
        <PinDeco n={5} />
        <div className="challenge-head">
          <h2>Mixed challenge</h2>
          <p className="muted small">Every question type, against the clock. One wrong answer ends the run.</p>
          <p className="small">
            Best: <strong>{stats.bestStreak}</strong> in a row
          </p>
          <BadgeRow stats={stats} />
        </div>
        <button className="btn btn-primary" onClick={() => startChallenge()}>
          Endless run
        </button>
        <div className="sprint-row">
          {MILESTONES.map((m) => {
            const best = stats[`best${m}`]
            return (
              <button key={m} className="btn btn-secondary sprint-btn" onClick={() => startChallenge(m)} aria-label={`${m} in a row`}>
                <strong>{m}</strong>
                <small>{best !== undefined ? `best ${formatTime(best)}` : 'in a row'}</small>
              </button>
            )
          })}
        </div>
      </div>

      <h2 className="section-title">Practice</h2>
      <ul className="mode-list">
        {PRACTICE_MODES.map((mode) => {
          const s = scores[mode]
          return (
            <li key={mode}>
              <button className="mode-row" onClick={() => start(mode)}>
                <span className="row-main">
                  <span className="row-name">{MODE_INFO[mode].title}</span>
                  <span className="muted small">{MODE_INFO[mode].blurb}</span>
                </span>
                <span className="mode-score">
                  <span className="small tabular">{s.label}</span>
                  {s.of > 0 && (
                    <span className="bar bar-mini" aria-hidden>
                      <span className="bar-fill" style={{ width: `${(s.done / s.of) * 100}%` }} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="muted small center">An aesthetic counts as recognised in a mode after 3 right in a row there.</p>
    </section>
  )
}
