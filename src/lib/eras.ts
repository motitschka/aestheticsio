import type { Aesthetic, Progress } from '../types'

/** The journey through time: eight broad eras, oldest first. */
export const ERAS = [
  { label: 'Before 1900', short: '<1900' },
  { label: '1900–1945', short: '1900' },
  { label: '1945–1970', short: '1945' },
  { label: 'The 1970s', short: '70s' },
  { label: 'The 1980s', short: '80s' },
  { label: 'The 1990s', short: '90s' },
  { label: 'The 2000s', short: '00s' },
  { label: 'The 2010s and now', short: '10s+' },
] as const

export type Era = number

/**
 * Aesthetics the wiki gives no usable decade, placed by hand from their pages
 * (and their boards). Only the era matters; the year orders them within it.
 */
const PLACED: Record<string, number> = {
  'dunhuang-feng': 400, // the 4th-century cave murals it draws on
  'shuimo-feng': 1000, // traditional ink-wash painting
  'french-provincial-style': 1650, // 17th–18th century
  'british-countryside': 1850, // Victorian visuals
  maximalism: 1850, // 19th century
  'coastal-style': 1900, // early 20th century
  nautical: 1930,
  'catholic-kitsch': 1950, // mid-20th-century devotional kitsch
  'monochrome-luxe': 1980, // the wiki says '80s
  'kid-science': 1990, // 1990s educational media
  'neo-chinese-style': 2000, // late 20th century to now, peaking in the 2000s
  genericana: 2005, // late 2000s to mid 2010s
  'yanqing-kitsch': 2010, // 2010s Chinese romance dramas
}

/** The decade that places an aesthetic on the journey. */
export const journeyYear = (a: Pick<Aesthetic, 'id' | 'year'>) => PLACED[a.id] ?? a.year ?? 2010

/** The era an aesthetic belongs to (the 1940s count as post-war). */
export function eraOf(a: Pick<Aesthetic, 'id' | 'year'>): Era {
  const y = journeyYear(a)
  if (y < 1900) return 0
  if (y < 1940) return 1
  if (y < 1970) return 2
  if (y < 1980) return 3
  if (y < 1990) return 4
  if (y < 2000) return 5
  if (y < 2010) return 6
  return 7
}

/** Every aesthetic in journey order: by year (so by era), then name. */
export function journeyOrder(all: readonly Aesthetic[]): Aesthetic[] {
  return [...all].sort((a, b) => journeyYear(a) - journeyYear(b) || a.name.localeCompare(b.name))
}

/** A lesson counts toward the journey once it's learned (or mastered). */
export const isLearned = (items: Progress, id: string) => (items[id]?.lt ?? 0) >= 2

export interface EraProgress {
  era: Era
  learned: number
  total: number
}

/** Learned lessons per era, oldest era first. */
export function eraProgress(all: readonly Aesthetic[], items: Progress): EraProgress[] {
  const out = ERAS.map((_, era) => ({ era, learned: 0, total: 0 }))
  for (const a of all) {
    const p = out[eraOf(a)]
    p.total++
    if (isLearned(items, a.id)) p.learned++
  }
  return out
}

/** Learned lessons per era as plain counts (what friends see on the leaderboard). */
export const eraCounts = (all: readonly Aesthetic[], items: Progress) => eraProgress(all, items).map((p) => p.learned)

/** The suggested next lesson: the first one not yet learned, walking the journey from the oldest era. */
export function nextOnJourney(all: readonly Aesthetic[], items: Progress): Aesthetic | null {
  return journeyOrder(all).find((a) => !isLearned(items, a.id)) ?? null
}

/** Eras that a change from `before` to `after` just finished. */
export function erasFinished(all: readonly Aesthetic[], before: Progress, after: Progress): Era[] {
  const b = eraProgress(all, before)
  return eraProgress(all, after)
    .filter((p, i) => p.total > 0 && p.learned === p.total && b[i].learned < b[i].total)
    .map((p) => p.era)
}
