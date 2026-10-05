import type { SavedProgress } from '../types'
import { emptyStats, freshStart, hasProgress, needsFreshStart, normalizeSaved } from './progress'
import { storageKey } from './storage'

// Guest play keeps progress in this browser only. When a guest signs in,
// their progress is merged into the account and cleared here.
const PROGRESS_KEY = storageKey('guest-progress')
const GUEST_KEY = storageKey('guest')
/** A guest's progress from before the journey through time, kept when it was reset. */
const BACKUP_KEY = storageKey('guest-progress-v1-backup')

/** This browser's progress. The first load after the journey arrived starts it fresh, keeping a backup. */
export function loadGuestProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    const saved = normalizeSaved(JSON.parse(raw ?? '{}'))
    if (!needsFreshStart(saved)) return saved
    const had = hasProgress(saved)
    if (had && raw && !localStorage.getItem(BACKUP_KEY)) localStorage.setItem(BACKUP_KEY, JSON.stringify({ ...JSON.parse(raw), at: Date.now() }))
    const next = freshStart(had)
    if (had) localStorage.setItem(PROGRESS_KEY, JSON.stringify(next))
    return next
  } catch {
    return { items: {}, stats: emptyStats() }
  }
}

export const hasGuestProgress = hasProgress

export function saveGuestProgress(progress: SavedProgress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // storage unavailable (e.g. private mode): progress lasts until reload
  }
}

export function clearGuestProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY)
  } catch {
    // ignore
  }
}

/** Remembers that this browser chose to play as a guest, to skip the sign-in screen next time. */
export function loadGuestChoice(): boolean {
  try {
    return localStorage.getItem(GUEST_KEY) === '1'
  } catch {
    return false
  }
}

export function saveGuestChoice(guest: boolean) {
  try {
    if (guest) localStorage.setItem(GUEST_KEY, '1')
    else localStorage.removeItem(GUEST_KEY)
  } catch {
    // ignore
  }
}
