export interface Aesthetic {
  id: string
  name: string
  wiki: string
  /** Full-size Fandom image URLs; the first one is the page's main image. */
  images: string[]
}

export interface AestheticsData {
  source: string
  license: string
  fetchedAt: string
  items: Aesthetic[]
}

/** Progress on one aesthetic. Short keys keep the progress document small. */
export interface Entry {
  /** correct answers in a row */
  s: number
  /** learned (reached LEARN_STREAK and not missed since) */
  l: boolean
  /** total correct */
  c: number
  /** total wrong */
  w: number
  /** last answered, ms since epoch */
  t: number
}

export type Progress = Record<string, Entry>

export interface Stats {
  learned: number
  correct: number
  answered: number
}

export interface Profile extends Stats {
  uid: string
  nickname: string
  /** id of the aesthetic used as avatar */
  avatar: string
}

export interface AppUser {
  uid: string
  email: string
  name: string
}
