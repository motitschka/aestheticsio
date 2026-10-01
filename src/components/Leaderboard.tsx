import { useEffect, useState } from 'react'
import { formatTime } from '../lib/format'
import { accuracy, overallPercent, rankByLessons, rankByStreak } from '../lib/progress'
import type { Aesthetic, Profile } from '../types'
import { Avatar } from './Avatar'
import { BadgeRow } from './Badges'

interface Props {
  byId: Map<string, Aesthetic>
  total: number
  me: string
  load(): Promise<Profile[]>
}

type Board = 'lessons' | 'streak'

export function Leaderboard({ byId, total, me, load }: Props) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [error, setError] = useState(false)
  const [board, setBoard] = useState<Board>('lessons')

  useEffect(() => {
    load().then(setProfiles, () => setError(true))
  }, [load])

  const ranked = profiles && (board === 'lessons' ? rankByLessons(profiles) : rankByStreak(profiles))

  return (
    <section className="page">
      <h1 className="title">Leaderboard</h1>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={board === 'lessons'} className={board === 'lessons' ? 'on' : ''} onClick={() => setBoard('lessons')}>
          Lessons %
        </button>
        <button role="tab" aria-selected={board === 'streak'} className={board === 'streak' ? 'on' : ''} onClick={() => setBoard('streak')}>
          Best streak
        </button>
      </div>
      <p className="muted small">
        {board === 'lessons' ? 'Learned lessons count once, mastered twice. Ties go to better accuracy.' : 'Longest run in the Mixed challenge. Ties go to the fastest 25.'}
      </p>
      {error && <p className="notice">Couldn't load the leaderboard. Check your connection.</p>}
      {!profiles && !error && <p className="muted">Loading…</p>}
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
              <span className="muted small">
                {board === 'lessons'
                  ? p.answered
                    ? `${Math.round(accuracy(p) * 100)}% practice accuracy`
                    : 'No practice yet'
                  : p.best25 !== undefined
                    ? `25 in ${formatTime(p.best25)}`
                    : 'No 25 yet'}
              </span>
              <BadgeRow stats={p} />
            </span>
            <span className="score tabular">{board === 'lessons' ? `${overallPercent(p.lessonPoints, total)}%` : p.bestStreak}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function LeaderboardSignIn({ onSignIn, error }: { onSignIn(): void; error: string | null }) {
  return (
    <section className="page">
      <h1 className="title">Leaderboard</h1>
      <div className="card">
        <h2>Sign in to compete with friends</h2>
        <p className="muted small">
          The leaderboard is for invited friends. Sign in with Google to sync your progress and see how you rank. Your
          guest progress comes with you.
        </p>
        <button className="btn btn-primary" onClick={onSignIn}>
          Sign in with Google
        </button>
        {error && <p className="notice">{error}</p>}
      </div>
    </section>
  )
}
