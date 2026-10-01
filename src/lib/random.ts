export type Rng = () => number

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const pickOne = <T>(items: readonly T[], rng: Rng = Math.random): T => items[Math.floor(rng() * items.length)]

export const sample = <T>(items: readonly T[], n: number, rng: Rng = Math.random): T[] => shuffle(items, rng).slice(0, n)
