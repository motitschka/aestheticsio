// Colour helpers in OKLab/OKLCH (perceptual), plus WCAG contrast.

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** sRGB 0–255 → OKLab */
export function rgbToOklab([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((v) => toLinear(v / 255))
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLab → linear sRGB (may be out of gamut) */
function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export const lch = ([L, a, b]) => [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360]
const lab = ([L, C, h]) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)]

const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005)

/** OKLCH → linear sRGB, reducing chroma until it fits. */
function fit([L, C, h]) {
  L = Math.min(1, Math.max(0, L))
  let lo = 0
  let hi = C
  let rgb = oklabToLinear(lab([L, C, h]))
  if (inGamut(rgb)) return rgb
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    const test = oklabToLinear(lab([L, mid, h]))
    if (inGamut(test)) {
      lo = mid
      rgb = test
    } else hi = mid
  }
  return oklabToLinear(lab([L, lo, h])).map((v) => Math.min(1, Math.max(0, v)))
}

export function hex(lchColour) {
  return (
    '#' +
    fit(lchColour)
      .map((v) => Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}

function luminance(lchColour) {
  const [r, g, b] = fit(lchColour).map((v) => Math.min(1, Math.max(0, v)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(x, y) {
  const [a, b] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (a + 0.05) / (b + 0.05)
}

/** Moves lightness (darker or lighter) until the colour reaches `ratio` against every background. */
export function ensureContrast(colour, backgrounds, ratio, direction) {
  let [L, C, h] = colour
  for (let i = 0; i < 100 && backgrounds.some((bg) => contrast([L, C, h], bg) < ratio); i++) {
    L += direction * 0.01
    if (L <= 0 || L >= 1) break
  }
  return [Math.min(1, Math.max(0, L)), C, h]
}

const hueDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

/** k-means in OKLab. Returns clusters sorted by size: { lab, weight } */
export function kmeans(points, k = 8, iterations = 14) {
  if (points.length === 0) return []
  // Deterministic k-means++ style seeding: farthest-point from the mean.
  const centres = [points[Math.floor(points.length / 2)]]
  while (centres.length < k) {
    let best = null
    let bestD = -1
    for (let i = 0; i < points.length; i += 7) {
      const p = points[i]
      const d = Math.min(...centres.map((c) => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2))
      if (d > bestD) {
        bestD = d
        best = p
      }
    }
    centres.push(best)
  }
  let assign = new Array(points.length).fill(0)
  for (let it = 0; it < iterations; it++) {
    assign = points.map((p) => {
      let bi = 0
      let bd = Infinity
      centres.forEach((c, i) => {
        const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2
        if (d < bd) {
          bd = d
          bi = i
        }
      })
      return bi
    })
    for (let i = 0; i < k; i++) {
      const members = points.filter((_, j) => assign[j] === i)
      if (members.length) centres[i] = [0, 1, 2].map((d) => members.reduce((s, p) => s + p[d], 0) / members.length)
    }
  }
  const counts = new Array(k).fill(0)
  for (const a of assign) counts[a]++
  return centres.map((c, i) => ({ lab: c, weight: counts[i] / points.length })).filter((c) => c.weight > 0).sort((a, b) => b.weight - a.weight)
}

/**
 * Turns an image palette into the app's colour tokens. Text, muted text and
 * the accent are nudged until they meet WCAG contrast (7, 4.5, 4.5).
 */
export const hexToLch = (h) => lch(rgbToOklab([1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))))

export function themeColours(clusters, meanL, forceDark, accentHex) {
  const withLch = clusters.map((c) => ({ ...c, lch: lch(c.lab) }))
  const dark = forceDark ?? meanL < 0.42
  const tinted = withLch.filter((c) => c.lch[1] > 0.03)
  const dominant = tinted[0]?.lch ?? withLch[0].lch
  // The accent is a colour that is both saturated and covers a real part of the images.
  const vivid = [...withLch]
    .filter((c) => c.lch[0] > 0.25 && c.lch[0] < 0.92 && c.weight >= 0.04 && c.lch[1] >= 0.04)
    .sort((a, b) => b.lch[1] * b.weight ** 0.8 - a.lch[1] * a.weight ** 0.8)
  let accent = accentHex ? hexToLch(accentHex) : (vivid[0]?.lch ?? dominant)
  const greyish = accent[1] < 0.045
  if (greyish && !accentHex) accent = [dark ? 0.85 : 0.3, Math.min(accent[1], 0.02), dominant[2]]
  const second = vivid.find((c) => c.lch[1] > 0.05 && hueDistance(c.lch[2], accent[2]) > 45)?.lch
  // Tint the background with the main colour when it's clearly coloured,
  // otherwise with the accent (photos are often dominated by beige and wood).
  const h = dominant[1] > 0.06 ? dominant[2] : accent[2]
  // A deliberately grey accent (e.g. Monochrome Luxe) gets a neutral background too.
  const tint = accentHex && accent[1] < 0.03 ? 0.004 : Math.min(0.045, Math.max(dominant[1], accent[1]) * 0.4 + 0.008)
  const ah = accent[2]
  const C = Math.min(accent[1], 0.2)

  let t
  if (!dark) {
    const bg = [0.955, tint, h]
    const surface = [0.99, Math.min(tint, 0.012), h]
    const surface2 = [0.915, Math.min(0.035, tint + 0.005), h]
    const text = ensureContrast([0.24, 0.03, ah], [bg, surface, surface2], 7, -1)
    const muted = ensureContrast([0.5, 0.03, ah], [bg, surface], 4.5, -1)
    // Bright accents (yellow, orange) keep their brightness and get dark text on them.
    let fill = [Math.min(Math.max(accent[0], 0.45), 0.8), C, ah]
    const darkInk = [0.2, 0.03, ah]
    const lightInk = [0.99, 0.005, ah]
    const onAccent = contrast(fill, lightInk) >= contrast(fill, darkInk) ? lightInk : darkInk
    fill = ensureContrast(fill, [onAccent], 4.5, onAccent === lightInk ? -1 : 1)
    t = {
      bg,
      surface,
      surface2,
      line: [0.87, Math.min(0.035, tint + 0.005), h],
      text,
      muted,
      accent: fill,
      onAccent,
      accentText: ensureContrast([Math.min(fill[0], 0.55), C, ah], [bg, surface, surface2], 4.5, -1),
      accentSoft: [0.9, Math.min(0.08, C * 0.5 + 0.02), ah],
      good: [0.52, 0.13, 150],
      goodSoft: [0.93, 0.05, 150],
      bad: [0.53, 0.17, 25],
      badSoft: [0.93, 0.04, 25],
      gold: [0.62, 0.12, 80],
    }
  } else {
    const bg = [0.17, Math.min(tint, 0.04), h]
    const surface = [0.215, Math.min(tint, 0.035), h]
    const surface2 = [0.27, Math.min(tint + 0.005, 0.04), h]
    const text = ensureContrast([0.95, 0.015, ah], [bg, surface, surface2], 7, 1)
    const muted = ensureContrast([0.74, 0.03, ah], [bg, surface], 4.5, 1)
    const fill = ensureContrast([Math.min(Math.max(accent[0], 0.68), 0.88), C, ah], [bg, surface], 4.5, 1)
    const onAccent = [0.17, 0.02, ah]
    t = {
      bg,
      surface,
      surface2,
      line: [0.33, Math.min(tint + 0.005, 0.04), h],
      text,
      muted,
      accent: ensureContrast(fill, [onAccent], 4.5, 1),
      onAccent,
      accentText: fill,
      accentSoft: [0.32, Math.min(0.08, C * 0.6), ah],
      good: [0.76, 0.15, 150],
      goodSoft: [0.3, 0.06, 150],
      bad: [0.72, 0.16, 25],
      badSoft: [0.3, 0.06, 25],
      gold: [0.82, 0.13, 85],
    }
  }
  const colours = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, hex(v)]))
  // A few image colours for the theme picker's swatches.
  const swatches = [accent, ...(second ? [second] : []), ...withLch.slice(0, 4).map((c) => c.lch)]
    .map(hex)
    .filter((x, i, all) => all.indexOf(x) === i)
    .slice(0, 5)
  return { dark, colours, swatches, glow: second ? hex([dark ? 0.6 : 0.8, Math.min(second[1], 0.15), second[2]]) : colours.accentSoft }
}
