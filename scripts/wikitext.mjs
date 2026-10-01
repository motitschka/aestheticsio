// Small, forgiving wikitext helpers for the Aesthetics Wiki pages.

/** Index just past the `}}` that closes the template opening at `start`, or -1. */
function templateEnd(text, start) {
  let depth = 0
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++
      i++
    } else if (text[i] === '}' && text[i + 1] === '}') {
      depth--
      i++
      if (depth === 0) return i + 1
    }
  }
  return -1
}

/** Removes every {{template}}, including nested and multi-line ones. */
export function stripTemplates(text) {
  let out = ''
  let i = 0
  while (i < text.length) {
    const open = text.indexOf('{{', i)
    if (open < 0) break
    const end = templateEnd(text, open)
    if (end < 0) break
    out += text.slice(i, open)
    i = end
  }
  return out + text.slice(i)
}

/** Splits on `sep` only where it isn't inside [[links]], {{templates}}, (parentheses) or "quotes". */
function splitTopLevel(text, sep) {
  const parts = []
  let depth = 0
  let last = 0
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2)
    if (text[i] === '"' || text[i] === '“' || text[i] === '”') {
      quoted = text[i] === '“' ? true : text[i] === '”' ? false : !quoted
      // American-style "a," b: the comma inside the closing quote separates items.
      if (!quoted && depth <= 0 && text.startsWith(sep, i - sep.length)) {
        parts.push(text.slice(last, i - sep.length) + text[i])
        last = i + 1
      }
    } else if (quoted) continue
    else if (two === '[[' || two === '{{') {
      depth++
      i++
    } else if (two === ']]' || two === '}}') {
      depth--
      i++
    } else if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    else if (depth <= 0 && text.startsWith(sep, i)) {
      parts.push(text.slice(last, i))
      last = i + sep.length
    }
  }
  parts.push(text.slice(last))
  return parts
}

/** The {{Aesthetic ...}} infobox as { field: rawValue } plus where it ends. */
export function parseInfobox(wikitext) {
  const m = /\{\{\s*Aesthetic\s*\n?\s*\|/i.exec(wikitext)
  if (!m) return { fields: {}, end: 0 }
  const end = templateEnd(wikitext, m.index)
  if (end < 0) return { fields: {}, end: 0 }
  const inner = wikitext.slice(m.index + 2, end - 2)
  const fields = {}
  for (const part of splitTopLevel(inner, '|').slice(1)) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const key = part.slice(0, eq).trim().toLowerCase()
    const value = part.slice(eq + 1).trim()
    if (key && value) fields[key] = value
  }
  return { fields, end }
}

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&ndash;': '–', '&mdash;': '—', '&lt;': '<', '&gt;': '>' }

/** Wikitext → plain text. Line breaks (<br>, newlines) are kept as \n. */
export function plain(text) {
  return stripTemplates(text)
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
    .replace(/\[https?:\/\/\S+\]/g, '')
    .replace(/'{2,}/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Pink, blue<br>Gold (antique, aged)" → ["Pink", "Blue", "Gold (antique, aged)"] */
export function plainList(raw, max = 8) {
  const items = []
  for (const line of plain(raw).split('\n')) {
    for (const part of splitTopLevel(line, ',').flatMap((p) => splitTopLevel(p, ';'))) {
      const item = part.replace(/^[\s•*\-–]+|[\s.]+$/g, '').replace(/^(and|or) /i, '')
      if (item && !/^(and|or)$/i.test(item) && item.length <= 80 && !items.some((x) => x.toLowerCase() === item.toLowerCase())) items.push(capitalise(item))
    }
  }
  return items.slice(0, max)
}

/** Link targets in a field, e.g. related_aesthetics: "[[Art Nouveau]]<br>[[Bauhaus|the Bauhaus]]" → ["Art Nouveau", "Bauhaus"] */
export function linkTargets(raw) {
  return [...stripTemplates(raw).matchAll(/\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]*)?\]\]/g)]
    .map((m) => m[1].trim().replace(/_/g, ' '))
    .filter((t) => !/^(File|Image|Category):/i.test(t))
}

/** First decade mentioned: "Mid-1970s (Music)\n1980s (Art)" → 1970. */
export function decadeYear(text) {
  const m = /\b(1[0-9]{3}|20[0-9]{2})(?:s|\b)/.exec(text)
  if (!m) return undefined
  const year = Number(m[1])
  return year >= 1000 && year <= 2030 ? Math.floor(year / 10) * 10 : undefined
}

/** The opening paragraphs after the infobox, as plain text (about 250–700 characters). */
export function introText(wikitext, infoboxEnd) {
  const body = stripTemplates(wikitext.slice(infoboxEnd))
  const paragraphs = []
  let length = 0
  for (const block of body.split(/\n\s*\n|\n(?===)/)) {
    const first = block.trim()
    if (!first) continue
    if (first.startsWith('==')) {
      if (paragraphs.length) break
      continue
    }
    if (/^(\[\[(File|Image|Category):|<gallery|\{\||\||\*|#|:|__)/i.test(first)) continue
    const text = plain(first).replace(/\n+/g, ' ').trim()
    if (text.length < 40) continue
    paragraphs.push(text)
    length += text.length
    if (length >= 250) break
  }
  let intro = paragraphs.join('\n\n')
  if (intro.length > 700) {
    const cut = intro.slice(0, 700)
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'))
    intro = stop > 200 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…'
  }
  return intro
}
