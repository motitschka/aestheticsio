import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import indexCss from '../index.css?inline'
import themesCss from '../themes.css?inline'
import { loadAestheticsData, loadThemes } from '../data'
import { START_AS_GUEST_EVENT } from '../lib/intro-events'
import { emptyStats } from '../lib/progress'
import { buildPractice, type ChoiceQuestion, type InfoCard } from '../lib/questions'
import { applyTheme, type Theme, type Themes } from '../lib/theme'
import type { Aesthetic, SavedProgress } from '../types'
import { IntroMusic, type MusicPosition } from './introAudio'
import { IntroScreen, type Scene } from './IntroScreen'

/*
 * The first-visit intro. A timeline drives everything: a welcome on a wall of pins,
 * then the real app in a phone-sized frame: a quiz the visitor answers (it waits),
 * Frutiger Aero's lesson, its theme unlocking and taking over, Clovercore and Global
 * Village Coffeehouse flashing past, then "Start learning".
 *
 * Live mode runs on requestAnimationFrame. Video mode (dev only, ?intro-video=portrait
 * or landscape) is seeked frame by frame to render the shareable cut: no wiki photos
 * there, the quiz answers itself, and it ends on the name and address.
 */

export type IntroMode = 'live' | 'video'

const BASE = import.meta.env.BASE_URL
const SITE = 'motitschka.github.io/aestheticsio'
const FOLLOW = 'frutiger-aero'
/** The looks that flash past after Frutiger Aero, two beats each; the last one holds a little longer. */
const FLASH = ['clovercore', 'corporate-grunge', 'parisian-girly', 'jiggy-era', 'dollar-store-vernacular', 'utopian-scholastic', 'global-village-coffeehouse'] as const
const OPTIONS = ['art-deco', 'frutiger-aero', 'dorfic', 'y2k-futurism']

// ---------- the timeline (seconds) ----------
/** Before the answer: t. The quiz is ready by READY and waits from WAIT. */
const READY = 4.3
const WAIT = 4.8
/** The music loop that plays while it waits: two bars at 100 BPM. */
const LOOP = 4.8
/** The video cut answers by itself here. */
const VIDEO_ANSWER = 6.6
/** After the answer: τ. */
const flashAt = (i: number) => 9.4 + i * 1.2
const FLASH_END = flashAt(FLASH.length - 1) + 1.5
const P = {
  learn: 1.6, // quiz → lesson's first card
  continueTap: 3.6,
  make: 5.4, // → lesson finished, theme unlocked
  useTap: 6.9,
  home: 8.2, // → the app's home in Frutiger Aero
  end: FLASH_END,
  start: FLASH_END + 0.6, // "Start learning" (live) or the end card (video)
  videoEnd: FLASH_END + 3.2,
}
export const VIDEO_LENGTH = VIDEO_ANSWER + P.videoEnd

// ---------- easing ----------
const clamp = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const outCubic = (k: number) => 1 - (1 - k) ** 3
const inOutSine = (k: number) => -(Math.cos(Math.PI * k) - 1) / 2
const spring = (k: number) => (k >= 1 ? 1 : 1 - Math.exp(-6 * k) * Math.cos(10 * k))
const bounce = (k: number) => {
  const n = 7.5625, d = 2.75
  if (k < 1 / d) return n * k * k
  if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75
  if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375
  return n * (k -= 2.625 / d) * k + 0.984375
}
const p = (t: number, a: number, b: number, ease = outCubic) => ease(clamp((t - a) / (b - a)))

// ---------- layout: a design canvas scaled to the screen ----------
interface Box { x: number; y: number; w: number; h: number }
function computeLayout(W: number, H: number) {
  const portrait = W / H < 1
  const cw = portrait ? 390 : 1280
  const ch = portrait ? 844 : 800
  const s = Math.min(W / cw, H / ch)
  const ox = (W - cw * s) / 2
  const oy = (H - ch * s) / 2
  const box = (b: Box): Box => ({ x: ox + b.x * s, y: oy + b.y * s, w: b.w * s, h: b.h * s })
  const u = (n: number) => n * s
  return portrait
    ? {
        portrait, W, H, s, u,
        welcome: box({ x: 20, y: 296, w: 350, h: 244 }),
        step: box({ x: 14, y: 54, w: 362, h: 142 }),
        screen: box({ x: 14, y: 208, w: 362, h: 626 }),
        end: box({ x: 20, y: 322, w: 350, h: 200 }),
        f: { eyebrow: u(10), title: u(42), sub: u(15), head: u(42), stepSub: u(15), url: u(15) },
        pad: u(22), radius: u(24), cols: 4, boardCols: 4, cursor: u(26),
      }
    : {
        portrait, W, H, s, u,
        welcome: box({ x: 270, y: 232, w: 740, h: 336 }),
        step: box({ x: 52, y: 250, w: 640, h: 300 }),
        screen: box({ x: 752, y: 30, w: 410, h: 740 }),
        end: box({ x: 320, y: 290, w: 640, h: 220 }),
        f: { eyebrow: u(13), title: u(78), sub: u(23), head: u(74), stepSub: u(23), url: u(22) },
        pad: u(46), radius: u(32), cols: 7, boardCols: 8, cursor: u(30),
      }
}

const pin = (theme: Theme, n: number) => `${BASE}pins/${theme.id}/${String(((n - 1) % theme.pins) + 1).padStart(2, '0')}.webp`

// Styles inside the frame: the app's own CSS, plus the quiz's waiting pulse.
const FRAME_CSS = `${indexCss}\n${themesCss}
html { scrollbar-width: none; }
body { margin: 0; }
/* the quiz photo shrinks to the screen, so all four answers always show */
.quiz .quiz-image { aspect-ratio: auto; height: clamp(150px, calc(100vh - 384px), 460px); }
.intro-pulse .choice:not(:disabled) { animation: intro-pulse 1.6s ease-in-out infinite; }
@keyframes intro-pulse { 50% { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); } }
[data-intro-video] *, [data-intro-video] *::before, [data-intro-video] *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
[data-intro-video] .next-lesson { display: none !important; }
/* the video cut carries no wiki photos: the finished lesson's avatar is one */
[data-intro-video] .lesson-done > .avatar { display: none !important; }
`

interface Data {
  all: Aesthetic[]
  byId: Map<string, Aesthetic>
  themes: Themes
}

export function IntroPlayer({ mode, onDone }: { mode: IntroMode; onDone(): void }) {
  const [data, setData] = useState<Data | null>(null)
  const [size, setSize] = useState(() => ({ W: innerWidth, H: innerHeight }))
  const [muted, setMuted] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const L = computeLayout(size.W, size.H)
  const layout = useRef(L)
  useEffect(() => {
    layout.current = L
  })
  const video = mode === 'video'

  useEffect(() => {
    let live = true
    Promise.all([loadAestheticsData(), loadThemes()]).then(([d, themes]) => {
      if (live) setData({ all: d.items, byId: new Map(d.items.map((a) => [a.id, a])), themes })
    })
    const onResize = () => setSize({ W: innerWidth, H: innerHeight })
    window.addEventListener('resize', onResize)
    return () => {
      live = false
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // ---------- refs to everything the timeline moves ----------
  const r = {
    root: useRef<HTMLDivElement>(null),
    wall: useRef<HTMLDivElement>(null),
    veil: useRef<HTMLDivElement>(null),
    boards: useRef<HTMLDivElement>(null),
    screen: useRef<HTMLDivElement>(null),
    frame: useRef<HTMLIFrameElement>(null),
    welcome: useRef<HTMLDivElement>(null),
    name: useRef<HTMLDivElement>(null),
    learn: useRef<HTMLDivElement>(null),
    make: useRef<HTMLDivElement>(null),
    cursor: useRef<HTMLDivElement>(null),
    ripple: useRef<HTMLDivElement>(null),
    start: useRef<HTMLButtonElement>(null),
    endCard: useRef<HTMLDivElement>(null),
  }
  const music = useRef<IntroMusic | null>(null)
  const engine = useRef<{ position(): MusicPosition; answered: boolean } | null>(null)

  const finish = (startLearning: boolean) => {
    if (leaving) return
    try {
      localStorage.setItem('aesthetics:intro-seen', '1')
    } catch {
      // private mode: it just shows again next time
    }
    if (startLearning) window.dispatchEvent(new Event(START_AS_GUEST_EVENT))
    music.current?.stop()
    setLeaving(true)
    window.setTimeout(onDone, 500)
  }

  // ---------- the timeline ----------
  useEffect(() => {
    if (!data) return
    const frame = r.frame.current!
    const doc = frame.contentDocument!
    doc.open()
    doc.write(
      `<!doctype html><html${video ? ' data-intro-video' : ''}><head><base href="${document.baseURI}"><meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"><style>${FRAME_CSS}</style></head><body><div id="root"></div></body></html>`,
    )
    doc.close()
    const frameRoot = doc.documentElement
    const root: Root = createRoot(doc.getElementById('root')!)

    const { all, byId, themes } = data
    const a = byId.get(FOLLOW)!
    const followTheme = themes[FOLLOW]
    const flashThemes = FLASH.map((id) => themes[id])
    const flashNames = FLASH.map((id) => byId.get(id)?.name ?? id)
    const more = all.length - 1 - FLASH.length
    const choices = OPTIONS.map((id) => byId.get(id)!).map((x) => ({ key: x.id, label: x.name, aesthetic: x }))
    const question: ChoiceQuestion = video
      ? { ...buildPractice('clues-to-name', a, all, byId, () => 0.5), choices }
      : { ...buildPractice('image-to-name', a, all, byId, () => 0.5), image: a.images[0], choices }
    // The lesson's cards: photos live, the text-only cards in the video.
    const cards: [InfoCard, InfoCard] = video ? ['look', 'facts'] : ['intro', 'gallery']
    const now = Date.now()
    const saved: SavedProgress = { items: { [FOLLOW]: { c: 0, w: 0, t: 0, lt: 2, la: now, u: 1 } }, stats: emptyStats() }

    let t = 0
    let waited = 0
    let answerAt: number | null = null
    let scene: Scene = { k: 'quiz', question }
    let theme: Theme | null = null
    let hint = false
    const done = new Set<string>()
    const once = (key: string, when: boolean, fn: () => void) => {
      if (when && !done.has(key)) {
        done.add(key)
        fn()
      }
    }

    // Video frames must show each change straight away; live, React takes its own turn.
    let syncDraws = false
    const draw = () => {
      const el = (
        <IntroScreen
          scene={scene}
          theme={theme}
          a={a}
          all={all}
          byId={byId}
          saved={saved}
          now={now}
          themeFor={followTheme}
          onAnswer={(right) => {
            if (answerAt !== null) return
            answerAt = t
            music.current?.answer(right)
            if (engine.current) engine.current.answered = true
          }}
          onUseTheme={() => {}}
        />
      )
      if (syncDraws) flushSync(() => root.render(el))
      else root.render(el)
    }
    const setTheme = (next: Theme | null) => {
      theme = next
      applyTheme(next, frameRoot)
      draw()
    }
    draw()

    const music0 = video ? null : new IntroMusic(`${BASE}intro/`, WAIT, LOOP)
    music.current = music0
    engine.current = {
      answered: false,
      position: () =>
        answerAt !== null ? { phase: 'b', t: t - answerAt } : t < WAIT ? { phase: 'a', t } : { phase: 'loop', t: waited },
    }

    // ---------- helpers ----------
    const fw = () => frame.contentWindow!
    const inFrame = (sel: string) => doc.querySelector<HTMLElement>(sel)
    const centerOf = (el: HTMLElement) => {
      const fr = frame.getBoundingClientRect()
      const e = el.getBoundingClientRect()
      const k = fr.width / 390
      return [fr.left + (e.left + e.width / 2) * k, fr.top + (e.top + e.height / 2) * k] as const
    }
    const style = (el: HTMLElement | null, o: number, transform = 'none') => {
      if (!el) return
      el.style.opacity = String(o)
      el.style.transform = transform
      el.style.visibility = o > 0.001 ? 'visible' : 'hidden'
    }
    // a card: floats up into place, lines one after another; floats off when done
    const card = (el: HTMLElement | null, now: number, a0: number, b0: number) => {
      const L = layout.current
      if (!el) return
      const out = p(now, b0, b0 + 0.5, inOutSine)
      const i = p(now, a0, a0 + 0.75)
      style(el, Math.min(i * 1.4, 1) * (1 - out), `translateY(${(1 - i) * L.u(16) - out * L.u(10)}px)`)
      ;[...el.querySelectorAll<HTMLElement>('[data-line]')].forEach((line, n) => {
        const k = p(now, a0 + 0.1 + n * 0.14, a0 + 0.85 + n * 0.14)
        line.style.opacity = String(k)
        line.style.transform = `translateY(${(1 - k) * L.u(14)}px)`
      })
    }

    // the finger's taps: the answer (video only), Continue, Use theme
    const taps: { at: number; pre: boolean; point?: readonly [number, number]; target(): HTMLElement | null }[] = [
      ...(video ? [{ at: VIDEO_ANSWER - 0.06, pre: true, target: () => [...doc.querySelectorAll<HTMLElement>('.choice')].find((c) => c.textContent?.includes(a.name)) ?? null }] : []),
      { at: P.continueTap, pre: false, target: () => inFrame('[data-intro="continue"]') },
      { at: P.useTap, pre: false, target: () => [...doc.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.startsWith('Use the')) ?? null },
    ]

    // ---------- one frame ----------
    const render = () => {
      const L = layout.current
      const tau = answerAt === null ? -1 : t - answerAt
      const k = L.screen.w / 390
      const screenX = L.screen.x, screenY = L.screen.y

      // actions in the app, in order
      if (answerAt !== null) {
        once('lesson', tau >= P.learn, () => { scene = { k: 'lesson', card: cards[0], step: 3, of: 9 }; draw(); fw().scrollTo(0, 0) })
        once('continue', tau >= P.continueTap, () => { scene = { k: 'lesson', card: cards[1], step: 4, of: 9 }; draw(); fw().scrollTo(0, 0) })
        once('done', tau >= P.make, () => { scene = { k: 'done', themeInUse: false }; draw(); fw().scrollTo(0, 0) })
        once('use', tau >= P.useTap, () => { scene = { k: 'done', themeInUse: true }; setTheme(followTheme) })
        once('home', tau >= P.home, () => { scene = { k: 'home' }; draw(); fw().scrollTo(0, 0) })
        FLASH.forEach((_, i) => once(`flash${i}`, tau >= flashAt(i), () => setTheme(flashThemes[i])))
      }
      // the gallery drifts down; in the video the finished screen starts below its photo
      if (scene.k === 'lesson' && cards[1] === 'gallery' && tau > P.continueTap) fw().scrollTo(0, p(tau, P.continueTap + 0.3, P.make - 0.2, inOutSine) * 300)
      // hint while it waits
      const wantHint = !video && answerAt === null && waited >= 4
      if (wantHint !== hint) {
        hint = wantHint
        frameRoot.classList.toggle('intro-pulse', hint)
      }

      // ---- wall of pins ----
      const wallIn = p(t, 0, 1.2)
      const veil = p(t, 3.3, 4.3, inOutSine)
      const ending = answerAt === null ? 0 : p(tau, P.end, P.end + 0.8, inOutSine)
      style(r.wall.current, wallIn * (1 - (answerAt === null ? 0 : p(tau, P.useTap, P.useTap + 0.6))), `scale(${1.04 - 0.04 * wallIn})`)
      // the wall keeps drifting while the quiz waits, back and forth so it never runs out
      const swing = ((t + waited) / 30) % 2
      const drift = swing < 1 ? swing : 2 - swing
      r.wall.current?.querySelectorAll<HTMLElement>('[data-col]').forEach((c, i) => {
        const slack = Number(c.dataset.slack)
        c.style.transform = `translateY(${-(i % 2 ? drift : 1 - drift) * slack}px)`
      })
      if (r.veil.current) r.veil.current.style.opacity = String(0.86 * veil)

      // ---- theme collages, each arriving the way its aesthetic moves ----
      const boards = [...(r.boards.current?.children ?? [])] as HTMLElement[]
      const starts = [P.useTap, ...FLASH.map((_, i) => flashAt(i))]
      boards.forEach((b, i) => {
        if (answerAt === null) return style(b, 0)
        const at = starts[i]
        const next = starts[i + 1]
        const shown = tau >= at && (next === undefined || tau < next + 0.7)
        if (!shown) return style(b, 0)
        const out = ending
        const k = tau - at
        const tiles = [...b.querySelectorAll<HTMLElement>('img')]
        const shine = b.querySelector<HTMLElement>('.intro-shine')
        const cols = L.boardCols
        switch (b.dataset.id) {
          case 'frutiger-aero': {
            // a slow, glassy fade; the pins rise like bubbles
            const e = p(k, 0, 1.1, inOutSine)
            style(b, e * (1 - out), `scale(${1.05 - 0.05 * e}) translateY(${-k * L.u(9)}px)`)
            break
          }
          case 'clovercore':
            // pins pop in with a bounce
            style(b, p(k, 0, 0.25) * (1 - out))
            tiles.forEach((tile, n) => {
              const e = clamp((k - (n % 9) * 0.035 - Math.floor(n / 9) * 0.02) / 0.6)
              tile.style.transform = `scale(${0.35 + 0.65 * spring(e)})`
              tile.style.opacity = String(clamp(e * 4))
            })
            break
          case 'corporate-grunge':
            // filed in row by row, hard and fast, with a jolt
            style(b, (1 - out), `translateX(${Math.sin(k * 90) * L.u(4) * (1 - clamp(k / 0.3))}px)`)
            tiles.forEach((tile, n) => {
              const e = p(k, Math.floor(n / cols) * 0.045, Math.floor(n / cols) * 0.045 + 0.16)
              tile.style.transform = `translateX(${-(1 - e) * L.W * 0.7}px)`
              tile.style.opacity = e > 0 ? '1' : '0'
            })
            break
          case 'parisian-girly':
            // drifting down softly, like petals
            style(b, p(k, 0, 0.5, inOutSine) * (1 - out))
            tiles.forEach((tile, n) => {
              const d = ((n * 7) % 5) * 0.06
              const e = p(k, d, d + 0.9, inOutSine)
              tile.style.transform = `translateY(${-(1 - e) * L.u(34)}px) rotate(${(1 - e) * (((n * 13) % 7) - 3)}deg)`
              tile.style.opacity = String(e)
            })
            break
          case 'jiggy-era': {
            // a fisheye zoom, then a chrome shine sweeps across
            const e = p(k, 0, 0.35)
            style(b, clamp(k / 0.12) * (1 - out), `scale(${1.32 - 0.32 * e})`)
            if (shine) {
              shine.style.opacity = '1'
              shine.style.transform = `translateX(${lerp(-1.2, 1.2, p(k, 0.15, 0.75, inOutSine)) * L.W}px) skewX(-18deg)`
            }
            tiles.forEach((tile) => { tile.style.transform = 'none'; tile.style.opacity = '1' })
            break
          }
          case 'dollar-store-vernacular':
            // slapped on like stickers, landing with a bounce
            style(b, (1 - out))
            tiles.forEach((tile, n) => {
              const d = ((n * 7) % 11) * 0.028
              const e = p(k, d, d + 0.34, bounce)
              tile.style.transform = `translateY(${-(1 - e) * L.u(140)}px) rotate(${((n * 29) % 21) - 10}deg)`
              tile.style.opacity = k >= d ? '1' : '0'
            })
            break
          case 'utopian-scholastic':
            // a tidy wipe, column by column
            style(b, (1 - out))
            tiles.forEach((tile, n) => {
              const d = (n % cols) * 0.07
              const e = p(k, d, d + 0.3)
              tile.style.transform = `translateY(${(1 - e) * L.u(10)}px)`
              tile.style.opacity = String(e)
            })
            break
          default:
            // Global Village Coffeehouse: pasted on in three batches, a little crooked
            style(b, (1 - out))
            tiles.forEach((tile, n) => {
              tile.style.opacity = k >= (n % 3) * 0.14 ? '1' : '0'
              tile.style.transform = `rotate(${((n * 37) % 13) - 6}deg) translate(${((n * 17) % 9) - 4}px, ${((n * 23) % 7) - 3}px)`
            })
        }
      })

      // ---- the phone screen ----
      let sx = screenX, sy = screenY, so = 0, extra = ''
      const quizIn = p(t, 3.7, 4.6)
      sy += (1 - quizIn) * L.u(40)
      so = quizIn
      if (answerAt !== null) {
        // floaty swaps between the app's screens
        const swaps = [P.learn, P.make, P.home]
        for (const at of swaps) {
          const out = p(tau, at - 0.45, at, inOutSine)
          const back = p(tau, at, at + 0.75)
          if (tau >= at - 0.45 && tau < at + 0.75) {
            so = tau < at ? 1 - out : back
            sy = screenY + (tau < at ? -out * L.u(18) : (1 - back) * L.u(26))
          }
        }
        // Frutiger Aero takes over: the screen floats like a bubble
        if (tau >= P.useTap && tau < flashAt(0)) {
          const bob = p(tau, P.useTap, P.useTap + 0.8)
          sy += Math.sin((tau - P.useTap) * 2.1) * L.u(5) * bob
          extra = ` rotate(${Math.sin((tau - P.useTap) * 1.3) * 0.4 * bob}deg)`
        }
        // then each flashing look moves the screen its own way
        const f = FLASH.findLastIndex((_, i) => tau >= flashAt(i))
        if (f >= 0) {
          const kk = tau - flashAt(f)
          switch (FLASH[f]) {
            case 'clovercore': // a springy pop
              extra = ` scale(${1 - (1 - spring(clamp(kk / 0.7))) * 0.05})`
              break
            case 'corporate-grunge': // a hard jolt
              sx += Math.sin(kk * 80) * L.u(3) * (1 - clamp(kk / 0.3))
              break
            case 'parisian-girly': // a gentle sway
              extra = ` rotate(${Math.sin(kk * 2.6) * 0.7}deg)`
              sy += Math.sin(kk * 2.6 + 1) * L.u(3)
              break
            case 'jiggy-era': // a bump on every beat
              extra = ` scale(${1 + 0.025 * Math.exp(-((kk % 0.6) * 9))})`
              break
            case 'dollar-store-vernacular': // a wobble that settles
              extra = ` rotate(${Math.sin(kk * 14) * 2.2 * (1 - clamp(kk / 0.7))}deg)`
              break
            case 'utopian-scholastic': // calm and level
              break
            default: // Global Village Coffeehouse: snaps in crooked, then straightens in steps
              extra = ` rotate(${[-3, -1.8, -0.7, 0][Math.min(3, Math.floor(kk / 0.09))]}deg)`
          }
        }
        const out = p(tau, P.end, P.end + 0.8, inOutSine)
        so *= 1 - out
        sy += out * L.u(30)
      }
      if (r.screen.current) {
        style(r.screen.current, so, `translate(${sx}px, ${sy}px)${extra} scale(${k})`)
        r.screen.current.style.pointerEvents = !video && answerAt === null && t >= READY ? 'auto' : 'none'
      }

      // ---- text ----
      card(r.welcome.current, t, -1, 3.2)
      const subIn = p(t, 0.5, 1.3)
      const wSub = r.welcome.current?.querySelector<HTMLElement>('[data-sub]')
      if (wSub) {
        wSub.style.opacity = String(subIn)
        wSub.style.transform = `translateY(${(1 - subIn) * L.u(12)}px)`
      }
      const after = (x: number) => (answerAt === null ? 999 : answerAt + x)
      card(r.name.current, t, 3.8, after(P.learn - 0.2))
      const hintEl = r.name.current?.querySelector<HTMLElement>('[data-hint]')
      const subEl = r.name.current?.querySelector<HTMLElement>('[data-tap]')
      if (hintEl && subEl) {
        hintEl.style.opacity = hint ? '1' : '0'
        subEl.style.visibility = hint ? 'hidden' : 'visible'
      }
      card(r.learn.current, t, after(P.learn + 0.1), after(P.make - 0.2))
      card(r.make.current, t, after(P.make + 0.1), after(P.end))
      // the small text names each look as it arrives
      const mSub = r.make.current?.querySelector<HTMLElement>('[data-sub]')
      const mNames = r.make.current?.querySelector<HTMLElement>('[data-names]')
      const fi = answerAt === null ? -1 : FLASH.findLastIndex((_, i) => tau >= flashAt(i))
      if (mSub && mNames) {
        mSub.style.opacity = String(fi < 0 ? 1 : 1 - p(tau, flashAt(0), flashAt(0) + 0.25))
        if (fi >= 0) {
          const name = flashNames[fi]
          const text = fi === FLASH.length - 1 ? `${name}, and ${more} more.` : name
          if (mNames.textContent !== text) mNames.textContent = text
          mNames.style.opacity = String(p(tau, flashAt(fi), flashAt(fi) + 0.22))
        } else mNames.style.opacity = '0'
      }

      // ---- the end ----
      const endIn = answerAt === null ? 0 : p(tau, P.start, P.start + 0.8)
      if (r.start.current) {
        style(r.start.current, endIn, `translate(-50%, ${(1 - endIn) * L.u(16)}px) scale(${0.96 + 0.04 * endIn})`)
        r.start.current.style.pointerEvents = endIn > 0.5 ? 'auto' : 'none'
      }
      if (r.endCard.current) card(r.endCard.current, t, after(P.start), 999)

      // ---- the finger that demonstrates the taps ----
      let shown = false
      for (const tap of taps) {
        const now = tap.pre ? t : tau
        const at = tap.at
        if (now < at - 1.0 || now > at + 0.5) continue
        const el = now < at ? tap.target() : null
        if (el) tap.point = centerOf(el)
        if (!tap.point) continue
        const [tx, ty] = tap.point
        const move = p(now, at - 0.95, at - 0.12, inOutSine)
        const x = lerp(tx + L.u(70), tx, move)
        const y = lerp(ty + L.u(170), ty, move)
        const press = p(now, at - 0.08, at) * (1 - p(now, at + 0.05, at + 0.18))
        const o = p(now, at - 1.0, at - 0.8) * (1 - p(now, at + 0.25, at + 0.5))
        style(r.cursor.current, o, `translate(${x}px, ${y}px) scale(${1 - 0.2 * press})`)
        const rk = clamp((now - at) / 0.45)
        style(r.ripple.current, rk > 0 && rk < 1 ? (1 - outCubic(rk)) * 0.9 : 0, `translate(${tx}px, ${ty}px) scale(${0.6 + outCubic(rk) * 1.4})`)
        shown = true
      }
      if (!shown) {
        style(r.cursor.current, 0)
        style(r.ripple.current, 0)
      }
    }

    // ---------- live: the clock runs on frames and waits for the answer ----------
    let raf = 0
    let stopped = false
    if (!video) {
      let last = performance.now()
      const tick = (now: number) => {
        if (stopped) return
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        if (answerAt === null && t >= WAIT) waited += dt
        else t += dt
        render()
        raf = requestAnimationFrame(tick)
      }
      // start once the first pins and fonts are in, so it never opens on gaps
      const wallImgs = [...(r.wall.current?.querySelectorAll('img') ?? [])].slice(0, 12)
      Promise.race([
        Promise.all([document.fonts.ready, ...wallImgs.map((i) => (i.complete ? null : new Promise((res) => (i.onload = i.onerror = res))))]),
        new Promise((res) => setTimeout(res, 1800)),
      ]).then(() => {
        if (stopped) return
        last = performance.now()
        raf = requestAnimationFrame(tick)
      })
      const onVisibility = () => (document.hidden ? music.current?.pause() : music.current?.resume())
      document.addEventListener('visibilitychange', onVisibility)
      render()
      return () => {
        stopped = true
        cancelAnimationFrame(raf)
        document.removeEventListener('visibilitychange', onVisibility)
        music0?.stop()
        // not during React's own render: unmount the frame's tree just after
        window.setTimeout(() => root.unmount())
      }
    }

    // ---------- video: seeked one frame at a time ----------
    const ready = async () => {
      const inView = (el: Element, h: number) => {
        const b = el.getBoundingClientRect()
        return b.width > 0 && b.bottom > 0 && b.top < h
      }
      const end = performance.now() + 30000
      while (performance.now() < end) {
        const fh = fw().innerHeight
        const frameOk =
          [...doc.images].filter((i) => inView(i, fh)).every((i) => i.complete) &&
          ![...doc.querySelectorAll('.photo-loading')].some((x) => inView(x, fh)) &&
          (!doc.getElementById('theme-fonts') || !!(doc.getElementById('theme-fonts') as HTMLLinkElement).sheet) &&
          doc.fonts.status === 'loaded'
        const pageOk = [...(r.root.current?.querySelectorAll('img') ?? [])].filter((i) => i.offsetParent && inView(i, innerHeight)).every((i) => i.complete)
        if (frameOk && pageOk) break
        await new Promise((res) => setTimeout(res, 30))
      }
      await Promise.all([doc.fonts.ready, document.fonts.ready])
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))
    }
    const api = {
      length: VIDEO_LENGTH,
      async seek(time: number) {
        syncDraws = true
        t = time
        if (answerAt === null && t >= VIDEO_ANSWER) {
          const right = [...doc.querySelectorAll<HTMLElement>('.choice')].find((c) => c.textContent?.includes(a.name))
          right?.click()
          answerAt = VIDEO_ANSWER
        }
        render()
        await ready()
      },
    }
    ;(window as unknown as { __introVideo?: typeof api }).__introVideo = api
    render()
    return () => {
      window.setTimeout(() => root.unmount())
    }
    // The timeline starts once, when the data is in; layout changes are read live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // ---------- sound ----------
  const toggleSound = () => {
    if (!music.current || !engine.current) return
    if (muted) void music.current.start(engine.current.position)
    else music.current.mute()
    setMuted(!muted)
  }

  useEffect(() => {
    if (video) return
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish(false)
    window.addEventListener('keydown', onKey)
    return () => {
      root.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  })

  // ---------- markup ----------
  const tileW = (L.W - 16 * (L.cols + 1)) / L.cols
  const tileH = tileW * 1.25
  const rows = Math.ceil((L.H * 1.7) / (tileH + 16)) + 1
  const slack = rows * (tileH + 16) - L.H
  const boardTileW = L.W / L.boardCols
  const boardRows = Math.ceil(L.H / (boardTileW * 1.25)) + 1
  const boxStyle = (b: Box): CSSProperties => ({ left: b.x, top: b.y, width: b.w, height: b.h, padding: `0 ${L.pad}px`, borderRadius: L.radius })
  const all = data?.themes
  const wallThemes = all ? WALL.filter((id) => all[id]).map((id) => all[id]) : []

  return (
    <div ref={r.root} className={`intro ${L.portrait ? 'is-portrait' : 'is-landscape'} ${leaving ? 'is-leaving' : ''} ${video ? 'is-video' : ''}`} role="dialog" aria-modal="true" aria-label="Welcome to Aesthetic Learner">
      <div ref={r.wall} className="intro-wall" style={{ gap: 16, padding: '0 16px' }}>
        {wallThemes.length > 0 &&
          Array.from({ length: L.cols }, (_, c) => (
            <div key={c} data-col data-slack={slack} className="intro-col" style={{ gap: 16 }}>
              {Array.from({ length: rows }, (_, n) => {
                const i = c * rows + n
                const th = wallThemes[(i * 5 + c) % wallThemes.length]
                return <img key={n} src={pin(th, 1 + ((i * 3) % 10))} alt="" style={{ height: tileH, borderRadius: L.u(12) }} />
              })}
            </div>
          ))}
      </div>
      <div ref={r.veil} className="intro-veil" />
      <div ref={r.boards} className="intro-boards">
        {all &&
          [FOLLOW, ...FLASH].map((id) => (
            <div key={id} data-id={id} className="intro-board" style={{ background: all[id].colours.bg, gridTemplateColumns: `repeat(${L.boardCols}, 1fr)` }}>
              {Array.from({ length: L.boardCols * boardRows }, (_, n) => (
                <img key={n} src={pin(all[id], 1 + ((n * 7 + 3) % 10))} alt="" />
              ))}
              <div className="intro-shine" />
            </div>
          ))}
      </div>

      <div ref={r.screen} className="intro-screen" style={{ width: 390, height: (L.screen.h / L.screen.w) * 390, borderRadius: 34 }}>
        <iframe ref={r.frame} title="Aesthetic Learner" tabIndex={-1} />
      </div>

      <div ref={r.welcome} className="intro-card is-center" style={boxStyle(L.welcome)}>
        <div className="intro-eyebrow" style={{ fontSize: L.f.eyebrow }}>Welcome to</div>
        <div className="intro-title" style={{ fontSize: L.f.title, margin: `${L.u(8)}px 0 ${L.u(12)}px` }}>Aesthetic Learner</div>
        <div className="intro-sub" data-sub style={{ fontSize: L.f.sub }}>
          174 design aesthetics, from Art&nbsp;Deco to&nbsp;Y2K.
        </div>
      </div>
      <div ref={r.name} className="intro-card" style={boxStyle(L.step)}>
        <div className="intro-title" data-line style={{ fontSize: L.f.head, marginBottom: L.u(10) }}>Name it.</div>
        <div className="intro-sub" data-line style={{ fontSize: L.f.stepSub, position: 'relative' }}>
          <span data-tap>{video ? 'Read the clues, then pick the aesthetic.' : 'Tap your guess.'}</span>
          <span data-hint className="intro-hint">Tap the one you think it is</span>
        </div>
      </div>
      <div ref={r.learn} className="intro-card" style={boxStyle(L.step)}>
        <div className="intro-title" data-line style={{ fontSize: L.f.head, marginBottom: L.u(10) }}>Learn it.</div>
        <div className="intro-sub" data-line style={{ fontSize: L.f.stepSub }}>Every aesthetic has its own lesson.</div>
      </div>
      <div ref={r.make} className="intro-card" style={boxStyle(L.step)}>
        <div className="intro-title" data-line style={{ fontSize: L.f.head, marginBottom: L.u(10) }}>Make it yours.</div>
        <div className="intro-sub" data-line style={{ fontSize: L.f.stepSub, display: 'grid' }}>
          <span data-sub style={{ gridArea: '1 / 1' }}>Learn a lesson and its look takes over the whole app.</span>
          <span data-names style={{ gridArea: '1 / 1', opacity: 0 }} />
        </div>
      </div>

      {video ? (
        <div ref={r.endCard} className="intro-card is-center" style={boxStyle(L.end)}>
          <div className="intro-title" data-line style={{ fontSize: L.f.title, marginBottom: L.u(14) }}>Aesthetic Learner</div>
          <div className="intro-url" data-line style={{ fontSize: L.f.url, padding: `${L.u(8)}px ${L.u(18)}px` }}>{SITE}</div>
        </div>
      ) : (
        <button ref={r.start} className="intro-start" style={{ top: L.H / 2 - L.u(30), fontSize: L.u(L.portrait ? 18 : 22), padding: `0 ${L.u(34)}px`, height: L.u(L.portrait ? 60 : 72) }} onClick={() => finish(true)}>
          Start learning
        </button>
      )}

      <div ref={r.ripple} className="intro-ripple" style={{ width: L.cursor, height: L.cursor, margin: -L.cursor / 2 }} />
      <div ref={r.cursor} className="intro-cursor" style={{ width: L.cursor, height: L.cursor, margin: -L.cursor / 2 }} />

      {!video && (
        <div className="intro-controls">
          <button className="intro-btn" onClick={toggleSound} aria-pressed={!muted} disabled={!data}>
            {muted ? 'Sound on' : 'Sound off'}
          </button>
          <button className="intro-btn" onClick={() => finish(false)}>
            Skip
          </button>
        </div>
      )}
    </div>
  )
}

// boards for the welcome wall: a spread of contrasting looks
const WALL = [
  'art-deco', 'frutiger-aero', 'cutecore', 'early-cyber', 'art-nouveau', 'memphis-design', 'claymorphism', '2010s-meme-maximalism',
  'pc-98', 'dorfic', 'disco-deco', 'biedermeier', 'rgb-gamer', 'parisian-girly', 'googie-kitsch', '80s-90s-afrocentrism',
  'dollar-store-vernacular', 'mallsoft', 'dark-aero', 'corporate-memphis', 'danish-pastel', 'groovival', 'blob-world',
  'cyberminimalism', 'raw-industrial', 'catholic-kitsch', 'avant-basic', 'coastal-style', 'clovercore', 'global-village-coffeehouse',
]
