import { useState } from 'react'
import { themeUnlocked, type Theme, type Themes } from '../lib/theme'
import type { Aesthetic, Progress } from '../types'

export function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <span className="theme-preview" style={{ background: theme.colours.bg }}>
      <span className="theme-preview-bar" style={{ background: theme.colours.accent }} />
      <span className="theme-swatches">
        {theme.swatches.map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
      </span>
    </span>
  )
}

interface Props {
  themes: Themes | null
  aesthetics: Aesthetic[]
  items: Progress
  current: string
  onPick(id: string): void
  onLesson(a: Aesthetic): void
}

export function ThemePicker({ themes, aesthetics, items, current, onPick, onLesson }: Props) {
  const [showAll, setShowAll] = useState(false)
  if (!themes) return null

  const withTheme = aesthetics.filter((a) => themes[a.id])
  const unlocked = withTheme.filter((a) => themeUnlocked(items[a.id]))
  const shown = showAll ? [...unlocked, ...withTheme.filter((a) => !themeUnlocked(items[a.id]))] : unlocked

  return (
    <div className="card">
      <h2>Themes</h2>
      <p className="muted small">
        Learn an aesthetic’s lesson to unlock its theme: its colours, type and a collage of its images, across the whole app.{' '}
        {unlocked.length} of {withTheme.length} unlocked.
      </p>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={!showAll} className={!showAll ? 'on' : ''} onClick={() => setShowAll(false)}>
          Unlocked <span className="count">{unlocked.length}</span>
        </button>
        <button role="tab" aria-selected={showAll} className={showAll ? 'on' : ''} onClick={() => setShowAll(true)}>
          All <span className="count">{withTheme.length}</span>
        </button>
      </div>
      <div className="theme-grid">
        <button className={`theme-tile ${current === '' ? 'on' : ''}`} onClick={() => onPick('')} aria-pressed={current === ''}>
          <span className="theme-preview" style={{ background: '#f5f1ea' }}>
            <span className="theme-preview-bar" style={{ background: '#5b3fd9' }} />
            <span className="theme-swatches">
              {['#5b3fd9', '#e6e0fb', '#1c1a18', '#ece6dc'].map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </span>
          </span>
          <span className="theme-name">Default</span>
        </button>
        {shown.map((a) => {
          const open = themeUnlocked(items[a.id])
          return (
            <button
              key={a.id}
              className={`theme-tile ${current === a.id ? 'on' : ''} ${open ? '' : 'is-locked'}`}
              onClick={() => (open ? onPick(a.id) : onLesson(a))}
              aria-pressed={current === a.id}
              title={open ? `Use the ${a.name} theme` : `Learn the ${a.name} lesson to unlock`}
            >
              <span style={{ position: 'relative' }}>
                <ThemePreview theme={themes[a.id]} />
                {!open && (
                  <span className="theme-lock" aria-hidden>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  </span>
                )}
              </span>
              <span className="theme-name">{a.name}</span>
            </button>
          )
        })}
      </div>
      {unlocked.length === 0 && !showAll && <p className="muted small">No themes yet. Get every question right in a lesson to unlock your first.</p>}
    </div>
  )
}
