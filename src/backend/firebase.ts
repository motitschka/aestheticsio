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
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import type { Profile, Progress } from '../types'
import { NoAccessError, type Backend } from './types'

const env = import.meta.env

const denied = (err: unknown) => err instanceof FirestoreError && err.code === 'permission-denied'

export function createFirebaseBackend(): Backend {
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  })
  const auth = getAuth(app)
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
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

    async saveProfile(uid, p) {
      await setDoc(doc(db, 'profiles', uid), { ...p, updatedAt: serverTimestamp() })
    },

    async loadProgress(uid) {
      try {
        const snap = await getDoc(doc(db, 'progress', uid))
        return (snap.data()?.items as Progress | undefined) ?? {}
      } catch (err) {
        if (denied(err)) throw new NoAccessError()
        throw err
      }
    },

    async saveProgress(uid, progress) {
      await setDoc(doc(db, 'progress', uid), { items: progress }, { merge: true })
    },

    async saveAnswer(uid, aestheticId, entry, stats) {
      const batch = writeBatch(db)
      batch.set(doc(db, 'progress', uid), { items: { [aestheticId]: entry } }, { merge: true })
      batch.set(doc(db, 'profiles', uid), { ...stats, updatedAt: serverTimestamp() }, { merge: true })
      await batch.commit()
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

function toProfile(uid: string, d: Record<string, unknown>): Profile {
  return {
    uid,
    nickname: String(d.nickname ?? ''),
    avatar: String(d.avatar ?? ''),
    learned: Number(d.learned ?? 0),
    correct: Number(d.correct ?? 0),
    answered: Number(d.answered ?? 0),
  }
}
