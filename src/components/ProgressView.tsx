import { useMemo, useState } from 'react'
import { SIZE } from '../lib/images'
import { lessonPoints, lessonState, overallPercent, type LessonState } from '../lib/progress'
import type { Aesthetic, Progress } from '../types'
import { Photo } from './Photo'
import { StateBadge } from './StateBadge'

type Filter = 'all' | 'new' | 'seen' | 'learned' | 'mastered'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'seen', label: 'Seen' },
  { id: 'learned', label: 'Learned' },
  { id: 'mastered', label: 'Mastered' },
]

// "Ready to master" lessons are still learned.
const group = (s: LessonState): Filter => (s === 'ready' ? 'learned' : s)

interface Props {
  aesthetics: Aesthetic[]
  items: Progress
  now: number
  onLesson(a: Aesthetic): void
}

export function ProgressView({ aesthetics, items, now, onLesson }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const states = useMemo(() => new Map(aesthetics.map((a) => [a.id, lessonState(items[a.id], now)])), [aesthetics, items, now])
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: aesthetics.length, new: 0, seen: 0, learned: 0, mastered: 0 }
    for (const s of states.values()) c[group(s)]++
    return c
  }, [aesthetics.length, states])

  const pct = overallPercent(lessonPoints(items), aesthetics.length)
  const q = query.trim().toLowerCase()
  const shown = aesthetics.filter((a) => (filter === 'all' || group(states.get(a.id)!) === filter) && (!q || a.name.toLowerCase().includes(q)))

  return (
    <section className="page">
      <h1 className="title">Lessons</h1>
      <div className="bar bar-200" aria-hidden>
        <div className="bar-fill" style={{ width: `${Math.min(pct, 200) / 2}%` }} />
      </div>
      <p className="muted small">
        {pct}% · {counts.learned} learned · {counts.mastered} mastered. Tap an aesthetic to take its lesson.
      </p>

      <input className="input" type="search" placeholder="Search aesthetics" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="segmented segmented-tight" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
            {f.label} {f.id !== 'all' && <span className="count">{counts[f.id]}</span>}
          </button>
        ))}
      </div>

      <ul className="list">
        {shown.map((a) => (
          <li key={a.id} className="list-item">
            <button className="row" onClick={() => onLesson(a)}>
              <Photo src={a.images[0]} width={SIZE.small} alt="" lazy className="row-thumb" />
              <span className="row-main">
                <span className="row-name">{a.name}</span>
                {a.decade && <span className="muted small">{a.decade}</span>}
              </span>
              <StateBadge state={states.get(a.id)!} />
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="muted center empty">Nothing here.</li>}
      </ul>
    </section>
  )
}
