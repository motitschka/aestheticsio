// Local stand-in for Firebase so the app can be tried without a Firebase
// project: `npm run dev:demo`. Everything is stored in this browser only.
import { normalizeSaved } from '../lib/progress'
import { storageKey } from '../lib/storage'
import type { AppUser, Profile, SavedProgress } from '../types'
import type { Backend } from './types'

const ME: AppUser = { uid: 'demo-me', email: 'you@example.com', name: 'Demo You' }
const FRIENDS: Profile[] = [
  { uid: 'f1', nickname: 'Ines', avatar: 'art-deco', lessonPoints: 61, bestStreak: 54, best25: 151_000, best50: 330_000, correct: 180, answered: 214 },
  { uid: 'f2', nickname: 'Tomás', avatar: 'art-nouveau', lessonPoints: 12, bestStreak: 9, correct: 60, answered: 95 },
  { uid: 'f3', nickname: 'Yuki', avatar: 'memphis-design', lessonPoints: 12, bestStreak: 27, best25: 240_000, correct: 70, answered: 80 },
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
    async listProfiles() {
      await tick()
      const me = read<Profile | null>(`profile:${ME.uid}`, null)
      return me ? [...FRIENDS, me] : FRIENDS
    },
    getAllowlist: async () => read<string[]>('allowlist', []),
    setAllowlist: async (emails) => write('allowlist', emails),
  }
}
