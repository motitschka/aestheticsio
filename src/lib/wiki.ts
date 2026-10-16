// The full Aesthetics Wiki articles, one JSON file per aesthetic in public/wiki/
// (scripts/fetch-wiki.mjs). Loaded when a wiki page opens; until an article has
// been fetched, the page shows the facts that ship with the app.

/** Text with marks and links. A link goes to an app wiki page (id) or a website (href). */
export type Inline = string | { t: 'br' } | { t: 'b'; c: Inline[] } | { t: 'i'; c: Inline[] } | { t: 'a'; c: Inline[]; id?: string; href?: string }

export interface WikiImage {
  /** Full-size Fandom address (the app asks for a scaled copy) */
  src: string
  w?: number
  h?: number
  cap?: Inline[]
  /** A video: the address is its still, this its page on the wiki */
  v?: string
}

export interface ListItem {
  c: Inline[]
  sub?: ListBlock[]
}

export type ListBlock = { t: 'ul' | 'ol'; items: ListItem[] }

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'h'; l: 3 | 4; c: Inline[] }
  | ListBlock
  | { t: 'quote'; c: Block[] }
  | { t: 'img'; img: WikiImage; side?: 'left' | 'center' }
  | { t: 'gallery'; items: WikiImage[] }
  | { t: 'table'; rows: { h?: 1; c: Inline[] }[][]; cap?: Inline[] }
  | { t: 'video'; href: string; yt?: string; cap?: Inline[] }

export interface WikiSection {
  title: string
  id: string
  blocks: Block[]
}

export interface WikiArticle {
  id: string
  title: string
  url: string
  rev: number
  /** yyyy-mm-dd */
  fetched: string
  lead: Block[]
  sections: WikiSection[]
}

const cache = new Map<string, Promise<WikiArticle | null>>()

/** The article, or null when it hasn't been fetched (or can't be loaded right now). */
export function loadArticle(id: string): Promise<WikiArticle | null> {
  let p = cache.get(id)
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}wiki/${id}.json`)
      .then(async (res) => {
        if (!res.ok) return null
        const json = (await res.json()) as WikiArticle
        return json && json.id === id && Array.isArray(json.sections) ? json : null
      })
      .catch(() => null)
    // A failed load (offline) can be tried again next time.
    p.then((a) => {
      if (!a) cache.delete(id)
    })
    cache.set(id, p)
  }
  return p
}

export const plainText = (c: Inline[]): string => c.map((x) => (typeof x === 'string' ? x : x.t === 'br' ? ' ' : plainText(x.c))).join('')

/** Every image in some blocks, in order. */
export function imagesOf(blocks: Block[]): WikiImage[] {
  return blocks.flatMap((b) => (b.t === 'img' ? [b.img] : b.t === 'gallery' ? b.items : b.t === 'quote' ? imagesOf(b.c) : []))
}

// ---------- routes ----------

/** `#/wiki` is the index, `#/wiki/<id>` an article. */
export type WikiRoute = { id: string | null }

export function parseRoute(hash: string): WikiRoute | null {
  const m = hash.match(/^#\/wiki(?:\/([a-z0-9-]+))?\/?$/)
  return m ? { id: m[1] ?? null } : null
}

export const wikiHref = (id?: string) => (id ? `#/wiki/${id}` : '#/wiki')
