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
  /**
   * The account's journey progress, or, before its fresh start, the record from
   * before the journey (it has no journey version, see needsFreshStart).
   * Throws NoAccessError when the account isn't allowlisted.
   */
  loadProgress(uid: string): Promise<SavedProgress>
  /** Saves journey progress changes and, when given, the updated leaderboard profile, together. */
  saveProgress(uid: string, patch: ProgressPatch, profile: Profile | null): Promise<void>
  /**
   * The journey's fresh start. The journey is kept apart from the old record,
   * which stays untouched as the backup (and is all an old version of the app,
   * left open in a tab, can still write to). Checked on the server: if another
   * device already started the journey, its progress is returned instead.
   */
  startFresh(uid: string, next: SavedProgress, profile: Profile | null): Promise<SavedProgress>
  /** Calls back with the stored journey whenever it changes (from any device). Returns an unsubscribe. */
  watchProgress(uid: string, cb: (saved: SavedProgress) => void): () => void
  listProfiles(): Promise<Profile[]>

  getAllowlist(): Promise<string[]>
  setAllowlist(emails: string[]): Promise<void>
}
