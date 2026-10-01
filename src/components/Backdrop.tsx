import { memo } from 'react'
import { thumb } from '../lib/images'
import type { Aesthetic } from '../types'

// Enough tiles to cover a large desktop screen; phones only show the first ten or so.
const TILES = 48
const ROTATIONS = [-5, 3, -2, 6, -4, 2, 5, -3, 1, -6, 4, -1]

/** A collage of the theme's own images behind the whole app. */
export const Backdrop = memo(function Backdrop({ aesthetic }: { aesthetic: Aesthetic }) {
  const images = aesthetic.images
  return (
    <div className="backdrop" aria-hidden>
      <div className="backdrop-grid">
        {Array.from({ length: TILES }, (_, i) => (
          <div key={i} className="backdrop-tile" style={{ transform: `rotate(${ROTATIONS[i % ROTATIONS.length]}deg) scale(1.18)` }}>
            <img src={thumb(images[(i * 7) % images.length], 400)} alt="" loading="lazy" decoding="async" />
          </div>
        ))}
      </div>
    </div>
  )
})
