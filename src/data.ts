import type { Themes } from './lib/theme'
import type { AestheticsData } from './types'

// The aesthetics ship with the app (guests need them without signing in).
// Refresh with `npm run fetch-data`, then commit and push.
export async function loadAestheticsData(): Promise<AestheticsData> {
  return (await import('../data/aesthetics.json')).default as AestheticsData
}

/** The 174 unlockable themes (scripts/make-themes.mjs). */
export async function loadThemes(): Promise<Themes> {
  return (await import('../data/themes.json')).default as Themes
}
