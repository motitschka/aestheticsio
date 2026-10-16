import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ERAS, eraOf, journeyOrder } from '../lib/eras'
import { SIZE, thumb } from '../lib/images'
import { lessonState, type LessonState } from '../lib/progress'
import { pinThumb, pinUrl, themeUnlocked, type Theme, type Themes } from '../lib/theme'
import { imagesOf, loadArticle, plainText, wikiHref, type Block, type Inline, type WikiArticle, type WikiImage, type WikiSection } from '../lib/wiki'
import type { Aesthetic, Entry } from '../types'
import { Moodboard } from './Moodboard'
import { Photo } from './Photo'
import { StateBadge } from './StateBadge'

const LICENSE = 'https://creativecommons.org/licenses/by-sa/3.0/'
const fandomUrl = (name: string) => `https://aesthetics.fandom.com/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`

function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const change = () => setOn(m.matches)
    change()
    m.addEventListener('change', change)
    return () => m.removeEventListener('change', change)
  }, [query])
  return on
}

// ---------- the index ----------

interface IndexProps {
  aesthetics: Aesthetic[]
  themes: Themes | null
}

/** Every aesthetic's wiki page, by era, searchable. */
export function WikiIndex({ aesthetics, themes }: IndexProps) {
  const [query, setQuery] = useState('')
  const ordered = useMemo(() => journeyOrder(aesthetics), [aesthetics])
  const q = query.trim().toLowerCase()
  const shown = q ? ordered.filter((a) => a.name.toLowerCase().includes(q) || a.aliases?.some((x) => x.toLowerCase().includes(q))) : ordered
  const random = () => {
    const a = aesthetics[Math.floor(Math.random() * aesthetics.length)]
    if (a) location.hash = wikiHref(a.id)
  }

  return (
    <section className="page wiki-index">
      <Moodboard from={8} />
      <h1 className="title">Wiki</h1>
      <p className="muted small">
        All {aesthetics.length} aesthetics in detail, from the Aesthetics Wiki. Every page wears its own aesthetic’s theme.
      </p>
      <div className="wiki-tools">
        <input className="input" type="search" placeholder="Search the wiki" aria-label="Search the wiki" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn btn-secondary btn-small" onClick={random}>
          Random page
        </button>
      </div>
      {ERAS.map((era, i) => {
        const inEra = shown.filter((a) => eraOf(a) === i)
        if (!inEra.length) return null
        return (
          <section key={era.short} className="era-group" aria-label={era.label}>
            <h2 className="era-heading">
              <span>{era.label}</span>
              <span className="small tabular muted">{inEra.length}</span>
            </h2>
            <ul className="wiki-cards">
              {inEra.map((a) => (
                <li key={a.id}>
                  <WikiCard a={a} theme={themes?.[a.id]} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {shown.length === 0 && <p className="muted center empty">No aesthetic matches “{query.trim()}”.</p>}
    </section>
  )
}

function WikiCard({ a, theme }: { a: Aesthetic; theme?: Theme }) {
  return (
    <a className="wiki-card" href={wikiHref(a.id)}>
      <span className="wiki-card-img">
        <img src={pinThumb(a.id)} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="wiki-card-text">
        <span className="wiki-card-name">{a.name}</span>
        {a.decade && <span className="muted small">{a.decade}</span>}
      </span>
      {theme && (
        <span className="wiki-card-swatches" aria-hidden>
          {theme.swatches.slice(0, 5).map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </span>
      )}
    </a>
  )
}

// ---------- an article ----------

interface ArticleProps {
  a: Aesthetic
  /** The aesthetic's own theme: the page always wears it. */
  theme: Theme
  all: Aesthetic[]
  entry: Entry | undefined
  now: number
  themeInUse: boolean
  onUseTheme(id: string): void
  onLesson(a: Aesthetic): void
}

type Zoom = { src: string; cap?: Inline[]; local?: boolean }

const isMedia = (b: Block) => b.t === 'img' || b.t === 'gallery' || b.t === 'video'

export function WikiPage({ a, theme, all, entry, now, themeInUse, onUseTheme, onLesson }: ArticleProps) {
  // undefined while loading; null when there's no fetched article (the facts that ship with the app stand in)
  const [article, setArticle] = useState<WikiArticle | null | undefined>(undefined)
  const [zoom, setZoom] = useState<Zoom | null>(null)
  const wide = useMedia('(min-width: 1700px)')
  const onZoom = useCallback((z: Zoom) => setZoom(z), [])
  const closeZoom = useCallback(() => setZoom(null), [])

  useEffect(() => {
    let live = true
    loadArticle(a.id).then((x) => live && setArticle(x))
    return () => {
      live = false
    }
  }, [a.id])

  const era = eraOf(a)
  const order = useMemo(() => journeyOrder(all), [all])
  const at = order.findIndex((x) => x.id === a.id)
  const prev = order[at - 1]
  const next = order[at + 1]
  const state = lessonState(entry, now)
  const unlocked = themeUnlocked(entry)

  // The lead's first paragraph opens the page; the rest of it is the overview.
  const lead = article?.lead ?? []
  const first = lead.findIndex((b) => b.t === 'p')
  const opening = first >= 0 ? [lead[first]] : []
  const overview = lead.filter((_, i) => i !== first)
  const fallback: WikiSection[] = article === null ? [{ title: 'Pictures', id: 'pictures', blocks: [{ t: 'gallery', items: a.images.map((src) => ({ src })) }] }] : []
  const sections = article ? [...(overview.some((b) => !isMedia(b)) ? [{ title: 'Overview', id: 'lead-overview', blocks: overview }] : []), ...article.sections] : fallback
  const inArticle = useMemo(() => new Set(article ? imagesOf([...article.lead, ...article.sections.flatMap((s) => s.blocks)]).map((i) => i.src) : []), [article])
  // Wiki pictures the article doesn't show itself (the ones lessons use) join the gallery at the end.
  const extra = article ? a.images.filter((src) => !inArticle.has(src)) : []

  const pins = Array.from({ length: theme.pins }, (_, i) => i + 1).filter((n) => !theme.repeats?.includes(n))
  const byName = useMemo(() => new Map(all.map((x) => [x.name.toLowerCase(), x])), [all])
  const related = (a.related ?? []).map((name) => ({ name, match: byName.get(name.toLowerCase()) }))
  const sameEra = order.filter((x) => eraOf(x) === era && x.id !== a.id)

  const toc = [
    ...sections.map((s) => ({ id: `w-${s.id}`, title: s.title })),
    ...(extra.length ? [{ id: 'w-more', title: 'More pictures' }] : []),
    ...(pins.length ? [{ id: 'w-pins', title: 'Pinboard' }] : []),
    ...(related.length ? [{ id: 'w-related', title: 'Related aesthetics' }] : []),
    { id: 'w-era', title: ERAS[era].label },
    { id: 'w-theme', title: 'The theme' },
  ]

  return (
    <article className="wiki">
      <div className="wiki-bar wiki-sheet">
        <a className="link" href={wikiHref()}>
          ← All aesthetics
        </a>
        <JourneyLinks prev={prev} next={next} />
      </div>

      <header className="wiki-hero wiki-sheet">
        <div className="wiki-hero-text">
          <p className="eyebrow">{a.decade ?? ERAS[era].label}</p>
          <h1 className="wiki-title">{a.name}</h1>
          {a.aliases?.length ? <p className="muted">Also known as {a.aliases.join(', ')}</p> : null}
          <div className="wiki-lead">
            {opening.length ? <Blocks blocks={opening} onZoom={onZoom} /> : a.intro?.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="wiki-hero-actions">
            <button className="btn btn-primary" onClick={() => onLesson(a)}>
              {state === 'new' ? 'Take the lesson' : 'Open the lesson'}
            </button>
            <a className="link" href={article?.url ?? a.wiki} target="_blank" rel="noreferrer">
              On the Aesthetics Wiki ↗
            </a>
          </div>
        </div>
        <div className="wiki-mosaic">
          {a.images.slice(0, 5).map((src, i) => (
            <MosaicTile key={src} src={src} pin={pinUrl(theme, i + 1)} large={i === 0} label={`Enlarge picture ${i + 1} of ${a.name}`} onZoom={onZoom} />
          ))}
        </div>
      </header>

      <div className="wiki-body">
        <aside className="wiki-info" aria-label={`${a.name} at a glance`}>
          <Facts a={a} />
          <LessonCard a={a} state={state} onLesson={onLesson} />
        </aside>

        <nav className="wiki-toc wiki-sheet" aria-label="Contents">
          <p className="wiki-toc-title">Contents</p>
          <ol>
            {toc.map((t) => (
              <li key={t.id}>
                <button onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t.title}</button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="wiki-main wiki-sheet">
          {article === undefined && <p className="muted">Loading the full article…</p>}
          {sections.map((s) => (
            <SectionView key={s.id} s={s} wide={wide} onZoom={onZoom} />
          ))}
          {extra.length > 0 && (
            <section className="wiki-section" id="w-more">
              <h2 className="wiki-h2">More pictures</h2>
              <Gallery items={extra.map((src) => ({ src }))} onZoom={onZoom} />
            </section>
          )}
          {article === null && <p className="muted small">The full article hasn’t been downloaded into the app yet; read it on the Aesthetics Wiki.</p>}
        </div>
      </div>

      {pins.length > 0 && (
        <section className="wiki-sheet wiki-extra" id="w-pins">
          <h2 className="wiki-h2">Pinboard</h2>
          <p className="muted small">The Pinterest board this page’s theme was made from.</p>
          <div className="wiki-pins">
            {pins.map((n) => (
              <button key={n} className="wiki-pin" onClick={() => onZoom({ src: pinUrl(theme, n), local: true })} aria-label={`Enlarge pin ${n}`}>
                <img src={pinUrl(theme, n)} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="wiki-sheet wiki-extra" id="w-related">
          <h2 className="wiki-h2">Related aesthetics</h2>
          <ul className="wiki-cards">
            {related
              .filter((r) => r.match)
              .map(({ match }) => (
                <li key={match!.id}>
                  <WikiCard a={match!} />
                </li>
              ))}
          </ul>
          {related.some((r) => !r.match) && (
            <>
              <p className="muted small">Elsewhere on the Aesthetics Wiki:</p>
              <ul className="chips">
                {related
                  .filter((r) => !r.match)
                  .map(({ name }) => (
                    <li key={name}>
                      <a className="chip" href={fandomUrl(name)} target="_blank" rel="noreferrer">
                        {name} ↗
                      </a>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="wiki-sheet wiki-extra" id="w-era">
        <h2 className="wiki-h2">Also from {ERAS[era].label.replace(/^The /, 'the ')}</h2>
        <ul className="chips">
          {sameEra.map((x) => (
            <li key={x.id}>
              <a className="chip" href={wikiHref(x.id)}>
                {x.name}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <ThemeShowcase a={a} theme={theme} unlocked={unlocked} inUse={themeInUse} onUse={() => onUseTheme(a.id)} />

      <footer className="wiki-sheet wiki-credit">
        <JourneyLinks prev={prev} next={next} />
        <p className="muted small">
          Text from the article{' '}
          <a className="link" href={article?.url ?? a.wiki} target="_blank" rel="noreferrer">
            {article?.title ?? a.name}
          </a>{' '}
          on the Aesthetics Wiki
          {article ? `, as of ${new Date(article.fetched).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}, by{' '}
          <a className="link" href={`${article?.url ?? a.wiki}?action=history`} target="_blank" rel="noreferrer">
            its contributors
          </a>
          , under{' '}
          <a className="link" href={LICENSE} target="_blank" rel="noreferrer">
            CC BY-SA 3.0
          </a>
          , rearranged for this page. Pictures are shown from the wiki’s own servers; the pinboard is from Pinterest.
        </p>
      </footer>

      {zoom && <Lightbox zoom={zoom} onClose={closeZoom} />}
    </article>
  )
}

/** A wiki picture, or the theme's pin in its place when the wiki's servers can't be reached. */
function MosaicTile({ src, pin, large, label, onZoom }: { src: string; pin: string; large: boolean; label: string; onZoom(z: Zoom): void }) {
  const [failed, setFailed] = useState(false)
  return (
    <button className="wiki-mosaic-tile" onClick={() => onZoom(failed ? { src: pin, local: true } : { src })} aria-label={label}>
      {failed ? <img className="wiki-mosaic-pin" src={pin} alt="" decoding="async" /> : <Photo src={src} width={large ? SIZE.large : SIZE.medium} alt="" onFail={() => setFailed(true)} />}
    </button>
  )
}

function JourneyLinks({ prev, next }: { prev?: Aesthetic; next?: Aesthetic }) {
  return (
    <nav className="wiki-journey small" aria-label="Along the journey">
      {prev && (
        <a className="link" href={wikiHref(prev.id)}>
          ← {prev.name}
        </a>
      )}
      {next && (
        <a className="link" href={wikiHref(next.id)}>
          {next.name} →
        </a>
      )}
    </nav>
  )
}

const cssColour = (name: string) => {
  const c = name.toLowerCase().replace(/\s+/g, '')
  return typeof CSS !== 'undefined' && CSS.supports('color', c) ? c : null
}

function Facts({ a }: { a: Aesthetic }) {
  const row = (label: string, value: ReactNode) => (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
  return (
    <div className="card wiki-facts">
      <h2 className="wiki-box-title">{a.name}</h2>
      <dl className="wiki-dl">
        {a.aliases?.length ? row('Other names', a.aliases.join(', ')) : null}
        {a.decade && row('Decade of origin', a.decade)}
        {row('On the journey', ERAS[eraOf(a)].label)}
        {a.origin && row('Location of origin', a.origin)}
        {a.motifs?.length
          ? row(
              'Key motifs',
              <ul className="wiki-plain">
                {a.motifs.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>,
            )
          : null}
        {a.colours?.length
          ? row(
              'Key colours',
              <ul className="chips">
                {a.colours.map((c) => {
                  const swatch = cssColour(c)
                  return (
                    <li key={c} className="chip colour-chip">
                      {swatch && <span className="swatch" style={{ background: swatch }} />}
                      {c}
                    </li>
                  )
                })}
              </ul>,
            )
          : null}
        {a.values?.length
          ? row(
              'Key values',
              <ul className="chips">
                {a.values.map((v) => (
                  <li key={v} className="chip">
                    {v}
                  </li>
                ))}
              </ul>,
            )
          : null}
      </dl>
    </div>
  )
}

const LESSON_NOTE: Record<LessonState, string> = {
  new: 'Not started. The lesson shows what makes it, then checks you can tell it from its close relatives.',
  seen: 'Seen. Answer every check right in one go to learn it.',
  learned: 'Learned. Do it perfectly again after a month to master it.',
  ready: 'Ready to master: answer every check right now.',
  mastered: 'Mastered for good.',
}

function LessonCard({ a, state, onLesson }: { a: Aesthetic; state: LessonState; onLesson(a: Aesthetic): void }) {
  return (
    <div className="card wiki-lesson">
      <h2 className="wiki-box-title">Your lesson</h2>
      <StateBadge state={state} />
      <p className="muted small">{LESSON_NOTE[state]}</p>
      <button className="btn btn-secondary" onClick={() => onLesson(a)}>
        {state === 'new' ? 'Take the lesson' : 'Open the lesson'}
      </button>
    </div>
  )
}

const BODY_NAME: Record<string, string> = { system: 'the system sans-serif' }

function ThemeShowcase({ a, theme, unlocked, inUse, onUse }: { a: Aesthetic; theme: Theme; unlocked: boolean; inUse: boolean; onUse(): void }) {
  const c = theme.colours
  const palette: [string, string][] = [
    ['Ground', c.bg],
    ['Surface', c.surface],
    ['Text', c.text],
    ['Accent', c.accent],
    ['Accent text', c.accentText],
    ...theme.swatches.map((s, i): [string, string] => [`Pin colour ${i + 1}`, s]),
  ]
  return (
    <section className="wiki-sheet wiki-extra wiki-theme" id="w-theme">
      <h2 className="wiki-h2">The {a.name} theme</h2>
      <p>
        This page wears the theme made from the {a.name} pinboard: its colours, type, shapes and the collage behind it.{' '}
        {inUse ? 'It dresses your whole app right now.' : unlocked ? 'You’ve unlocked it, so you can wear it across the whole app.' : `Learn ${a.name} to unlock it for the whole app.`}
      </p>
      <div className="wiki-specimen">
        <span className="wiki-specimen-big" aria-hidden>
          Aa
        </span>
        <dl className="wiki-dl">
          <div>
            <dt>Display type</dt>
            <dd className="wiki-display-sample">{theme.font}</dd>
          </div>
          <div>
            <dt>Body type</dt>
            <dd>{BODY_NAME[theme.body] ?? theme.body}</dd>
          </div>
          <div>
            <dt>Shapes</dt>
            <dd>
              {theme.layout} layout · {theme.buttons} buttons · {theme.icons} icons · {theme.motion} motion · {theme.pattern} pattern
            </dd>
          </div>
        </dl>
      </div>
      <ul className="wiki-palette">
        {palette.map(([label, colour]) => (
          <li key={label}>
            <span className="wiki-palette-chip" style={{ background: colour }} />
            <span className="small">
              {label}
              <br />
              <code>{colour}</code>
            </span>
          </li>
        ))}
      </ul>
      {unlocked && !inUse && (
        <button className="btn btn-secondary" onClick={onUse}>
          Use the {a.name} theme
        </button>
      )}
    </section>
  )
}

// ---------- article content ----------

function SectionView({ s, wide, onZoom }: { s: WikiSection; wide: boolean; onZoom(z: Zoom): void }) {
  const media = s.blocks.filter(isMedia)
  const text = s.blocks.filter((b) => !isMedia(b))
  const split = wide && media.length > 0 && text.length > 0
  // Text-only sections run in two columns on very wide screens, so lines stay readable.
  const long = !media.length && text.reduce((n, b) => n + JSON.stringify(b).length, 0) > 1000
  return (
    <section className="wiki-section" id={`w-${s.id}`}>
      <h2 className="wiki-h2">{s.title}</h2>
      {split ? (
        <div className="wiki-split">
          <div className="wiki-text">
            <Blocks blocks={text} onZoom={onZoom} />
          </div>
          <div className="wiki-media">
            <Blocks blocks={media} onZoom={onZoom} inRail />
          </div>
        </div>
      ) : (
        <div className={`wiki-flow ${wide && long ? 'is-columns' : ''}`}>
          <Blocks blocks={s.blocks} onZoom={onZoom} />
        </div>
      )}
    </section>
  )
}

function Blocks({ blocks, onZoom, inRail = false }: { blocks: Block[]; onZoom(z: Zoom): void; inRail?: boolean }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} onZoom={onZoom} inRail={inRail} />
      ))}
    </>
  )
}

function BlockView({ b, onZoom, inRail }: { b: Block; onZoom(z: Zoom): void; inRail: boolean }) {
  switch (b.t) {
    case 'p':
      return (
        <p className="wiki-p">
          <Inlines c={b.c} />
        </p>
      )
    case 'h':
      return b.l === 3 ? (
        <h3 className="wiki-h3">
          <Inlines c={b.c} />
        </h3>
      ) : (
        <h4 className="wiki-h4">
          <Inlines c={b.c} />
        </h4>
      )
    case 'ul':
    case 'ol': {
      const items = b.items.map((li, i) => (
        <li key={i}>
          <Inlines c={li.c} />
          {li.sub?.map((sub, j) => (
            <BlockView key={j} b={sub} onZoom={onZoom} inRail={inRail} />
          ))}
        </li>
      ))
      return b.t === 'ol' ? <ol className="wiki-list">{items}</ol> : <ul className="wiki-list">{items}</ul>
    }
    case 'quote':
      return (
        <blockquote className="wiki-quote">
          <Blocks blocks={b.c} onZoom={onZoom} />
        </blockquote>
      )
    case 'img':
      return <Figure img={b.img} side={inRail ? 'rail' : (b.side ?? 'right')} onZoom={onZoom} />
    case 'gallery':
      return <Gallery items={b.items} onZoom={onZoom} />
    case 'table':
      return (
        <div className="wiki-table-wrap">
          <table className="wiki-table">
            {b.cap && (
              <caption>
                <Inlines c={b.cap} />
              </caption>
            )}
            <tbody>
              {b.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => {
                    const inner = (
                      <>
                        {cell.imgs?.map((img) => (
                          <Figure key={img.src} img={img} side="cell" size={SIZE.medium} onZoom={onZoom} />
                        ))}
                        <Inlines c={cell.c} />
                      </>
                    )
                    return cell.h ? <th key={j}>{inner}</th> : <td key={j}>{inner}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'video':
      return (
        <a className="wiki-video" href={b.href} target="_blank" rel="noreferrer">
          <span>
            <span className="wiki-video-play" aria-hidden>
              ▶
            </span>{' '}
            {b.cap ? plainText(b.cap) : /youtube/.test(b.href) ? 'Watch on YouTube' : 'Listen on Spotify'} ↗
          </span>
        </a>
      )
  }
}

function Inlines({ c }: { c: Inline[] }) {
  return (
    <>
      {c.map((x, i) => {
        if (typeof x === 'string') return <Fragment key={i}>{x}</Fragment>
        if (x.t === 'br') return <br key={i} />
        if (x.t === 'b')
          return (
            <strong key={i}>
              <Inlines c={x.c} />
            </strong>
          )
        if (x.t === 'i')
          return (
            <em key={i}>
              <Inlines c={x.c} />
            </em>
          )
        if (x.id)
          return (
            <a key={i} className="wiki-link" href={wikiHref(x.id)}>
              <Inlines c={x.c} />
            </a>
          )
        if (x.href)
          return (
            <a key={i} className="wiki-link" href={x.href} target="_blank" rel="noreferrer">
              <Inlines c={x.c} />
            </a>
          )
        return <Inlines key={i} c={x.c} />
      })}
    </>
  )
}

function Figure({ img, side, onZoom, size = 640 }: { img: WikiImage; side: 'right' | 'left' | 'center' | 'rail' | 'tile' | 'cell'; onZoom(z: Zoom): void; size?: number }) {
  const [failed, setFailed] = useState(false)
  // A picture that won't load is left out; a video keeps its link.
  if (failed && !img.v) return null
  const caption = img.cap ? plainText(img.cap) : ''
  const picture = !failed && (
    <img
      src={thumb(img.src, size)}
      alt={img.v ? '' : caption}
      loading="lazy"
      decoding="async"
      style={side !== 'tile' && img.w && img.h ? { aspectRatio: `${img.w} / ${img.h}` } : undefined}
      onError={() => setFailed(true)}
    />
  )
  return (
    <figure className={`wiki-figure is-${side} ${img.v ? 'is-video' : ''} ${failed ? 'is-bare' : ''}`}>
      {img.v ? (
        <a className="wiki-zoom" href={img.v} target="_blank" rel="noreferrer" aria-label={`Watch on the Aesthetics Wiki${caption ? `: ${caption}` : ''}`}>
          {picture}
          <span className="wiki-play" aria-hidden>
            ▶
          </span>
        </a>
      ) : (
        <button className="wiki-zoom" onClick={() => onZoom({ src: img.src, cap: img.cap })} aria-label={caption ? `Enlarge: ${caption}` : 'Enlarge picture'}>
          {picture}
        </button>
      )}
      {(img.cap || img.v) && (
        <figcaption className="small">
          {img.cap ? <Inlines c={img.cap} /> : 'Video'}
          {img.v && ' · video ↗'}
        </figcaption>
      )}
    </figure>
  )
}

function Gallery({ items, onZoom }: { items: WikiImage[]; onZoom(z: Zoom): void }) {
  return (
    <div className="wiki-gallery">
      {items.map((img) => (
        <Figure key={img.src} img={img} side="tile" size={SIZE.medium} onZoom={onZoom} />
      ))}
    </div>
  )
}

function Lightbox({ zoom, onClose }: { zoom: Zoom; onClose(): void }) {
  // The control that opened it, taken before the close button grabs focus; focus goes back there.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)
  const box = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
      // Tab stays inside the picture
      if (e.key === 'Tab' && box.current) {
        const stops = [...box.current.querySelectorAll<HTMLElement>('a[href], button')]
        const at = stops.indexOf(document.activeElement as HTMLElement)
        if (!stops.length) return
        e.preventDefault()
        stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length].focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('keydown', key)
      opener?.focus?.()
    }
  }, [opener])
  // On the body: the page's sheets would otherwise hold it in place.
  return createPortal(
    <div ref={box} className="wiki-lightbox" role="dialog" aria-modal="true" aria-label="Picture" onClick={onClose}>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={zoom.local ? zoom.src : thumb(zoom.src, 1600)} alt={zoom.cap ? plainText(zoom.cap) : ''} />
        {zoom.cap && (
          <figcaption className="small">
            <Inlines c={zoom.cap} />
          </figcaption>
        )}
      </figure>
      <button className="icon-btn wiki-lightbox-close" onClick={onClose} aria-label="Close picture" autoFocus>
        ✕
      </button>
    </div>,
    document.body,
  )
}

/** Shown for a wiki address that names no aesthetic. */
export function WikiMissing() {
  return (
    <section className="page">
      <h1 className="title">No such page</h1>
      <p className="muted">This aesthetic isn’t in the wiki.</p>
      <a className="btn btn-secondary" href={wikiHref()}>
        All aesthetics
      </a>
    </section>
  )
}

/** Shown while the page's theme loads: a wiki page never appears in another theme. */
export function WikiWaiting({ failed }: { failed: boolean }) {
  return (
    <section className="page wiki-waiting">
      <p className="muted center">{failed ? 'Couldn’t load this page. Check your connection and reload.' : 'Loading…'}</p>
    </section>
  )
}

