import type { ModeSetting } from './quiz'

// Per-device preferences; losing them is harmless.
const MODE_KEY = 'aesthetics:mode'
const MODES: ModeSetting[] = ['mixed', 'image-to-name', 'name-to-image']

export function loadMode(): ModeSetting {
  try {
    const v = localStorage.getItem(MODE_KEY) as ModeSetting | null
    return v && MODES.includes(v) ? v : 'mixed'
  } catch {
    return 'mixed'
  }
}

export function saveMode(mode: ModeSetting) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    // ignore
  }
}
