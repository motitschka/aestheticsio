// Local stand-in for Firebase so the app can be tried without a Firebase
// project: `npm run dev:demo`. Everything is stored in this browser only.
import { normalizeSaved } from '../lib/progress'
import { storageKey } from '../lib/storage'
import type { AppUser, Profile, SavedProgress } from '../types'
import type { Backend } from './types'

const ME: AppUser = { uid: 'demo-me', email: 'you@example.com', name: 'Demo You' }
// Friends a little way into the journey, so the circle has something to show.
const HOUR = 60 * 60 * 1000
const T = Date.now()
const day = (daysAgo: number) => {
  const d = new Date(T - daysAgo * 24 * HOUR)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const FRIENDS: Profile[] = [
  {
    uid: 'f1', nickname: 'Ines', avatar: 'art-deco', lessonPoints: 31, bestStreak: 54, best25: 151_000, best50: 330_000, correct: 180, answered: 214,
    eras: [17, 12, 2, 0, 0, 0, 0, 0], goalDay: day(0), dayStreak: 12, freezes: 1,
    recent: [
      { k: 'learned', id: 'mid-century-modern', t: T - 2 * HOUR },
      { k: 'learned', id: 'atomic-age', t: T - 3 * HOUR },
      { k: 'era', e: 1, t: T - 26 * HOUR },
      { k: 'learned', id: 'streamline-moderne', t: T - 26 * HOUR },
    ],
  },
  {
    uid: 'f2', nickname: 'Tomás', avatar: 'art-nouveau', lessonPoints: 6, bestStreak: 9, correct: 60, answered: 95,
    eras: [6, 0, 0, 0, 0, 0, 0, 0], goalDay: day(1), dayStreak: 4, freezes: 0,
    recent: [{ k: 'learned', id: 'gustavian', t: T - 30 * HOUR }],
  },
  {
    uid: 'f3', nickname: 'Yuki', avatar: 'memphis-design', lessonPoints: 22, bestStreak: 27, best25: 240_000, correct: 70, answered: 80,
    eras: [17, 5, 0, 0, 0, 0, 0, 0], goalDay: day(3), dayStreak: 9, freezes: 2,
    recent: [
      { k: 'era', e: 0, t: T - 76 * HOUR },
      { k: 'learned', id: 'art-nouveau', t: T - 76 * HOUR },
    ],
  },
]

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey(`demo:${key}`))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(storageKey(`demo:${key}`), JSON.stringify(value))
  } catch {
    // storage unavailable: the demo just won't remember anything
  }
}

const tick = () => new Promise((r) => setTimeout(r, 150))

export function createDemoBackend(): Backend {
  const listeners = new Set<(u: AppUser | null) => void>()
  const current = () => (read('signedIn', false) ? ME : null)
  const emit = () => listeners.forEach((cb) => cb(current()))
  const loadSaved = (uid: string) => normalizeSaved(read<unknown>(`progress:${uid}`, {}))

  return {
    onAuthChange(cb) {
      listeners.add(cb)
      setTimeout(() => cb(current()), 0)
      return () => listeners.delete(cb)
    },
    async signIn() {
      write('signedIn', true)
      emit()
    },
    async signOut() {
      write('signedIn', false)
      emit()
    },
    isAdmin: async () => true,
    async loadProfile(uid) {
      return read<Profile | null>(`profile:${uid}`, null)
    },
    async saveProfile(profile) {
      write(`profile:${profile.uid}`, profile)
    },
    async loadProgress(uid) {
      await tick()
      return loadSaved(uid)
    },
    async saveProgress(uid, patch, profile) {
      const saved = loadSaved(uid)
      const next: SavedProgress = { items: { ...saved.items, ...patch.items }, stats: patch.stats ?? saved.stats }
      write(`progress:${uid}`, next)
      if (profile) write(`profile:${uid}`, profile)
    },
    async startFresh(uid, next, backup, profile) {
      write(`progress:${uid}`, { ...next, backupV1: { ...backup, at: Date.now() } })
      if (profile) write(`profile:${uid}`, profile)
    },
    watchProgress() {
      // One browser: nothing else writes.
      return () => {}
    },
    async listProfiles() {
      await tick()
      const me = read<Profile | null>(`profile:${ME.uid}`, null)
      return me ? [...FRIENDS, me] : FRIENDS
    },
    getAllowlist: async () => read<string[]>('allowlist', []),
    setAllowlist: async (emails) => write('allowlist', emails),
  }
}
