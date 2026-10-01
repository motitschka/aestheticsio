export interface Aesthetic {
  id: string
  name: string
  wiki: string
  /** Full-size Fandom image URLs; the first one is the page's main image. */
  images: string[]
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
}

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
}

export interface AppUser {
  uid: string
  email: string
  name: string
}
