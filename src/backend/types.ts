import type { AppUser, PlayerStats, Profile, Progress, SavedProgress } from '../types'

/** Thrown when the signed-in account isn't on the allowlist. */
export class NoAccessError extends Error {
  constructor() {
    super('This account is not on the allowlist')
  }
}

export interface ProgressPatch {
  /** Changed entries only; merged into what's stored. */
  items?: Progress
  stats?: PlayerStats
}

export interface Backend {
  onAuthChange(cb: (user: AppUser | null) => void): () => void
  signIn(): Promise<void>
  signOut(): Promise<void>

  /** Only the owner can read the allowlist. */
  isAdmin(): Promise<boolean>

  loadProfile(uid: string): Promise<Profile | null>
  /** Replaces the whole profile document. */
  saveProfile(profile: Profile): Promise<void>
  /** Throws NoAccessError when the account isn't allowlisted. */
  loadProgress(uid: string): Promise<SavedProgress>
  /** Saves progress changes and, when given, the updated leaderboard profile, together. */
  saveProgress(uid: string, patch: ProgressPatch, profile: Profile | null): Promise<void>
  listProfiles(): Promise<Profile[]>

  getAllowlist(): Promise<string[]>
  setAllowlist(emails: string[]): Promise<void>
}
