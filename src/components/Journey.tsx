import { DAILY_GOAL, dayStreakNow, freezesNeeded, lessonsToday, MAX_FREEZES } from '../lib/progress'
import { ERAS } from '../lib/eras'
import type { PlayerStats } from '../types'

/** How far through each era: one segment per era, oldest first. */
export function EraStrip({ learned, totals, labels = false }: { learned: number[]; totals: number[]; labels?: boolean }) {
  return (
    <div className={`era-strip ${labels ? 'with-labels' : ''}`} role="img" aria-label={ERAS.map((e, i) => `${e.label}: ${learned[i] ?? 0} of ${totals[i]}`).join(', ')}>
      {ERAS.map((e, i) => {
        const done = totals[i] > 0 && (learned[i] ?? 0) >= totals[i]
        return (
          <span key={e.short} className={`era-seg ${done ? 'is-done' : ''}`}>
            <span className="era-track">
              <span className="era-fill" style={{ width: `${totals[i] ? ((learned[i] ?? 0) / totals[i]) * 100 : 0}%` }} />
            </span>
            {labels && <span className="era-label">{e.short}</span>}
          </span>
        )
      })}
    </div>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Today's goal, the day streak and banked freezes. */
export function DailyGoal({ stats, now }: { stats: PlayerStats; now: number }) {
  const done = lessonsToday(stats, now)
  const met = done >= DAILY_GOAL
  const streak = dayStreakNow(stats, now)
  const freezes = stats.freezes ?? 0
  const covering = met ? 0 : freezesNeeded(stats, now)

  let note: string
  if (!met && covering > 0 && streak > 0) note = `${covering === 1 ? 'A freeze covers' : `${covering} freezes cover`} the missed ${covering === 1 ? 'day' : 'days'} when you do today’s lesson.`
  else if (!met) note = streak > 0 ? 'Do a lesson today to keep your streak going.' : 'One lesson a day starts a streak.'
  else if (done < DAILY_GOAL * 2 && freezes < MAX_FREEZES) note = 'Done for today. One more lesson banks a freeze for a day you miss.'
  else note = 'Done for today.'

  return (
    <div className={`card daily-goal ${met ? 'is-met' : ''}`}>
      <div className="daily-head">
        <span className="daily-count tabular" aria-label={`${done} of ${DAILY_GOAL} lessons today`}>
          {met ? '✓' : `${done}/${DAILY_GOAL}`}
        </span>
        <span className="row-main">
          <strong>{met ? 'Today’s lesson done' : 'Today: one lesson'}</strong>
          <span className="muted small">{note}</span>
        </span>
      </div>
      <div className="daily-stats small">
        <span>
          <strong className="tabular">{streak}</strong> day streak
        </span>
        <span>
          <strong className="tabular">{freezes}</strong> {freezes === 1 ? 'freeze' : 'freezes'} banked
        </span>
        {(stats.bestDayStreak ?? 0) > streak && <span className="muted">best {plural(stats.bestDayStreak!, 'day')}</span>}
      </div>
    </div>
  )
}

/** Shown once after the reset to the journey through time. */
export function JourneyNote({ onDismiss }: { onDismiss(): void }) {
  return (
    <div className="card journey-note">
      <p className="eyebrow">New</p>
      <h2>A journey through time</h2>
      <p className="small">
        Lessons now walk through eight eras, from before 1900 to now, and each one checks that you can tell an aesthetic from its close
        relatives. Everyone in the circle starts the journey fresh (your old progress is saved). One lesson a day keeps your streak.
      </p>
      <button className="btn btn-secondary btn-small" onClick={onDismiss}>
        Let’s go
      </button>
    </div>
  )
}
