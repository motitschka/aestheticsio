/** 83_400 → "1:23" */
export const formatTime = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** How long ago, roughly: "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", then a date. */
export function ago(t: number, now: number) {
  const d = Math.max(0, now - t)
  if (d < MINUTE) return 'just now'
  if (d < HOUR) return `${Math.floor(d / MINUTE)} min ago`
  if (d < DAY) return `${Math.floor(d / HOUR)} h ago`
  if (d < 2 * DAY) return 'yesterday'
  if (d < 7 * DAY) return `${Math.floor(d / DAY)} days ago`
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
