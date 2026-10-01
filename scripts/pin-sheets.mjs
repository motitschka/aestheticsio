// Contact sheets of the local Pinterest boards, for designing the themes by eye.
// Six aesthetics per sheet, each as a strip of its pins. Output: .impeccable/pins/*.png (git-ignored).
import { mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { pinFiles } from './pins.mjs'

const data = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../data/aesthetics.json', import.meta.url), 'utf8'))
const OUT = new URL('../.impeccable/pins/', import.meta.url)
await mkdir(OUT, { recursive: true })

const TILE_W = 104
const TILE_H = 130
const COLS = 5
const LABEL = 26
const BLOCK_W = TILE_W * COLS
const BLOCK_H = LABEL + TILE_H * 2
const PER_SHEET = 6

const escape = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

async function block(a, index) {
  const files = (await pinFiles(a.name)).slice(0, 10)
  const layers = [
    {
      input: Buffer.from(
        `<svg width="${BLOCK_W}" height="${LABEL}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="18" font-family="sans-serif" font-size="15" font-weight="700" fill="#fff">${index}. ${escape(a.name)}</text></svg>`,
      ),
      top: 0,
      left: 0,
    },
  ]
  for (const [i, f] of files.entries()) {
    const tile = await sharp(f).resize(TILE_W, TILE_H, { fit: 'cover' }).toBuffer()
    layers.push({ input: tile, top: LABEL + Math.floor(i / COLS) * TILE_H, left: (i % COLS) * TILE_W })
  }
  return sharp({ create: { width: BLOCK_W, height: BLOCK_H, channels: 3, background: '#333' } }).composite(layers).png().toBuffer()
}

const items = data.items
for (let s = 0; s * PER_SHEET < items.length; s++) {
  const group = items.slice(s * PER_SHEET, (s + 1) * PER_SHEET)
  const blocks = await Promise.all(group.map((a, i) => block(a, s * PER_SHEET + i + 1)))
  const sheet = sharp({ create: { width: BLOCK_W * 2 + 8, height: (BLOCK_H + 8) * 3, channels: 3, background: '#000' } }).composite(
    blocks.map((input, i) => ({ input, left: (i % 2) * (BLOCK_W + 8), top: Math.floor(i / 2) * (BLOCK_H + 8) })),
  )
  await sheet.jpeg({ quality: 82 }).toFile(fileURLToPath(new URL(`sheet-${String(s + 1).padStart(2, '0')}.jpg`, OUT)))
  process.stdout.write(`\r  sheet ${s + 1}`)
}
console.log(`\n${(await readdir(OUT)).length} sheets in .impeccable/pins/`)
