import { useEffect, useMemo, useState } from 'react'
import { ERAS, eraProgress } from '../lib/eras'
import { ago, formatTime } from '../lib/format'
import { accuracy, dayStreakNow, friendDayStreak, learnedCount, rankByLessons, rankByStreak } from '../lib/progress'
import type { Aesthetic, CircleEvent, Profile } from '../types'
import { Avatar } from './Avatar'
import { BadgeRow } from './Badges'
import { EraStrip } from './Journey'

interface Props {
  all: Aesthetic[]
  byId: Map<string, Aesthetic>
  me: string
  load(): Promise<Profile[]>
}

type Board = 'journey' | 'streak'

/** How many moments the circle feed shows */
const FEED = 8

export function Leaderboard({ all, byId, me, load }: Props) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [error, setError] = useState(false)
  const [board, setBoard] = useState<Board>('journey')
  const [now] = useState(Date.now)

  useEffect(() => {
    load().then(setProfiles, () => setError(true))
  }, [load])

  const totals = useMemo(() => eraProgress(all, {}).map((p) => p.total), [all])
  const ranked = profiles && (board === 'journey' ? rankByLessons(profiles) : rankByStreak(profiles))
  // Everyone's latest moments, newest first.
  const feed = useMemo(
    () =>
      (profiles ?? [])
        .flatMap((p) => (p.recent ?? []).map((e) => ({ p, e })))
        .sort((a, b) => b.e.t - a.e.t)
        .slice(0, FEED),
    [profiles],
  )

  return (
    <section className="page">
      <h1 className="title">Your circle</h1>
      {error && <p className="notice">Couldn't load the circle. Check your connection.</p>}
      {!profiles && !error && <p className="muted">Loading…</p>}

      {feed.length > 0 && (
        <div className="card circle-feed">
          <h2 className="section-title">Lately</h2>
          <ul className="feed">
            {feed.map(({ p, e }) => (
              <li key={`${p.uid}:${e.k}:${e.t}:${e.k === 'learned' ? e.id : e.e}`} className={e.k === 'era' ? 'is-era' : ''}>
                <Avatar aesthetic={byId.get(p.avatar)} nickname={p.nickname} size={28} />
                <span className="row-main">
                  <span>
                    <strong>{p.uid === me ? 'You' : p.nickname}</strong> {moment(e, byId)}
                  </span>
                  <span className="muted small">{ago(e.t, now)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={board === 'journey'} className={board === 'journey' ? 'on' : ''} onClick={() => setBoard('journey')}>
          Journey
        </button>
        <button role="tab" aria-selected={board === 'streak'} className={board === 'streak' ? 'on' : ''} onClick={() => setBoard('streak')}>
          Best streak
        </button>
      </div>
      <p className="muted small">
        {board === 'journey' ? `Lessons learned on the way through time, out of ${all.length}. Ties go to more mastered, then accuracy.` : 'Longest run in the Mixed challenge. Ties go to the fastest 25.'}
      </p>
      <ol className="list">
        {ranked?.map((p, i) => (
          <li key={p.uid} className={`list-item row ranked ${p.uid === me ? 'is-me' : ''}`}>
            <span className={`rank rank-${i + 1}`}>{i + 1}</span>
            <Avatar aesthetic={byId.get(p.avatar)} nickname={p.nickname} size={44} />
            <span className="row-main">
              <span className="row-name">
                {p.nickname}
                {p.uid === me && <span className="muted"> (you)</span>}
              </span>
              {board === 'journey' ? (
                <>
                  {p.eras ? <EraStrip learned={p.eras} totals={totals} /> : <span className="muted small">No journey yet</span>}
                  <span className="muted small">{journeyLine(p, now, p.uid === me)}</span>
                </>
              ) : (
                <>
                  <span className="muted small">{p.best25 !== undefined ? `25 in ${formatTime(p.best25)}` : 'No 25 yet'}</span>
                  <BadgeRow stats={p} />
                </>
              )}
            </span>
            <span className="score tabular">{board === 'journey' ? learnedCount(p) : p.bestStreak}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function moment(e: CircleEvent, byId: Map<string, Aesthetic>) {
  return e.k === 'era' ? (
    <>
      finished <strong>{ERAS[e.e]?.label ?? 'an era'}</strong>
    </>
  ) : (
    <>learned {byId.get(e.id)?.name ?? 'an aesthetic'}</>
  )
}

function journeyLine(p: Profile, now: number, mine: boolean) {
  const parts: string[] = []
  const streak = mine ? dayStreakNow(p, now) : friendDayStreak(p, now)
  if (streak) parts.push(`${streak}-day streak`)
  const mastered = p.eras ? p.lessonPoints - learnedCount(p) : 0
  if (mastered > 0) parts.push(`${mastered} mastered`)
  if (p.answered) parts.push(`${Math.round(accuracy(p) * 100)}% practice accuracy`)
  return parts.join(' · ') || 'Just starting'
}

export function LeaderboardSignIn({ onSignIn, error }: { onSignIn(): void; error: string | null }) {
  return (
    <section className="page">
      <h1 className="title">Your circle</h1>
      <div className="card">
        <h2>Sign in to join your circle</h2>
        <p className="muted small">
          The circle is for invited friends: see how far everyone is on the journey and what they just learned. Sign in with
          Google to sync your progress. Your guest progress comes with you.
        </p>
        <button className="btn btn-primary" onClick={onSignIn}>
          Sign in with Google
        </button>
        {error && <p className="notice">{error}</p>}
      </div>
    </section>
  )
}
