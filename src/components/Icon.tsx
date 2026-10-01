import { useId, type ReactNode } from 'react'
import { useTheme } from '../lib/theme-context'
import type { IconStyle } from '../lib/theme'

export type IconName = 'play' | 'lessons' | 'ranks' | 'me' | 'lock'

// Outline drawings (24 × 24, stroked).
const LINE: Record<IconName, ReactNode> = {
  play: <path d="M8 5.5v13l11-6.5z" />,
  lessons: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />,
  ranks: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
  me: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />,
  lock: <path d="M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3" />,
}

// Solid silhouettes (filled).
const SOLID: Record<IconName, string> = {
  play: 'M7 4.2v15.6a1 1 0 0 0 1.5.86l13-7.8a1 1 0 0 0 0-1.72l-13-7.8A1 1 0 0 0 7 4.2z',
  lessons: 'M6.5 2H20a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5a1.5 1.5 0 0 0 0 3H20a1 1 0 0 1 0 2H6.5A3.5 3.5 0 0 1 3 20.5v-15A3.5 3.5 0 0 1 6.5 2z',
  ranks:
    'M6 3h12v2h2.5a1 1 0 0 1 1 1.1A5 5 0 0 1 17 10.9 6 6 0 0 1 13 15v3h3a1 1 0 0 1 1 1v2H7v-2a1 1 0 0 1 1-1h3v-3a6 6 0 0 1-4-4.1A5 5 0 0 1 2.5 6.1 1 1 0 0 1 3.5 5H6zm0 4H4.7A3 3 0 0 0 6.4 8.9 6 6 0 0 1 6 7zm12 0a6 6 0 0 1-.4 1.9A3 3 0 0 0 19.3 7z',
  me: 'M12 2.5a4.75 4.75 0 1 1 0 9.5 4.75 4.75 0 0 1 0-9.5zM3 21.5a9 8.5 0 0 1 18 0 .5.5 0 0 1-.5.5h-17a.5.5 0 0 1-.5-.5z',
  lock: 'M8 10V8a4 4 0 0 1 8 0v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h4V8a2 2 0 0 0-4 0z',
}

// 12 × 12 bitmaps for the pixel style.
const PIXELS: Record<IconName, string[]> = {
  play: ['............', '...#........', '...##.......', '...###......', '...####.....', '...#####....', '...######...', '...#####....', '...####.....', '...###......', '...##.......', '...#........'],
  lessons: ['............', '..########..', '.#.#######..', '.#.#....##..', '.#.#######..', '.#.#######..', '.#.#######..', '.#.#######..', '.#.#######..', '.#.########.', '.##.........', '..#########.'],
  ranks: ['............', '..########..', '#.########.#', '#.########.#', '.#.######.#.', '...######...', '....####....', '.....##.....', '.....##.....', '....####....', '...######...', '............'],
  me: ['............', '....####....', '...######...', '...######...', '...######...', '....####....', '............', '..########..', '.##########.', '.##########.', '.##########.', '............'],
  lock: ['............', '....####....', '...#....#...', '...#....#...', '..########..', '..########..', '..###..###..', '..###..###..', '..########..', '..########..', '............', '............'],
}

// Built from primitive shapes in three colours (Bauhaus, Memphis).
function geometric(name: IconName): ReactNode {
  const a = 'var(--accent)'
  const g = 'var(--gold)'
  const t = 'currentColor'
  switch (name) {
    case 'play':
      return (
        <>
          <circle cx="16" cy="8" r="4" fill={g} />
          <path d="M5 4v16l13-8z" fill={a} />
        </>
      )
    case 'lessons':
      return (
        <>
          <rect x="7" y="2.5" width="12" height="15" fill={g} />
          <rect x="4" y="6" width="12" height="15.5" fill={a} />
        </>
      )
    case 'ranks':
      return (
        <>
          <rect x="2.5" y="13" width="6" height="8.5" fill={g} />
          <rect x="9" y="5" width="6" height="16.5" fill={a} />
          <rect x="15.5" y="10" width="6" height="11.5" fill={t} />
        </>
      )
    case 'me':
      return (
        <>
          <circle cx="12" cy="7.5" r="4.5" fill={a} />
          <path d="M3.5 21.5a8.5 8.5 0 0 1 17 0z" fill={g} />
        </>
      )
    case 'lock':
      return (
        <>
          <path d="M8 10V8a4 4 0 0 1 8 0v2" fill="none" stroke={t} strokeWidth="2.4" />
          <rect x="5" y="10" width="14" height="11" fill={a} />
          <circle cx="12" cy="15.5" r="2" fill={g} />
        </>
      )
  }
}

/** One of the app's icons, drawn in the current theme's icon style. */
export function Icon({ name, size = 24, style: forced }: { name: IconName; size?: number; style?: IconStyle }) {
  const theme = useTheme()
  const style = forced ?? theme?.icons ?? 'line'
  const gradient = useId()
  const svg = (children: ReactNode, extra: Record<string, string | number> = {}) => (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={`icon icon-${style}`} {...extra}>
      {children}
    </svg>
  )
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (style) {
    case 'bold':
      return svg(<path d={SOLID[name]} fill="currentColor" fillRule="evenodd" />)
    case 'duotone':
      return svg(
        <>
          <path d={SOLID[name]} fill="var(--accent-soft)" fillRule="evenodd" />
          <g {...stroke}>{LINE[name]}</g>
        </>,
      )
    case 'bubbly':
      return svg(
        <>
          <path d={SOLID[name]} fill="currentColor" fillRule="evenodd" />
          <ellipse cx="9" cy="7" rx="3.2" ry="1.6" fill="#fff" opacity="0.55" transform="rotate(-25 9 7)" />
        </>,
      )
    case 'chrome':
      return svg(
        <>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.45" stopColor="#c9d1dc" />
              <stop offset="0.55" stopColor="#7d8794" />
              <stop offset="1" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
          <path d={SOLID[name]} fill={`url(#${gradient})`} stroke="currentColor" strokeWidth="0.8" fillRule="evenodd" />
        </>,
      )
    case 'neon':
      return svg(<g {...stroke}>{LINE[name]}</g>)
    case 'ornate':
      return svg(
        <>
          <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="0.9" />
          <circle cx="12" cy="12" r="9.3" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <g transform="translate(4.8 4.8) scale(0.6)" {...stroke} strokeWidth={2.6}>
            {LINE[name]}
          </g>
        </>,
      )
    case 'hand':
      return svg(
        <>
          <g {...stroke} strokeWidth={2.3} transform="rotate(-3 12 12)">
            {LINE[name]}
          </g>
          <g {...stroke} strokeWidth={1.2} opacity={0.45} transform="translate(0.7 0.6) rotate(2 12 12)">
            {LINE[name]}
          </g>
        </>,
      )
    case 'pixel':
      return svg(
        <g fill="currentColor">
          {PIXELS[name].flatMap((row, y) => [...row].map((c, x) => (c === '#' ? <rect key={`${x}-${y}`} x={x * 2} y={y * 2} width="2" height="2" /> : null)))}
        </g>,
        { shapeRendering: 'crispEdges' },
      )
    case 'geometric':
      return svg(geometric(name))
    default:
      return svg(<g {...stroke}>{LINE[name]}</g>)
  }
}
