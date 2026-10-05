export interface Aesthetic {
  id: string
  name: string
  wiki: string
  /** Full-size Fandom image URLs; the first one is the page's main image. */
  images: string[]
  /** The published Pinterest pins (public/pins/<id>/), added when the themes load. Lessons check with these. */
  pins?: string[]
  // Facts from the wiki page; any of these can be missing.
  intro?: string
  aliases?: string[]
  /** As written on the wiki, e.g. "1910s–1930s" */
  decade?: string
  /** First decade mentioned in `decade`, e.g. 1910 */
  year?: number
  origin?: string
  motifs?: string[]
  colours?: string[]
  values?: string[]
  /** Related aesthetics' names (some aren't among the design aesthetics) */
  related?: string[]
  /** Ids of related aesthetics in this set, closest first */
  similar?: string[]
}

export interface AestheticsData {
  source: string
  license: string
  fetchedAt: string
  items: Aesthetic[]
}

/** Practice modes that track a per-aesthetic "recognised" score. */
export type ScoredMode = 'image-to-name' | 'name-to-image' | 'description-to-name' | 'clues-to-name' | 'tell-apart' | 'odd-one-out'
export type PracticeMode = ScoredMode | 'timeline'

/** Lesson tier: 1 seen, 2 learned, 3 mastered. */
export type Tier = 1 | 2 | 3

/** Progress on one aesthetic. Short keys keep the progress document small. */
export interface Entry {
  /** correct answers in a row, per practice mode */
  m?: Partial<Record<ScoredMode, number>>
  /** lesson tier */
  lt?: Tier
  /** when the lesson last became learned, ms since epoch */
  la?: number
  /** theme unlocked (stays unlocked even if the lesson drops back to seen) */
  u?: 1
  /** practice answers right / wrong */
  c: number
  w: number
  /** last practised, ms since epoch */
  t: number
}

export type Progress = Record<string, Entry>

/** Per-player numbers that aren't about one aesthetic. */
export interface PlayerStats {
  timelineRight: number
  timelineTotal: number
  /** Mixed challenge personal bests; times in ms */
  bestStreak: number
  best25?: number
  best50?: number
  best100?: number
  /** id of the chosen theme; '' for the default look */
  theme?: string
  /** Journey version. 2 = the journey through time; older progress was reset (a backup is kept). */
  v?: number
  /** 1 after the reset to the journey, until its welcome card is dismissed (then 0) */
  journeyNote?: 0 | 1
  // Daily goal: a lesson a day keeps the day streak going.
  /** The last day (YYYY-MM-DD, local time) the goal was met */
  goalDay?: string
  dayStreak?: number
  bestDayStreak?: number
  /** Streak freezes banked by doing twice the goal in a day (at most 2); each covers one missed day */
  freezes?: number
  /** Lessons finished on day d */
  today?: { d: string; n: number }
  /** The latest moments for the circle feed, newest first */
  recent?: CircleEvent[]
}

/** A moment friends see in the circle feed: a lesson learned, or an era finished. */
export type CircleEvent = { k: 'learned'; id: string; t: number } | { k: 'era'; e: number; t: number }

export interface SavedProgress {
  items: Progress
  stats: PlayerStats
}

/** What friends see on the leaderboard. */
export interface Profile {
  uid: string
  nickname: string
  /** id of the aesthetic used as avatar */
  avatar: string
  /** learned lessons count 1, mastered 2 */
  lessonPoints: number
  bestStreak: number
  best25?: number
  best50?: number
  best100?: number
  /** practice answers, for accuracy */
  correct: number
  answered: number
  /** Learned lessons per era, oldest first (see lib/eras) */
  eras?: number[]
  /** Day streak, as of goalDay */
  dayStreak?: number
  goalDay?: string
  freezes?: number
  recent?: CircleEvent[]
}

export interface AppUser {
  uid: string
  email: string
  name: string
}
