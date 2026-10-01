// Downloads the aesthetics in Category:Design Aesthetics from the Aesthetics Wiki
// and writes data/aesthetics.json: names, wiki links, up to 10 image URLs, and
// the intro and infobox facts (motifs, colours, decade, ...) used by lessons.
// Re-run any time to refresh (then commit and push):  npm run fetch-data
import { mkdir, writeFile } from 'node:fs/promises'
import { decadeYear, introText, linkTargets, parseInfobox, plain, plainList } from './wikitext.mjs'

const API = 'https://aesthetics.fandom.com/api.php'
const WIKI = 'https://aesthetics.fandom.com/wiki/'
const CATEGORY = 'Category:Design Aesthetics'
const IMAGES_PER_AESTHETIC = 10
const MIN_SIDE = 200
const MAX_ASPECT = 3
const OK_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const HEADERS = { 'User-Agent': 'AesthethicLearner/0.1 (personal study app)' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error.info)
      await sleep(150) // be polite to Fandom
      return json
    } catch (err) {
      if (attempt >= 4) throw err
      await sleep(1000 * attempt)
    }
  }
}

const fileKey = (name) => name.replace(/_/g, ' ').trim().replace(/^(File|Image):/i, '')
const slug = (title) =>
  title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function categoryMembers() {
  const titles = []
  let cont = {}
  do {
    const d = await api({ action: 'query', list: 'categorymembers', cmtitle: CATEGORY, cmnamespace: '0', cmlimit: 'max', ...cont })
    titles.push(...d.query.categorymembers.map((m) => m.title))
    cont = d.continue ?? null
  } while (cont)
  return titles.sort((a, b) => a.localeCompare(b))
}

// Images in page order (the infobox's main image first), plus the page's wikitext.
async function fetchPage(title) {
  const d = await api({ action: 'parse', page: title, prop: 'images|wikitext', redirects: '1' })
  const wikitext = d.parse.wikitext
  const main = wikitext.match(/\|\s*image1\s*=\s*([^\n|}]+)/)?.[1]
  const ordered = [main, ...d.parse.images].filter(Boolean).map(fileKey)
  return { files: [...new Set(ordered)], wikitext }
}

/** Facts for lessons and the text-based questions. Missing fields are left out. */
function facts(wikitext) {
  const { fields: f, end } = parseInfobox(wikitext)
  const list = (key, max) => (f[key] ? plainList(f[key], max) : [])
  const decade = f.decade_of_origin ? plain(f.decade_of_origin).replace(/\n+/g, ' · ') : ''
  const out = {
    intro: introText(wikitext, end),
    aliases: list('other_names', 6).filter((x) => x.length <= 40),
    decade,
    year: decadeYear(decade),
    origin: f.location_of_origin ? plain(f.location_of_origin).replace(/\n+/g, ' · ') : '',
    motifs: list('key_motifs', 8),
    colours: list('key_colours', 10),
    values: list('key_values', 8),
    relatedLinks: f.related_aesthetics ? linkTargets(f.related_aesthetics) : [],
  }
  // Prefer link targets: adjacent links ("[[A]][[B]]") would otherwise run together.
  out.related = out.relatedLinks.length ? [...new Set(out.relatedLinks)].slice(0, 16) : list('related_aesthetics', 16)
  return out
}

async function imageInfo(files) {
  const info = new Map()
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50)
    const d = await api({ action: 'query', titles: batch.map((f) => `File:${f}`).join('|'), prop: 'imageinfo', iiprop: 'url|size|mime' })
    for (const p of d.query.pages) {
      const ii = p.imageinfo?.[0]
      if (ii) info.set(fileKey(p.title), { url: ii.url, width: ii.width, height: ii.height, mime: ii.mime })
    }
    process.stdout.write(`\r  image info ${Math.min(i + 50, files.length)}/${files.length}`)
  }
  process.stdout.write('\n')
  return info
}

const usable = (ii) =>
  ii && OK_MIME.has(ii.mime) && Math.min(ii.width, ii.height) >= MIN_SIDE &&
  Math.max(ii.width, ii.height) / Math.min(ii.width, ii.height) <= MAX_ASPECT

// Keep the main image, then spread the rest evenly across the page so the
// picks cover different sections of the gallery.
function pick(files) {
  if (files.length <= IMAGES_PER_AESTHETIC) return files
  const [first, ...rest] = files
  const n = IMAGES_PER_AESTHETIC - 1
  return [first, ...Array.from({ length: n }, (_, i) => rest[Math.floor((i * rest.length) / n)])]
}

const titles = await categoryMembers()
console.log(`${titles.length} aesthetics in ${CATEGORY}`)

const pages = []
for (const [i, title] of titles.entries()) {
  pages.push({ title, ...(await fetchPage(title)) })
  process.stdout.write(`\r  pages ${i + 1}/${titles.length}`)
}
process.stdout.write('\n')

// An image used on several aesthetics' pages would make a quiz question ambiguous.
const usage = new Map()
for (const p of pages) for (const f of p.files) usage.set(f, (usage.get(f) ?? 0) + 1)

const info = await imageInfo([...usage.keys()])

const idByName = new Map(titles.map((t) => [t.toLowerCase(), slug(t)]))

const items = pages.map(({ title, files, wikitext }) => {
  const valid = files.filter((f) => usable(info.get(f)))
  const unique = valid.filter((f) => usage.get(f) === 1)
  const chosen = pick(unique.length ? unique : valid)
  const { relatedLinks, ...rest } = facts(wikitext)
  const id = slug(title)
  return {
    id,
    name: title,
    wiki: WIKI + encodeURIComponent(title.replace(/ /g, '_')),
    images: chosen.map((f) => info.get(f).url),
    ...rest,
    relatedIds: [...new Set(relatedLinks.map((t) => idByName.get(t.toLowerCase())).filter((x) => x && x !== id))],
  }
})

// "Similar" aesthetics for the tell-them-apart questions: linked either way,
// then aesthetics linked from those.
const byId = new Map(items.map((a) => [a.id, a]))
const linkedFrom = new Map(items.map((a) => [a.id, new Set()]))
for (const a of items) for (const r of a.relatedIds) linkedFrom.get(r).add(a.id)
for (const a of items) {
  const direct = [...new Set([...a.relatedIds, ...linkedFrom.get(a.id)])]
  const second = direct.flatMap((r) => [...byId.get(r).relatedIds, ...linkedFrom.get(r)])
  a.similar = [...new Set([...direct, ...second])].filter((x) => x !== a.id).slice(0, 8)
}
for (const a of items) {
  delete a.relatedIds
  // Drop empty fields to keep the file small.
  for (const [k, v] of Object.entries(a)) if (v === '' || v === undefined || (Array.isArray(v) && v.length === 0)) delete a[k]
}

const empty = items.filter((a) => a.images.length === 0)
const few = items.filter((a) => a.images.length > 0 && a.images.length < 4)
console.log(`kept ${items.length - empty.length} aesthetics, ${items.reduce((n, a) => n + a.images.length, 0)} images`)
if (few.length) console.log(`fewer than 4 images: ${few.map((a) => `${a.name} (${a.images.length})`).join(', ')}`)
if (empty.length) console.log(`dropped, no usable images: ${empty.map((a) => a.name).join(', ')}`)
const has = (k) => items.filter((a) => a[k] !== undefined).length
console.log(`facts: intro ${has('intro')}, decade ${has('year')}, motifs ${has('motifs')}, colours ${has('colours')}, values ${has('values')}, similar ${has('similar')}`)

await mkdir(new URL('../data/', import.meta.url), { recursive: true })
const out = {
  source: 'https://aesthetics.fandom.com/wiki/' + CATEGORY.replace(/ /g, '_'),
  license: 'Text CC BY-SA 3.0, Aesthetics Wiki contributors',
  fetchedAt: new Date().toISOString(),
  items: items.filter((a) => a.images.length > 0),
}
const json = JSON.stringify(out)
await writeFile(new URL('../data/aesthetics.json', import.meta.url), json)
console.log(`wrote data/aesthetics.json (${(json.length / 1024).toFixed(0)} KB)`)
