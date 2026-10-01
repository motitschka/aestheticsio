// Publishes the Pinterest boards as theme imagery: public/pins/<id>/01-10.webp
// (480px wide) plus thumb.webp (160px) for the theme picker.
// Run after adding or changing pins:  npm run make-pins
import { mkdir, readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { pinFiles } from './pins.mjs'

const data = JSON.parse(await readFile(new URL('../data/aesthetics.json', import.meta.url), 'utf8'))
const OUT = new URL('../public/pins/', import.meta.url)
await rm(OUT, { recursive: true, force: true })

let count = 0
let missing = []
for (const [i, a] of data.items.entries()) {
  const files = await pinFiles(a.name)
  if (!files.length) {
    missing.push(a.name)
    continue
  }
  const dir = new URL(`${a.id}/`, OUT)
  await mkdir(dir, { recursive: true })
  for (const [n, file] of files.slice(0, 10).entries()) {
    const img = sharp(file).rotate()
    await img.clone().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toFile(fileURLToPath(new URL(`${String(n + 1).padStart(2, '0')}.webp`, dir)))
    if (n === 0) await img.clone().resize(160, 200, { fit: 'cover' }).webp({ quality: 70 }).toFile(fileURLToPath(new URL('thumb.webp', dir)))
    count++
  }
  process.stdout.write(`\r  ${i + 1}/${data.items.length}`)
}
console.log(`\n${count} pins published to public/pins/`)
if (missing.length) console.log(`no pins for: ${missing.join(', ')}`)
