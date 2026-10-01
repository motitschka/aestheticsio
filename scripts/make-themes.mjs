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

const problems = []
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
  const { dark, colours, swatches, glow } = themeColours(kmeans(points), meanL, design.dark, design.accent)
  const { font, body, buttons, layout, icons, motion, pattern, caps } = design
  out[a.id] = { id: a.id, dark, font, body, buttons, layout, icons, motion, pattern, caps: !!caps, pins: Math.min(files.length, 10), colours, swatches, glow }
  process.stdout.write(`\r  ${i + 1}/${data.items.length}`)
}

await writeFile(new URL('../data/themes.json', import.meta.url), JSON.stringify(out))
console.log(`\nwrote data/themes.json: ${Object.keys(out).length} themes (${Object.values(out).filter((t) => t.dark).length} dark)`)
if (problems.length) console.log(`skipped: ${problems.join('; ')}`)
