import { memo, type CSSProperties } from 'react'
import { pinUrl, type Theme } from '../lib/theme'

// Enough tiles to cover a large desktop screen; phones only show the first ten or so.
const TILES = 40
const ROTATIONS = [-5, 3, -2, 6, -4, 2, 5, -3, 1, -6, 4, -1]

/** The theme's Pinterest pins as a collage behind the whole app, under a veil and a pattern. */
export const Backdrop = memo(function Backdrop({ theme }: { theme: Theme }) {
  return (
    <div className="backdrop" aria-hidden>
      <div className="backdrop-grid">
        {Array.from({ length: TILES }, (_, i) => (
          <div key={i} className="backdrop-tile" style={{ '--tilt': `${ROTATIONS[i % ROTATIONS.length]}deg` } as CSSProperties}>
            <img src={pinUrl(theme, (i % theme.pins) + 1)} alt="" loading={i < 12 ? 'eager' : 'lazy'} decoding="async" />
          </div>
        ))}
      </div>
      <div className="backdrop-pattern" />
    </div>
  )
})
