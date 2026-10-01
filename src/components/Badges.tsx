import { BADGES, earnedBadges } from '../lib/progress'
import type { PlayerStats } from '../types'
import { formatTime } from '../lib/format'

/** A round badge: flame + number for streaks, bolt + number for speed. */
export function BadgeIcon({ id, earned, small = false }: { id: string; earned: boolean; small?: boolean }) {
  const speed = id.startsWith('fast')
  const n = id.replace(/\D/g, '')
  return (
    <span className={`badge-icon ${speed ? 'is-speed' : 'is-streak'} ${earned ? 'is-earned' : ''} ${small ? 'is-small' : ''}`} title={BADGES.find((b) => b.id === id)?.label}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
        {speed ? <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" /> : <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z" fill="currentColor" />}
      </svg>
      <span>{n}</span>
    </span>
  )
}

/** Earned badges in a compact row (leaderboard). */
export function BadgeRow({ stats }: { stats: Pick<PlayerStats, 'bestStreak' | 'best25' | 'best50' | 'best100'> }) {
  const earned = earnedBadges(stats)
  if (!earned.length) return null
  return (
    <span className="badge-row">
      {earned.map((id) => (
        <BadgeIcon key={id} id={id} earned small />
      ))}
    </span>
  )
}

/** All badges with locked/unlocked state and personal bests (Me tab). */
export function BadgeShelf({ stats }: { stats: PlayerStats }) {
  const earned = new Set(earnedBadges(stats))
  return (
    <div className="card">
      <h2>Achievements</h2>
      <div className="stat-row">
        <div>
          <strong className="tabular">{stats.bestStreak}</strong>
          <span className="muted small">best streak</span>
        </div>
        {([25, 50, 100] as const).map((m) => (
          <div key={m}>
            <strong className="tabular">{stats[`best${m}`] !== undefined ? formatTime(stats[`best${m}`]!) : '–'}</strong>
            <span className="muted small">fastest {m}</span>
          </div>
        ))}
      </div>
      <ul className="badge-list">
        {BADGES.map((b) => (
          <li key={b.id} className={earned.has(b.id) ? '' : 'is-locked'}>
            <BadgeIcon id={b.id} earned={earned.has(b.id)} />
            <span>
              <strong>{b.label}</strong>
              <span className="muted small">{b.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
