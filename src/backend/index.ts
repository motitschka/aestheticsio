import type { Backend } from './types'

export const isDemo = import.meta.env.VITE_BACKEND === 'demo'

/** Without Firebase config the app is guest-only (no sign-in, no leaderboard). */
export const firebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID)

// Dynamic imports keep demo code out of the production bundle and Firebase
// out of the first download.
export async function createBackend(): Promise<Backend | null> {
  if (import.meta.env.VITE_BACKEND === 'demo') return (await import('./demo')).createDemoBackend()
  if (!firebaseConfigured) return null
  return (await import('./firebase')).createFirebaseBackend()
}

export { NoAccessError, type Backend } from './types'
