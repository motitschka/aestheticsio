import type { SavedProgress } from '../types'
import { freshStart, hasProgress, needsFreshStart, normalizeSaved } from './progress'
import { storageKey } from './storage'

// Guest play keeps progress in this browser only. When a guest signs in,
// their progress is merged into the account and cleared here.
const PROGRESS_KEY = storageKey('guest-journey')
const GUEST_KEY = storageKey('guest')
/**
 * Progress from before the journey through time. It's kept as the backup and
 * never written again (except by an old version of the app left open in a tab).
 */
export const LEGACY_KEY = storageKey('guest-progress')

/** This browser's journey. The first load after the journey arrived starts it fresh. */
export function loadGuestProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (raw) return normalizeSaved(JSON.parse(raw))
    const legacy = normalizeSaved(JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '{}'))
    if (!needsFreshStart(legacy)) return legacy
    const had = hasProgress(legacy)
    const next = freshStart(had)
    if (had) localStorage.setItem(PROGRESS_KEY, JSON.stringify(next))
    return next
  } catch {
    return freshStart(false)
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

/** After it's merged into an account: an empty journey, so the backup isn't mistaken for new progress. */
export function clearGuestProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(freshStart(false)))
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
