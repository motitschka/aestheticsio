// The local Pinterest boards (pinterest/<Aesthetic name>/), used only as theme inspiration.
// They never leave this computer: the folder is git-ignored and nothing here ships.
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../pinterest/', import.meta.url)
const IMAGE = /\.(jpe?g|png|webp|gif)$/i

/** Absolute paths of an aesthetic's pins, or [] when it has none. */
export async function pinFiles(name) {
  const dir = new URL(`${encodeURIComponent(name.replace(/\//g, '-'))}/`, ROOT)
  try {
    return (await readdir(dir)).filter((f) => IMAGE.test(f)).sort().map((f) => fileURLToPath(new URL(encodeURIComponent(f), dir)))
  } catch {
    return []
  }
}
