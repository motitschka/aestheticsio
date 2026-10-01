import { useMemo, useState } from 'react'
import { SIZE } from '../lib/images'
import { LEARN_STREAK, statusOf, type Status } from '../lib/quiz'
import type { Aesthetic, Progress } from '../types'
import { Photo } from './Photo'

type Filter = 'all' | Status

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'learned', label: 'Learned' },
  { id: 'learning', label: 'Learning' },
  { id: 'new', label: 'New' },
]

export function ProgressView({ aesthetics, progress }: { aesthetics: Aesthetic[]; progress: Progress }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = { all: aesthetics.length, learned: 0, learning: 0, new: 0 }
    for (const a of aesthetics) c[statusOf(progress[a.id])]++
    return c
  }, [aesthetics, progress])

  const q = query.trim().toLowerCase()
  const shown = aesthetics.filter(
    (a) => (filter === 'all' || statusOf(progress[a.id]) === filter) && (!q || a.name.toLowerCase().includes(q)),
  )

  return (
    <section className="page">
      <h1 className="title">Progress</h1>
      <div className="bar" aria-hidden>
        <div className="bar-fill" style={{ width: `${(counts.learned / counts.all) * 100}%` }} />
      </div>
      <p className="muted small">
        {counts.learned} of {counts.all} learned
      </p>

      <input className="input" type="search" placeholder="Search aesthetics" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="segmented" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
            {f.label} <span className="count">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <ul className="list">
        {shown.map((a) => {
          const e = progress[a.id]
          const status = statusOf(e)
          const isOpen = open === a.id
          return (
            <li key={a.id} className="list-item">
              <button className="row" onClick={() => setOpen(isOpen ? null : a.id)} aria-expanded={isOpen}>
                <Photo src={a.images[0]} width={SIZE.small} alt="" lazy className="row-thumb" />
                <span className="row-main">
                  <span className="row-name">{a.name}</span>
                  <span className="muted small">
                    {status === 'new' ? 'Not seen yet' : `${e.c} right · ${e.w} wrong`}
                  </span>
                </span>
                {status === 'learned' ? (
                  <span className="badge badge-good">Learned</span>
                ) : (
                  <span className="dots" aria-label={`${e?.s ?? 0} of ${LEARN_STREAK} in a row`}>
                    {Array.from({ length: LEARN_STREAK }, (_, i) => (
                      <span key={i} className={i < (e?.s ?? 0) ? 'dot on' : 'dot'} />
                    ))}
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="row-detail">
                  <div className="gallery">
                    {a.images.map((src) => (
                      <Photo key={src} src={src} width={SIZE.medium} alt={a.name} lazy />
                    ))}
                  </div>
                  <a className="link" href={a.wiki} target="_blank" rel="noreferrer">
                    Read about {a.name} on the Aesthetics Wiki ↗
                  </a>
                </div>
              )}
            </li>
          )
        })}
        {shown.length === 0 && <li className="muted center empty">Nothing here.</li>}
      </ul>
    </section>
  )
}
