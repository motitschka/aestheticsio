import type { AppUser, Entry, Profile, Progress, Stats } from '../types'

/** Thrown when the signed-in account isn't on the allowlist. */
export class NoAccessError extends Error {
  constructor() {
    super('This account is not on the allowlist')
  }
}

export interface Backend {
  onAuthChange(cb: (user: AppUser | null) => void): () => void
  signIn(): Promise<void>
  signOut(): Promise<void>

  /** Only the owner can read the allowlist. */
  isAdmin(): Promise<boolean>

  loadProfile(uid: string): Promise<Profile | null>
  saveProfile(uid: string, profile: Pick<Profile, 'nickname' | 'avatar'> & Stats): Promise<void>
  /** Throws NoAccessError when the account isn't allowlisted. */
  loadProgress(uid: string): Promise<Progress>
  /** Writes many entries at once (used to carry guest progress into an account). */
  saveProgress(uid: string, progress: Progress): Promise<void>
  /** Saves one answer and the updated leaderboard stats together. */
  saveAnswer(uid: string, aestheticId: string, entry: Entry, stats: Stats): Promise<void>
  listProfiles(): Promise<Profile[]>

  getAllowlist(): Promise<string[]>
  setAllowlist(emails: string[]): Promise<void>
}
