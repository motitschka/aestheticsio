import type { Aesthetic } from '../types'

/** "Vector Música!" → "vectormusica" */
export function normalizeName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Words too generic to hide when they're part of a name ("Memphis Design").
const GENERIC = new Set(
  'the and of a an in on for with art arts design designs style styles core aesthetic aesthetics revival modern new age era wave movement culture chic look interior fashion'.split(
    ' ',
  ),
)

export const BLANK = '_____'

function maskPattern(a: Aesthetic): RegExp {
  const names = [a.name, ...(a.aliases ?? [])]
  const words = names.flatMap((n) => n.split(/[\s\-–/]+/)).filter((w) => w.length >= 3 && !GENERIC.has(w.toLowerCase()))
  const terms = [...new Set([...names, ...words])].sort((x, y) => y.length - x.length)
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'giu')
}

/** Hides the aesthetic's name, alternative names and their distinctive words. */
export function maskName(text: string, a: Aesthetic): string {
  return text.replace(maskPattern(a), BLANK).replace(new RegExp(`${BLANK}(?:[\\s-]+${BLANK})+`, 'g'), BLANK)
}
