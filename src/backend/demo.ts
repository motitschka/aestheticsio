// Local stand-in for Firebase so the app can be tried without a Firebase
// project: `npm run dev:demo`. Everything is stored in this browser only.
import type { AppUser, Profile, Progress } from '../types'
import type { Backend } from './types'

const ME: AppUser = { uid: 'demo-me', email: 'you@example.com', name: 'Demo You' }
const FRIENDS: Profile[] = [
  { uid: 'f1', nickname: 'Ines', avatar: 'art-deco', learned: 41, correct: 180, answered: 214 },
  { uid: 'f2', nickname: 'Tomás', avatar: 'art-nouveau', learned: 12, correct: 60, answered: 95 },
  { uid: 'f3', nickname: 'Yuki', avatar: 'memphis-design', learned: 12, correct: 70, answered: 80 },
]

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`demo:${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(`demo:${key}`, JSON.stringify(value))
  } catch {
    // storage unavailable: the demo just won't remember anything
  }
}

const tick = () => new Promise((r) => setTimeout(r, 150))

export function createDemoBackend(): Backend {
  const listeners = new Set<(u: AppUser | null) => void>()
  const current = () => (read('signedIn', false) ? ME : null)
  const emit = () => listeners.forEach((cb) => cb(current()))

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
    async saveProfile(uid, p) {
      write(`profile:${uid}`, { uid, ...p })
    },
    async loadProgress(uid) {
      await tick()
      return read<Progress>(`progress:${uid}`, {})
    },
    async saveProgress(uid, progress) {
      write(`progress:${uid}`, { ...read<Progress>(`progress:${uid}`, {}), ...progress })
    },
    async saveAnswer(uid, id, entry, stats) {
      write(`progress:${uid}`, { ...read<Progress>(`progress:${uid}`, {}), [id]: entry })
      const profile = read<Profile | null>(`profile:${uid}`, null)
      if (profile) write(`profile:${uid}`, { ...profile, ...stats })
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
