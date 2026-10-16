// Turns an Aesthetics Wiki article (the HTML the MediaWiki parse API returns)
// into the small JSON the app's wiki pages render: sections of paragraphs,
// lists, quotes, tables, images and galleries. Images stay on Fandom's servers
// (only their addresses are kept). Links to other wiki pages keep their target
// title in `w`; fetch-wiki.mjs later turns those into app links or wiki links.
import { parse } from 'node-html-parser'

const IMAGE_HOST = /^https:\/\/static\.wikia\.nocookie\.net\//
// Never shown: images labelled as made by AI (the wiki forbids them; this is a backstop).
const AI = /\b(ai[\s_-]?(generated|art|image)|midjourney|dall[\s_-]?e|stable[\s_-]?diffusion|made (with|by) ai)\b/i
// Sections that only hold citations or site furniture.
const SKIP_SECTION = /^(references?|notes?|citations?|sources?|footnotes?|navigation|bibliography)$/i

// Elements dropped with everything inside them.
const SKIP = [
  'style', 'script', 'link', 'meta', 'noscript', 'aside', 'nav',
  '.portable-infobox', '.infobox', '.toc', '#toc', '.navbox', '.mw-references-wrap', '.references', '.reflist',
  '.mw-editsection', '.noprint', '.mbox', '.ambox', '.notice', '.hatnote', '.dablink', '.mw-empty-elt',
  '.printfooter', '.catlinks', '.reference', '.magnify', '.error', '.mw-cite-backlink', '.wds-dropdown', '.nomobile',
  // "Main article: …" and "This article is about …" notes
  '.main-article', '.about-template', '.rellink',
]

const INLINE = new Set(['a', 'b', 'strong', 'i', 'em', 'span', 'u', 's', 'del', 'ins', 'small', 'big', 'sub', 'sup', 'code', 'kbd', 'abbr', 'cite', 'q', 'font', 'mark', 'time', 'bdi', 'tt', 'var', 'br', 'img', 'wbr'])

const tag = (el) => (el.rawTagName ?? '').toLowerCase()
const isEl = (n) => n.nodeType === 1
const has = (el, cls) => el.classList?.contains(cls)
const matches = (el, sel) => {
  if (sel.startsWith('.')) return has(el, sel.slice(1))
  if (sel.startsWith('#')) return el.id === sel.slice(1)
  return tag(el) === sel
}
const skipped = (el) => SKIP.some((s) => matches(el, s)) || /display:\s*none/.test(el.getAttribute?.('style') ?? '')

/** Unknown classes and tags met while converting, for tuning the converter. */
export const seen = new Map()
const note = (what) => seen.set(what, (seen.get(what) ?? 0) + 1)

// ---------- inline text ----------

function linkTarget(href) {
  if (!href) return null
  let m = href.match(/^(?:https?:\/\/aesthetics\.fandom\.com)?\/wiki\/([^?#]+)/)
  if (m) {
    const title = decodeURIComponent(m[1]).replace(/_/g, ' ')
    if (/^(file|image|category|template|special|user|user talk|talk|help|aesthetics wiki|message wall|blog):/i.test(title)) return { plain: true }
    return { w: title }
  }
  if (href.startsWith('#')) return { plain: true }
  m = href.match(/^(?:https?:)?\/\/[^\s]+$/)
  if (m) return { href: href.startsWith('//') ? 'https:' + href : href }
  return { plain: true }
}

function inline(nodes) {
  const out = []
  for (const n of nodes) {
    if (n.nodeType === 3) {
      out.push(n.text.replace(/\s+/g, ' '))
      continue
    }
    if (!isEl(n) || skipped(n)) continue
    const t = tag(n)
    if (t === 'br') out.push({ t: 'br' })
    else if (t === 'img' || n.querySelector('img') && t === 'a') continue
    else if (t === 'a') {
      const c = inline(n.childNodes)
      const target = has(n, 'new') ? { plain: true } : linkTarget(n.getAttribute('href'))
      if (!target || target.plain) out.push(...c)
      else out.push({ t: 'a', c, ...target })
    } else if (t === 'b' || t === 'strong') out.push({ t: 'b', c: inline(n.childNodes) })
    else if (t === 'i' || t === 'em' || t === 'cite') out.push({ t: 'i', c: inline(n.childNodes) })
    else if (t === 'ul' || t === 'ol' || t === 'p' || t === 'div' || t === 'li' || t === 'dd' || t === 'dt') {
      // block elements inside a table cell or caption: keep them on their own lines
      const c = inline(n.childNodes)
      if (c.length) out.push({ t: 'br' }, ...c, { t: 'br' })
    } else out.push(...inline(n.childNodes))
  }
  return out
}

const isBr = (x) => typeof x === 'object' && x.t === 'br'

/** Merges neighbouring text, trims the ends and drops empty marks. */
export function tidy(list) {
  const out = []
  for (let x of list) {
    if (typeof x === 'object' && (x.t === 'b' || x.t === 'i' || x.t === 'a')) {
      const c = tidyInner(x.c)
      if (!c.length) continue
      x = { ...x, c }
    }
    const last = out[out.length - 1]
    if (typeof x === 'string' && typeof last === 'string') out[out.length - 1] = (last + x).replace(/ {2,}/g, ' ')
    else if (isBr(x) && (out.length === 0 || isBr(last))) continue
    else out.push(typeof x === 'string' ? x.replace(/ {2,}/g, ' ') : x)
  }
  // trim around the edges and line breaks
  for (let i = 0; i < out.length; i++) {
    if (typeof out[i] !== 'string') continue
    if (i === 0 || isBr(out[i - 1])) out[i] = out[i].replace(/^\s+/, '')
    if (i === out.length - 1 || isBr(out[i + 1])) out[i] = out[i].replace(/\s+$/, '')
  }
  // no line breaks at the ends or twice in a row
  const kept = out.filter((x) => x !== '')
  return kept.filter((x, i) => !isBr(x) || (i > 0 && i < kept.length - 1 && !isBr(kept[i - 1])))
}

const tidyInner = (c) => {
  const t = tidy(c)
  return textOf(t).trim() ? t : []
}

export const textOf = (c) => c.map((x) => (typeof x === 'string' ? x : x.t === 'br' ? '\n' : textOf(x.c))).join('')
const hasText = (c) => textOf(c).replace(/[\s​]/g, '').length > 0

// ---------- images ----------

/** The full-size address of a Fandom image (the app asks for a scaled copy itself). */
export const original = (url) => url.replace(/\/revision\/latest\/[^?]*/, '/revision/latest').replace(/&amp;/g, '&')

function imageOf(img) {
  const a = img.closest('a')
  const href = a?.getAttribute('href') ?? ''
  let src = img.getAttribute('data-src') || img.getAttribute('src') || ''
  if (IMAGE_HOST.test(href) && /\/images\//.test(href)) src = href
  if (src.startsWith('//')) src = 'https:' + src
  if (!IMAGE_HOST.test(src)) return null
  src = original(src)
  const name = img.getAttribute('data-image-name') || img.getAttribute('alt') || ''
  if (/\.svg\b/i.test(src) || AI.test(name) || AI.test(src)) return null
  const w = Number(img.getAttribute('width')) || undefined
  const h = Number(img.getAttribute('height')) || undefined
  if (w && w < 48) return null
  // A file without a picture's extension is a video; the address is its still.
  const file = decodeURIComponent(src.match(/\/images\/\w\/\w\w\/([^/]+)\/revision/)?.[1] ?? '')
  const video = file && !PICTURE.test(file) ? { v: `${WIKI}File:${encodeURIComponent(file).replace(/%2C/g, ',')}` } : {}
  return { src, ...(w && h ? { w, h } : {}), ...video }
}

const PICTURE = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i
const WIKI = 'https://aesthetics.fandom.com/wiki/'

const CAPTION = ['figcaption', '.thumbcaption', '.lightbox-caption', '.gallerytext', '.wikia-gallery-caption', '.caption', '.image-caption']

/** A frame's caption: its text, undefined when it has none, null when it says the picture was made by AI. */
function captionOf(el) {
  for (const sel of CAPTION) {
    const c = el.querySelector(sel)
    if (!c) continue
    const cap = tidy(inline(c.childNodes))
    if (!hasText(cap)) return undefined
    return AI.test(textOf(cap)) ? null : cap
  }
  return undefined
}

/** Images in an element, each with the caption of its own frame. */
function imagesIn(el) {
  if (tag(el) === 'img') return [imageOf(el)].filter(Boolean)
  const out = []
  const done = new Set()
  const frames = el.querySelectorAll('.wikia-gallery-item, .gallerybox, figure, .thumb.tright, .thumb.tleft, .thumb.tnone, .thumb.center')
  const all = el.querySelectorAll('img')
  // one picture: the element is its frame
  const single = !frames.length && all.length === 1
  for (const frame of single ? [el] : frames) {
    const cap = captionOf(frame)
    for (const img of frame.querySelectorAll('img')) {
      if (done.has(img)) continue
      done.add(img)
      const image = imageOf(img)
      if (!image || cap === null) continue
      out.push(cap?.length ? { ...image, cap } : image)
    }
  }
  // pictures outside any frame, uncaptioned
  for (const img of all) {
    if (done.has(img)) continue
    const image = imageOf(img)
    if (image) out.push(image)
  }
  return [...new Map(out.map((i) => [i.src, i])).values()]
}

const isFrame = (el) =>
  tag(el) === 'figure' || has(el, 'thumb') || has(el, 'floatright') || has(el, 'floatleft') || has(el, 'floatnone') ||
  (el.getAttribute?.('typeof') ?? '').startsWith('mw:File')

const isGallery = (el) =>
  has(el, 'wikia-gallery') || has(el, 'gallery') || has(el, 'mw-gallery-packed') || has(el, 'mw-gallery-traditional') ||
  has(el, 'mw-gallery-nolines') || has(el, 'mw-gallery-packed-hover') || has(el, 'mw-gallery-packed-overlay') || has(el, 'mw-gallery-slideshow')

function sideOf(el) {
  const c = el.getAttribute?.('class') ?? ''
  if (/\b(tleft|floatleft|mw-halign-left)\b/.test(c)) return 'left'
  if (/\b(tnone|floatnone|center|mw-halign-center|mw-halign-none)\b/.test(c)) return 'center'
  return undefined
}

function imageBlocks(el) {
  const imgs = imagesIn(el)
  if (!imgs.length) return []
  if (imgs.length === 1) {
    const side = sideOf(el)
    return [{ t: 'img', img: imgs[0], ...(side ? { side } : {}) }]
  }
  return [{ t: 'gallery', items: imgs }]
}

// ---------- video ----------

const isEmbed = (el) =>
  tag(el) === 'iframe' || has(el, 'embedvideo') || has(el, 'embedvideowrap') || has(el, 'spotify') || el.hasAttribute?.('data-iframeconfig') ||
  (tag(el) === 'figure' && el.hasAttribute?.('data-service'))

/** A YouTube or Spotify embed, as a link (the app doesn't embed other sites). */
function videoOf(el) {
  const raw = el.toString().replace(/\\\//g, '/')
  const yt = raw.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,})/)?.[1] ?? raw.match(/data-video-id="([\w-]{6,})"/)?.[1]
  const cap = captionOf(el)
  const extra = cap?.length ? { cap } : {}
  if (yt) return { t: 'video', yt, href: `https://www.youtube.com/watch?v=${yt}`, ...extra }
  const spotify = raw.match(/https:\/\/open\.spotify\.com\/(?:embed\/)?([\w/-]+)/)?.[1]
  if (spotify) return { t: 'video', href: `https://open.spotify.com/${spotify}`, ...extra }
  return null
}

// ---------- blocks ----------

function list(el) {
  const items = []
  for (const li of el.childNodes) {
    if (!isEl(li) || tag(li) !== 'li' || skipped(li)) continue
    const own = li.childNodes.filter((n) => !(isEl(n) && (tag(n) === 'ul' || tag(n) === 'ol')))
    const subs = li.childNodes.filter((n) => isEl(n) && (tag(n) === 'ul' || tag(n) === 'ol'))
    const imgs = own.filter(isEl).flatMap((n) => (tag(n) === 'img' || n.querySelector('img') ? imagesIn(n) : []))
    const c = tidy(inline(own))
    const sub = subs.map(list).filter(Boolean)
    if (!hasText(c) && !sub.length && !imgs.length) continue
    items.push({ c, ...(sub.length ? { sub } : {}), ...(imgs.length ? { imgs } : {}) })
  }
  if (!items.length) return null
  // a list of pictures reads better as a gallery
  if (items.every((i) => i.imgs?.length === 1 && !i.sub)) return { t: 'gallery', items: items.map((i) => ({ ...i.imgs[0], ...(hasText(i.c) ? { cap: i.c } : {}) })) }
  return { t: tag(el) === 'ol' ? 'ol' : 'ul', items: items.map(({ imgs: _imgs, ...i }) => i) }
}

function table(el) {
  if (has(el, 'navbox') || el.querySelector('.navbox')) return []
  const rows = el.querySelectorAll('tr').filter((tr) => tr.closest('table') === el)
  const cells = rows.map((tr) => tr.childNodes.filter((c) => isEl(c) && (tag(c) === 'td' || tag(c) === 'th')))
  const images = el.querySelectorAll('img').length
  const flat = cells.flat()
  // Layout tables of pictures become galleries, captioned by their cells' text.
  if (images && images >= flat.length / 2) {
    const items = []
    for (const cell of flat) {
      const imgs = imagesIn(cell)
      const cap = tidy(inline(cell.childNodes))
      imgs.forEach((img, i) => items.push(i === 0 && !img.cap && hasText(cap) && !AI.test(textOf(cap)) ? { ...img, cap } : img))
    }
    return items.length ? [{ t: 'gallery', items }] : []
  }
  // A table with one cell is a box around content.
  if (flat.length === 1) return nested(flat[0].childNodes)
  const out = cells
    .map((row) => row.map((c) => ({ ...(tag(c) === 'th' ? { h: 1 } : {}), c: tidy(inline(c.childNodes)) })))
    .filter((row) => row.some((c) => hasText(c.c)))
  if (!out.length) return []
  const cap = el.querySelector('caption')
  return [{ t: 'table', rows: out, ...(cap ? { cap: tidy(inline(cap.childNodes)) } : {}) }]
}

/** Blocks inside a quote, tab or box: their headings become small ones. */
const nested = (nodes) => blocks(nodes).map((b) => (b.t === 'heading' ? { t: 'h', l: 4, c: b.c } : b))

function tabber(el) {
  const labels = el.querySelectorAll('.wds-tabs__tab-label, .tabbernav a').map((l) => l.text.trim())
  const panes = el.querySelectorAll('.wds-tab__content, .tabbertab').filter((p) => p.closest('.tabber, .wds-tabber') === el)
  const out = []
  panes.forEach((p, i) => {
    const label = labels[i] || p.getAttribute('title') || p.getAttribute('data-hash') || ''
    const inner = nested(p.childNodes)
    if (!inner.length) return
    if (label) out.push({ t: 'h', l: 4, c: [label] })
    out.push(...inner)
  })
  return out
}

export function headingOf(el) {
  const t = tag(el)
  let h = /^h[1-6]$/.test(t) ? el : null
  if (!h && has(el, 'mw-heading')) h = el.childNodes.find((n) => isEl(n) && /^h[1-6]$/.test(tag(n)))
  if (!h) return null
  const headline = h.querySelector('.mw-headline') ?? h
  const c = tidy(inline(headline.childNodes))
  return { t: 'heading', l: Number(tag(h)[1]), c, id: headline.id || h.id || '' }
}

/** Converts a run of sibling nodes to blocks. */
export function blocks(nodes) {
  const out = []
  let run = []
  const flush = () => {
    const c = tidy(run)
    if (hasText(c)) out.push({ t: 'p', c })
    run = []
  }
  for (const n of nodes) {
    if (n.nodeType === 3) {
      run.push(...inline([n]))
      continue
    }
    if (!isEl(n) || skipped(n)) continue
    const t = tag(n)
    const heading = headingOf(n)
    if (heading) {
      flush()
      out.push(heading)
      continue
    }
    if (isEmbed(n)) {
      flush()
      const v = videoOf(n)
      if (v) out.push(v)
      else note(`embed ${n.getAttribute('class') ?? t}`)
      continue
    }
    if (t === 'img') {
      flush()
      const img = imageOf(n)
      if (img) out.push({ t: 'img', img })
      continue
    }
    if (isGallery(n)) {
      flush()
      const items = imagesIn(n)
      if (items.length) out.push({ t: 'gallery', items })
      continue
    }
    if (isFrame(n)) {
      flush()
      out.push(...imageBlocks(n))
      continue
    }
    if (has(n, 'tabber') || has(n, 'wds-tabber')) {
      flush()
      out.push(...tabber(n))
      continue
    }
    if (t === 'p') {
      flush()
      // pictures set straight into a paragraph come after its text
      const pics = n.childNodes.filter((c) => isEl(c) && (isFrame(c) || (tag(c) === 'a' && c.querySelector('img')) || tag(c) === 'img' || (tag(c) === 'span' && c.querySelector('img'))))
      const c = tidy(inline(n.childNodes.filter((x) => !pics.includes(x))))
      if (hasText(c)) out.push({ t: 'p', c })
      const imgs = pics.flatMap((x) => (tag(x) === 'img' ? [imageOf(x)].filter(Boolean) : imagesIn(x)))
      if (imgs.length === 1) out.push({ t: 'img', img: imgs[0] })
      else if (imgs.length > 1) out.push({ t: 'gallery', items: imgs })
      continue
    }
    if (t === 'ul' || t === 'ol') {
      flush()
      const l = list(n)
      if (l) out.push(l)
      continue
    }
    if (t === 'dl') {
      flush()
      for (const d of n.childNodes) {
        if (!isEl(d)) continue
        if (tag(d) === 'dt') {
          const c = tidy(inline(d.childNodes))
          if (hasText(c)) out.push({ t: 'h', l: 4, c })
        } else if (tag(d) === 'dd') out.push(...nested(d.childNodes))
      }
      continue
    }
    if (t === 'blockquote' || has(n, 'quote') || has(n, 'pquote')) {
      flush()
      const c = nested(n.childNodes)
      if (c.length) out.push({ t: 'quote', c })
      continue
    }
    if (t === 'table') {
      flush()
      out.push(...table(n))
      continue
    }
    if (t === 'pre') {
      flush()
      const c = n.text.trim()
      if (c) out.push({ t: 'p', c: [c] })
      continue
    }
    if (t === 'hr') continue
    if (INLINE.has(t)) {
      // an inline element holding a picture (mw:File spans, bare image links)
      if (n.querySelector('img') && (t === 'a' || t === 'span')) {
        flush()
        out.push(...imageBlocks(n))
      } else run.push(...inline([n]))
      continue
    }
    if (!['div', 'section', 'center', 'article', 'main', 'header', 'footer', 'font', 'figure'].includes(t)) note(`<${t}>`)
    const cls = n.getAttribute('class')
    if (cls && t === 'div') for (const c of cls.split(/\s+/)) if (c) note(`div.${c}`)
    flush()
    out.push(...blocks(n.childNodes))
  }
  flush()
  return out
}

const slugId = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/**
 * The whole article: the lead (before the first heading) and its sections.
 * Sections start at the article's top heading level; lower headings stay inside.
 */
export function article(html) {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } })
  const body = root.querySelector('.mw-parser-output') ?? root
  const flat = blocks(body.childNodes)
  const top = Math.min(...flat.filter((b) => b.t === 'heading').map((b) => b.l), 99)
  const lead = []
  const sections = []
  let current = null
  for (const b of flat) {
    if (b.t === 'heading' && b.l === top) {
      const title = textOf(b.c).trim()
      current = { title, id: b.id ? slugId(b.id) : slugId(title), blocks: [] }
      sections.push(current)
      continue
    }
    const block = b.t === 'heading' ? { t: 'h', l: b.l > top + 1 ? 4 : 3, c: b.c } : b
    ;(current ? current.blocks : lead).push(block)
  }
  const kept = sections.filter((s) => s.title && !SKIP_SECTION.test(s.title) && s.blocks.some((b) => b.t !== 'h'))
  // headings with nothing of their own after them
  const prune = (bs) => bs.filter((b, i) => b.t !== 'h' || (bs[i + 1] && (bs[i + 1].t !== 'h' || bs[i + 1].l > b.l)))
  for (let k = 0; k < 3; k++) for (const s of kept) s.blocks = prune(s.blocks)
  const leadKept = prune(prune(lead))
  // unique ids
  const ids = new Set()
  for (const s of kept) {
    let id = s.id || 'section'
    for (let k = 2; ids.has(id); k++) id = `${s.id}-${k}`
    ids.add(id)
    s.id = id
  }
  return { lead: leadKept, sections: kept.filter((s) => s.blocks.length) }
}

/** Every wiki link target in some blocks, for resolving redirects. */
export function linkTitles(value, out = new Set()) {
  if (Array.isArray(value)) for (const v of value) linkTitles(v, out)
  else if (value && typeof value === 'object') {
    if (value.t === 'a' && value.w) out.add(value.w)
    for (const v of Object.values(value)) if (typeof v === 'object') linkTitles(v, out)
  }
  return out
}

/** Replaces wiki link targets: `resolve(title)` returns { id } for an app page, { href } for the wiki, or null for plain text. */
export function relink(value, resolve) {
  if (Array.isArray(value)) {
    const out = []
    for (const v of value) {
      if (v && typeof v === 'object' && v.t === 'a' && v.w) {
        const r = resolve(v.w)
        const c = relink(v.c, resolve)
        if (r) out.push({ t: 'a', c, ...r })
        else out.push(...c)
      } else out.push(relink(v, resolve))
    }
    return out
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, relink(v, resolve)]))
  return value
}
