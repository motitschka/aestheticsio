// Builds data/themes.json: one theme per aesthetic, unlocked in the app by
// learning its lesson. Colours are read from the aesthetic's Pinterest pins
// (pinterest/<Aesthetic>/); everything else comes from theme-designs.mjs.
// Run after changing pins or designs:  npm run make-pins && npm run make-themes
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { kmeans, rgbToOklab, themeColours } from './colour.mjs'
import { pinFiles } from './pins.mjs'
import { DESIGNS } from './theme-designs.mjs'

const SIZE = 64

const data = JSON.parse(await readFile(new URL('../data/aesthetics.json', import.meta.url), 'utf8'))

async function pixels(file) {
  try {
    const { data: raw, info } = await sharp(file).flatten({ background: '#ffffff' }).resize(SIZE, SIZE, { fit: 'cover' }).raw().toBuffer({ resolveWithObject: true })
    const out = []
    for (let i = 0; i < raw.length; i += info.channels * 2) out.push(rgbToOklab([raw[i], raw[i + 1], raw[i + 2]]))
    return out
  } catch {
    return []
  }
}

// WCAG contrast straight from the final hex values, so rounding can't hide a failure.
const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const lum = (h) => [1, 3, 5].map((i) => channel(parseInt(h.slice(i, i + 2), 16) / 255)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0)
const ratio = (x, y) => (Math.max(lum(x), lum(y)) + 0.05) / (Math.min(lum(x), lum(y)) + 0.05)
const mixHex = (a, b, amount) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, '0')).join('')

/** The glossy button's top highlight and bottom shade: as strong as the accent allows while its text stays readable. */
function gloss(c) {
  const ok = (x) => ratio(c.onAccent, x) >= 4.8
  const hi = [0.5, 0.4, 0.3, 0.2, 0.12, 0.06, 0].map((t) => mixHex(c.accent, '#ffffff', t)).find(ok)
  const lo = [0.18, 0.12, 0.06, 0].map((t) => mixHex(c.accent, '#000000', t)).find(ok)
  return { accentHi: hi ?? c.accent, accentLo: lo ?? c.accent }
}

const GROUNDS = ['bg', 'surface', 'surface2']
// [ink, grounds it sits on, minimum]: body text keeps 7+, everything else 4.8+ (WCAG AA is 4.5)
const PAIRS = [
  ['text', [...GROUNDS, 'accentSoft'], 7],
  ['muted', GROUNDS, 4.8],
  ['accentText', [...GROUNDS, 'accentSoft'], 4.8],
  ['onAccent', ['accent', 'accentHi', 'accentLo'], 4.8],
  ['good', [...GROUNDS, 'goodSoft'], 4.8],
  ['bad', [...GROUNDS, 'badSoft'], 4.8],
  ['gold', GROUNDS, 4.8],
]

const problems = []
const failures = []
const out = {}
for (const [i, a] of data.items.entries()) {
  const design = DESIGNS[a.id]
  const files = await pinFiles(a.name)
  if (!design || !files.length) {
    problems.push(`${a.name}: ${design ? 'no pins' : 'no design'}`)
    continue
  }
  const points = (await Promise.all(files.map(pixels))).flat()
  const meanL = points.reduce((s, p) => s + p[0], 0) / points.length
  const { dark, colours: base, swatches, glow } = themeColours(kmeans(points), meanL, design.dark, design.accent)
  const colours = { ...base, ...gloss(base) }
  const { font, body, buttons, layout, icons, motion, pattern, caps } = design
  for (const [ink, grounds, min] of PAIRS)
    for (const g of grounds) {
      const r = ratio(colours[ink], colours[g])
      if (r < min) failures.push(`${a.id}: ${ink} on ${g} ${r.toFixed(2)} < ${min}`)
    }
  out[a.id] = { id: a.id, dark, font, body, buttons, layout, icons, motion, pattern, caps: !!caps, pins: Math.min(files.length, 10), colours, swatches, glow }
  process.stdout.write(`\r  ${i + 1}/${data.items.length}`)
}

await writeFile(new URL('../data/themes.json', import.meta.url), JSON.stringify(out))
console.log(`\nwrote data/themes.json: ${Object.keys(out).length} themes (${Object.values(out).filter((t) => t.dark).length} dark)`)
if (problems.length) console.log(`skipped: ${problems.join('; ')}`)
if (failures.length) {
  console.error(`contrast failures:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('contrast: every text colour passes on every ground')
