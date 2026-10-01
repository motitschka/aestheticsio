// Builds data/themes.json: one theme per aesthetic, unlocked in the app by
// learning its lesson. Colours come from the aesthetic's own wiki images;
// fonts and button styles are hand-picked in theme-styles.mjs.
// Run after fetch-data:  npm run make-themes
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'
import { kmeans, rgbToOklab, themeColours } from './colour.mjs'
import { fallbackStyle, STYLES } from './theme-styles.mjs'

const SIZE = 64
const CONCURRENCY = 6
// Fandom only serves images to requests that say where they come from.
const HEADERS = { 'User-Agent': 'AesthethicLearner/0.1 (personal study app)', Referer: 'https://aesthetics.fandom.com/' }

const data = JSON.parse(await readFile(new URL('../data/aesthetics.json', import.meta.url), 'utf8'))
const thumb = (url) => url.replace('/revision/latest', '/revision/latest/scale-to-width-down/120')

async function pixels(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(thumb(url), { headers: HEADERS })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      const { data: raw, info } = await sharp(buf).flatten({ background: '#ffffff' }).resize(SIZE, SIZE, { fit: 'cover' }).raw().toBuffer({ resolveWithObject: true })
      const out = []
      for (let i = 0; i < raw.length; i += info.channels * 2) out.push(rgbToOklab([raw[i], raw[i + 1], raw[i + 2]]))
      return out
    } catch {
      await new Promise((r) => setTimeout(r, 800 * attempt))
    }
  }
  return []
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  let done = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
        process.stdout.write(`\r  ${++done}/${items.length}`)
      }
    }),
  )
  process.stdout.write('\n')
  return out
}

console.log(`Reading the colours of ${data.items.length} aesthetics' images…`)
const missingStyle = []
const themes = await mapLimit(data.items, CONCURRENCY, async (a) => {
  const points = (await Promise.all(a.images.map(pixels))).flat()
  if (!points.length) return null
  const meanL = points.reduce((s, p) => s + p[0], 0) / points.length
  const style = STYLES[a.id] ?? (missingStyle.push(a.name), fallbackStyle(a.year))
  const [font, body, buttons, forceDark, accent] = style
  const { dark, colours, swatches, glow } = themeColours(kmeans(points), meanL, forceDark, accent)
  return { id: a.id, dark, font, body, buttons, colours, swatches, glow }
})

const out = Object.fromEntries(themes.filter(Boolean).map((t) => [t.id, t]))
await writeFile(new URL('../data/themes.json', import.meta.url), JSON.stringify(out))
const failed = data.items.filter((a) => !out[a.id]).map((a) => a.name)
console.log(`wrote data/themes.json: ${Object.keys(out).length} themes (${Object.values(out).filter((t) => t.dark).length} dark)`)
if (failed.length) console.log(`no images could be read for: ${failed.join(', ')}`)
if (missingStyle.length) console.log(`no hand-picked style (guessed from decade): ${missingStyle.join(', ')}`)
