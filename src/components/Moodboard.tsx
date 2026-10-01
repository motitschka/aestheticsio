import { useTheme } from '../lib/theme-context'
import { pinUrl } from '../lib/theme'

/**
 * A strip of the theme's Pinterest pins at the top of a screen. Its shape
 * (polaroids, arches, windows, circles…) follows the theme's layout family in CSS.
 * Purely decorative; nothing to read sits on it.
 */
export function Moodboard({ from }: { from: number }) {
  const theme = useTheme()
  if (!theme) return null
  return (
    <div className="moodboard" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="moodboard-pin">
          <img src={pinUrl(theme, from + i)} alt="" loading="lazy" decoding="async" />
        </span>
      ))}
    </div>
  )
}

/** One framed pin used as decoration beside content (never behind text). */
export function PinDeco({ n }: { n: number }) {
  const theme = useTheme()
  if (!theme) return null
  return (
    <span className="pin-deco" aria-hidden>
      <img src={pinUrl(theme, n)} alt="" loading="lazy" decoding="async" />
    </span>
  )
}
