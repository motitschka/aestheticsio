import { useEffect, useState } from 'react'
import { accuracy, rankProfiles } from '../lib/quiz'
import type { Aesthetic, Profile } from '../types'
import { Avatar } from './Avatar'

interface Props {
  byId: Map<string, Aesthetic>
  total: number
  me: string
  load(): Promise<Profile[]>
}

export function Leaderboard({ byId, total, me, load }: Props) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    load().then((p) => setProfiles(rankProfiles(p)), () => setError(true))
  }, [load])

  return (
    <section className="page">
      <h1 className="title">Leaderboard</h1>
      <p className="muted small">Ranked by aesthetics learned. Ties go to better accuracy.</p>
      {error && <p className="notice">Couldn't load the leaderboard. Check your connection.</p>}
      {!profiles && !error && <p className="muted">Loading…</p>}
      <ol className="list">
        {profiles?.map((p, i) => (
          <li key={p.uid} className={`list-item row ranked ${p.uid === me ? 'is-me' : ''}`}>
            <span className={`rank rank-${i + 1}`}>{i + 1}</span>
            <Avatar aesthetic={byId.get(p.avatar)} nickname={p.nickname} size={44} />
            <span className="row-main">
              <span className="row-name">
                {p.nickname}
                {p.uid === me && <span className="muted"> (you)</span>}
              </span>
              <span className="muted small">
                {p.answered ? `${Math.round(accuracy(p) * 100)}% accuracy` : 'No answers yet'}
              </span>
            </span>
            <span className="score tabular">
              {p.learned}
              <span className="muted small">/{total}</span>
            </span>
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
