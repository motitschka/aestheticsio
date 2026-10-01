import type { SavedProgress } from '../types'
import { emptyStats, normalizeSaved } from './progress'

// Guest play keeps progress in this browser only. When a guest signs in,
// their progress is merged into the account and cleared here.
const PROGRESS_KEY = 'aesthetics:guest-progress'
const GUEST_KEY = 'aesthetics:guest'

export function loadGuestProgress(): SavedProgress {
  try {
    return normalizeSaved(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}'))
  } catch {
    return { items: {}, stats: emptyStats() }
  }
}

export const hasGuestProgress = (p: SavedProgress) => Object.keys(p.items).length > 0 || p.stats.timelineTotal > 0 || p.stats.bestStreak > 0

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
