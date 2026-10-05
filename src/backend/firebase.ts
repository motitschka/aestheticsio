import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import {
  collection,
  connectFirestoreEmulator,
  doc,
  FirestoreError,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { normalizeSaved } from '../lib/progress'
import type { Profile } from '../types'
import { NoAccessError, type Backend } from './types'

const env = import.meta.env

const denied = (err: unknown) => err instanceof FirestoreError && err.code === 'permission-denied'

/** Profile fields added with the journey through time; older Firestore rules refuse them. */
const JOURNEY_FIELDS = ['eras', 'dayStreak', 'goalDay', 'freezes', 'recent'] as const

export function createFirebaseBackend(): Backend {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  })
  const auth = getAuth(app)
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  })
  if (env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }

  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  const allowlistRef = doc(db, 'config', 'allowlist')

  return {
    onAuthChange(cb) {
      return onAuthStateChanged(auth, (u) =>
        cb(u ? { uid: u.uid, email: u.email ?? '', name: u.displayName ?? '' } : null),
      )
    },

    async signIn() {
      try {
        await signInWithPopup(auth, provider)
      } catch (err) {
        const code = (err as { code?: string }).code
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider)
        } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
          throw err
        }
      }
    },

    signOut: () => signOut(auth),

    async isAdmin() {
      try {
        await getDoc(allowlistRef)
        return true
      } catch (err) {
        if (denied(err)) return false
        throw err
      }
    },

    async loadProfile(uid) {
      const snap = await getDoc(doc(db, 'profiles', uid))
      return snap.exists() ? toProfile(uid, snap.data()) : null
    },

    async saveProfile(profile) {
      await withOldRules(profile, (p) => setDoc(doc(db, 'profiles', p.uid), profileDoc(p)))
    },

    async loadProgress(uid) {
      try {
        const snap = await getDoc(doc(db, 'progress', uid))
        return normalizeSaved(snap.data() ?? {})
      } catch (err) {
        if (denied(err)) throw new NoAccessError()
        throw err
      }
    },

    async saveProgress(uid, patch, profile) {
      await withOldRules(profile, (p) => {
        const batch = writeBatch(db)
        batch.set(doc(db, 'progress', uid), patch, { merge: true })
        if (p) batch.set(doc(db, 'profiles', uid), profileDoc(p))
        return batch.commit()
      })
    },

    async startFresh(uid, next, backup, profile) {
      await withOldRules(profile, (p) => {
        const batch = writeBatch(db)
        // No merge: the old items go; the backup keeps them (only its owner can read it).
        batch.set(doc(db, 'progress', uid), { ...next, backupV1: { ...backup, at: Date.now() } })
        if (p) batch.set(doc(db, 'profiles', uid), profileDoc(p))
        return batch.commit()
      })
    },

    watchProgress(uid, cb) {
      return onSnapshot(
        doc(db, 'progress', uid),
        (snap) => {
          // Our own writes come back too; only what the server has confirmed counts.
          if (!snap.metadata.hasPendingWrites) cb(normalizeSaved(snap.data() ?? {}))
        },
        () => {
          // Offline or signed out: the next save or reload catches up.
        },
      )
    },

    async listProfiles() {
      const snap = await getDocs(collection(db, 'profiles'))
      return snap.docs.map((d) => toProfile(d.id, d.data()))
    },

    async getAllowlist() {
      const snap = await getDoc(allowlistRef)
      return (snap.data()?.emails as string[] | undefined) ?? []
    },

    async setAllowlist(emails) {
      await setDoc(allowlistRef, { emails })
    },
  }
}

/**
 * Until the owner deploys the journey's Firestore rules, the old ones refuse
 * the new profile fields. Then saves go on without them (friends just don't
 * see era strips yet), rather than failing.
 */
let oldRules = false
async function withOldRules<T extends Profile | null>(profile: T, write: (p: T) => Promise<unknown>) {
  const strip = (p: T): T => {
    if (!p) return p
    const copy = { ...p } as Profile
    for (const key of JOURNEY_FIELDS) delete copy[key]
    return copy as T
  }
  if (oldRules) return void (await write(strip(profile)))
  try {
    await write(profile)
  } catch (err) {
    if (!denied(err) || !profile || !JOURNEY_FIELDS.some((k) => k in profile)) throw err
    await write(strip(profile))
    oldRules = true
  }
}

// The whole document is replaced on every save, so old fields never linger.
function profileDoc({ uid: _uid, ...p }: Profile) {
  return { ...p, updatedAt: serverTimestamp() }
}

function toProfile(uid: string, d: Record<string, unknown>): Profile {
  const p: Profile = {
    uid,
    nickname: String(d.nickname ?? ''),
    avatar: String(d.avatar ?? ''),
    lessonPoints: Number(d.lessonPoints ?? 0),
    bestStreak: Number(d.bestStreak ?? 0),
    correct: Number(d.correct ?? 0),
    answered: Number(d.answered ?? 0),
  }
  for (const key of ['best25', 'best50', 'best100'] as const) if (typeof d[key] === 'number') p[key] = d[key]
  if (Array.isArray(d.eras)) p.eras = d.eras.map(Number)
  if (typeof d.goalDay === 'string') {
    p.goalDay = d.goalDay
    p.dayStreak = Number(d.dayStreak ?? 0)
    p.freezes = Number(d.freezes ?? 0)
  }
  if (Array.isArray(d.recent)) p.recent = d.recent as Profile['recent']
  return p
}
