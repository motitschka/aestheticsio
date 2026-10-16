// Downloads the full Aesthetics Wiki article of every aesthetic in
// data/aesthetics.json and writes public/wiki/<id>.json for the app's wiki pages.
// Text is CC BY-SA 3.0 (credited on each page); images stay on Fandom's servers,
// only their addresses are saved. Refresh any time:  npm run fetch-wiki
// (The "Fetch wiki articles" GitHub workflow runs this and commits the result.)
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { article, linkTitles, relink, seen } from './wiki-html.mjs'

const API = 'https://aesthetics.fandom.com/api.php'
const WIKI = 'https://aesthetics.fandom.com/wiki/'
const HEADERS = { 'User-Agent': 'AesthethicLearner/0.1 (personal study app; github.com/motitschka/aestheticsio)' }
const OUT = new URL('../public/wiki/', import.meta.url)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error.info)
      await sleep(200) // be polite to Fandom
      return json
    } catch (err) {
      if (attempt >= 4) throw err
      await sleep(1500 * attempt)
    }
  }
}

const wikiUrl = (title) => WIKI + encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')

const data = JSON.parse(await readFile(new URL('../data/aesthetics.json', import.meta.url), 'utf8'))
const only = process.env.ONLY?.split(',')
const items = only ? data.items.filter((a) => only.includes(a.id)) : data.items
const idByTitle = new Map(data.items.map((a) => [a.name.toLowerCase(), a.id]))

const pages = []
const failed = []
for (const [i, a] of items.entries()) {
  try {
    const d = await api({ action: 'parse', page: a.name, prop: 'text|revid', redirects: '1', disableeditsection: '1', disabletoc: '1', disablelimitreport: '1' })
    const html = d.parse.text
    if (process.env.SAMPLE && i < Number(process.env.SAMPLE)) console.log(`\n----- ${a.name} (raw, first 12000 chars) -----\n${html.slice(0, 12000)}\n-----`)
    pages.push({ a, title: d.parse.title, rev: d.parse.revid, ...article(html) })
  } catch (err) {
    failed.push(`${a.name}: ${err.message}`)
  }
  process.stdout.write(`\r  articles ${i + 1}/${items.length}`)
}
process.stdout.write('\n')

// Links to other wiki pages: follow redirects, then point at the app's own page
// when the target is one of the aesthetics, else at the wiki. Missing pages become text.
const titles = [...new Set(pages.flatMap((p) => [...linkTitles({ lead: p.lead, sections: p.sections })]))]
const canonical = new Map()
for (let i = 0; i < titles.length; i += 50) {
  const batch = titles.slice(i, i + 50)
  const d = await api({ action: 'query', titles: batch.join('|'), redirects: '1' })
  const norm = new Map((d.query.normalized ?? []).map((n) => [n.from, n.to]))
  const redir = new Map((d.query.redirects ?? []).map((r) => [r.from, r.to]))
  const missing = new Set((d.query.pages ?? []).filter((p) => p.missing !== undefined || p.invalid !== undefined).map((p) => p.title))
  for (const t of batch) {
    const n = norm.get(t) ?? t
    const to = redir.get(n) ?? n
    canonical.set(t, missing.has(to) ? null : to)
  }
  process.stdout.write(`\r  links ${Math.min(i + 50, titles.length)}/${titles.length}`)
}
process.stdout.write('\n')

await mkdir(OUT, { recursive: true })
let bytes = 0
let images = 0
const written = new Set()
for (const p of pages) {
  const resolve = (title) => {
    const to = canonical.has(title) ? canonical.get(title) : title
    // missing pages, and redirects to categories or files ("White" → Category:White), stay text
    if (!to || /^(category|file|image|template|special|user|help):/i.test(to)) return null
    const id = idByTitle.get(to.toLowerCase())
    if (id === p.a.id) return null
    return id ? { id } : { href: wikiUrl(to) }
  }
  const body = relink({ lead: p.lead, sections: p.sections }, resolve)
  const file = new URL(`${p.a.id}.json`, OUT)
  // An unchanged article keeps its date, so a refresh only rewrites what changed.
  const before = await readFile(file, 'utf8').then(JSON.parse, () => null)
  const same = before && JSON.stringify({ ...before, fetched: '' }) === JSON.stringify({ id: p.a.id, title: p.title, url: wikiUrl(p.title), rev: p.rev, fetched: '', ...body })
  const out = { id: p.a.id, title: p.title, url: wikiUrl(p.title), rev: p.rev, fetched: same ? before.fetched : new Date().toISOString().slice(0, 10), ...body }
  const json = JSON.stringify(out)
  images += (json.match(/"src":/g) ?? []).length
  bytes += json.length
  await writeFile(file, json)
  written.add(`${p.a.id}.json`)
}

// Articles of aesthetics no longer in the set (only on a full run)
if (!only && !failed.length) for (const f of await readdir(OUT)) if (f.endsWith('.json') && !written.has(f)) await rm(new URL(f, OUT))

console.log(`wrote ${pages.length} articles to public/wiki/ (${(bytes / 1024).toFixed(0)} KB, ${images} images)`)
const thin = pages.filter((p) => p.sections.length < 2).map((p) => p.a.name)
if (thin.length) console.log(`fewer than 2 sections: ${thin.join(', ')}`)
if (failed.length) console.log(`failed:\n  ${failed.join('\n  ')}`)
const unknown = [...seen.entries()].sort((x, y) => y[1] - x[1]).slice(0, 60)
if (unknown.length) console.log(`containers walked through (tune scripts/wiki-html.mjs if one should be kept or dropped):\n  ${unknown.map(([k, n]) => `${k} ×${n}`).join('\n  ')}`)
if (failed.length > items.length / 10) process.exit(1)
