import { useMemo, useState } from 'react'
import { ERAS, eraOf, eraProgress, journeyOrder } from '../lib/eras'
import { SIZE } from '../lib/images'
import { lessonState } from '../lib/progress'
import type { Aesthetic, Progress } from '../types'
import { EraStrip } from './Journey'
import { Moodboard } from './Moodboard'
import { Photo } from './Photo'
import { StateBadge } from './StateBadge'

type Filter = 'all' | 'new' | 'seen' | 'ready' | 'learned' | 'mastered'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'seen', label: 'Seen' },
  { id: 'ready', label: 'To master' },
  { id: 'learned', label: 'Learned' },
  { id: 'mastered', label: 'Mastered' },
]

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
    const c: Record<Filter, number> = { all: aesthetics.length, new: 0, seen: 0, ready: 0, learned: 0, mastered: 0 }
    for (const s of states.values()) c[s as Filter]++
    return c
  }, [aesthetics.length, states])
  const eras = useMemo(() => eraProgress(aesthetics, items), [aesthetics, items])
  const ordered = useMemo(() => journeyOrder(aesthetics), [aesthetics])

  const q = query.trim().toLowerCase()
  const shown = ordered.filter((a) => (filter === 'all' || states.get(a.id) === filter) && (!q || a.name.toLowerCase().includes(q)))
  const learned = eras.reduce((n, e) => n + e.learned, 0)

  return (
    <section className="page">
      <Moodboard from={4} />
      <h1 className="title">Lessons</h1>
      <EraStrip learned={eras.map((e) => e.learned)} totals={eras.map((e) => e.total)} labels />
      <p className="muted small">
        {learned} of {aesthetics.length} learned{counts.mastered ? ` · ${counts.mastered} mastered` : ''}. The journey runs through eight eras,
        oldest first; tap any aesthetic to take its lesson.
      </p>

      <input className="input" type="search" placeholder="Search aesthetics" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="segmented segmented-tight" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
            {f.label} {f.id !== 'all' && <span className="count">{counts[f.id]}</span>}
          </button>
        ))}
      </div>

      {ERAS.map((era, i) => {
        const inEra = shown.filter((a) => eraOf(a) === i)
        if (!inEra.length) return null
        const p = eras[i]
        return (
          <section key={era.short} className="era-group" aria-label={era.label}>
            <h2 className="era-heading">
              <span>{era.label}</span>
              <span className={`small tabular ${p.learned === p.total ? 'era-done' : 'muted'}`}>
                {p.learned === p.total ? 'Done · ' : ''}
                {p.learned}/{p.total}
              </span>
            </h2>
            <ul className="list">
              {inEra.map((a) => (
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
            </ul>
          </section>
        )
      })}
      {shown.length === 0 && <p className="muted center empty">Nothing here.</p>}
    </section>
  )
}
