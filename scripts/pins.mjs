// The local Pinterest boards (pinterest/<Aesthetic name>/), the source of every theme.
// The folder is git-ignored; make-pins publishes resized copies to public/pins/<id>/.
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../pinterest/', import.meta.url)
const PUBLISHED = new URL('../public/pins/', import.meta.url)
const IMAGE = /\.(jpe?g|png|webp|gif)$/i

async function list(dir, keep = () => true) {
  try {
    return (await readdir(dir)).filter((f) => IMAGE.test(f) && keep(f)).sort().map((f) => fileURLToPath(new URL(encodeURIComponent(f), dir)))
  } catch {
    return []
  }
}

/** Absolute paths of an aesthetic's local pins, or [] when it has none. */
export function pinFiles(name) {
  return list(new URL(`${encodeURIComponent(name.replace(/\//g, '-'))}/`, ROOT))
}

/** The local pins, or the published copies in a checkout without the pinterest/ folder. */
export async function boardFiles(a) {
  const local = await pinFiles(a.name)
  return local.length ? local : list(new URL(`${a.id}/`, PUBLISHED), (f) => f !== 'thumb.webp')
}
