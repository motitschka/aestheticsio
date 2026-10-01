import type { AestheticsData } from './types'

// The aesthetics ship with the app (guests need them without signing in).
// Refresh with `npm run fetch-data`, then commit and push.
export async function loadAestheticsData(): Promise<AestheticsData> {
  return (await import('../data/aesthetics.json')).default as AestheticsData
}
