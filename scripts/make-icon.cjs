// The app icon: a 2x2 moodboard on the brand violet, four eras in their own shapes:
// an Art Deco sunburst arch (1920s), a Memphis ribbon (80s), a pixel heart (90s)
// and a Frutiger Aero orb (2000s). Drawn as vectors, no fonts or images.
// Writes public/icons/icon.svg, the home-screen PNGs and the favicon:  npm run make-icon
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const f = (n) => +n.toFixed(2)
const V = '#5b3fd9', INK = '#1c1a18', CREAM = '#f5f1ea', GOLD = '#e8b04a'
const out = []

// ---- Art Deco: an ink arch with a rising sun of five fat rays
out.push(`<path d="M122 486V304A182 182 0 0 1 486 304V486Z" fill="${INK}"/>`)
const cx = 304, cy = 418
const sector = (a0, a1, r0, r1) => {
  const p = (a, r) => `${f(cx + r * Math.cos(a))} ${f(cy - r * Math.sin(a))}`
  return `M${p(a0, r1)}A${r1} ${r1} 0 0 0 ${p(a1, r1)}L${p(a1, r0)}A${r0} ${r0} 0 0 1 ${p(a0, r0)}Z`
}
const rays = []
for (let k = 0; k < 5; k++) {
  const mid = Math.PI * (0.1 + 0.2 * k) // 18°, 54°, 90°, 126°, 162°
  const half = (Math.PI / 180) * 11.5
  rays.push(sector(mid - half, mid + half, 104, 166))
}
out.push(`<path d="${rays.join('')}" fill="${GOLD}"/>`)
out.push(`<path d="M${cx - 80} ${cy}A80 80 0 0 1 ${cx + 80} ${cy}Z" fill="${GOLD}"/>`)
out.push(`<rect x="${cx - 128}" y="${cy + 22}" width="256" height="18" fill="${GOLD}"/>`)

// ---- Memphis: a coral ribbon, tilted, with a bold ink zigzag and a yellow dot
const top = (x) => 162 + 40 * Math.cos((2 * Math.PI * (x - 538)) / 182)
const ribbon = 'M538 202C571.07 202 595.93 122 629 122C662.07 122 686.93 202 720 202C753.07 202 777.93 122 811 122C844.07 122 868.93 202 902 202V486C868.93 486 844.07 406 811 406C777.93 406 753.07 486 720 486C686.93 486 662.07 406 629 406C595.93 406 571.07 486 538 486Z'
// A regular zigzag on a straight line (it stays inside the ribbon: the wave moves the edges by 40 at most)
const zig = []
for (let i = 0; i <= 6; i++) zig.push(`${f(586 + i * 44.7)} ${i % 2 ? 268 : 336}`)
out.push(`<g transform="rotate(-6 720 304)"><path d="${ribbon}" fill="#ff7d66"/>` +
  `<path d="M${zig.join('L')}" fill="none" stroke="${INK}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10"/>` +
  `<circle cx="612" cy="${f(top(612) + 64)}" r="22" fill="#ffd23f"/><circle cx="842" cy="${f(top(842) + 252)}" r="22" fill="#2ec4b6"/></g>`)

// ---- Pixel art: a pink stepped tile with a pixel heart cut through, one cream catchlight pixel
const grid = 33.09, gx = 155.09, gy = 571.09
out.push(`<path d="M188.18 538H419.82V571.09H452.91V604.18H486V835.82H452.91V868.91H419.82V902H188.18V868.91H155.09V835.82H122V604.18H155.09V571.09H188.18Z" fill="#ff9fc6"/>`)
const heart = ['..XX.XX..', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....']
const cells = []
heart.forEach((row, r) => [...row].forEach((c, k) => { if (c === 'X') cells.push(`M${f(gx + (k + 1) * grid)} ${f(gy + (r + 2) * grid)}h${grid}v${grid}h-${grid}Z`) }))
out.push(`<path d="${cells.join('')}" fill="${V}"/>`)
out.push(`<rect x="${f(gx + 2 * grid)}" y="${f(gy + 3 * grid)}" width="${grid}" height="${grid}" fill="${CREAM}"/>`)

// ---- Frutiger Aero: a glossy aqua orb with a deep rim and a crisp cream catchlight
const defs = `<defs>
<radialGradient id="orb" cx="0.42" cy="0.34" r="0.74"><stop offset="0" stop-color="#c4f5ff"/><stop offset="0.48" stop-color="#3cc0dc"/><stop offset="0.86" stop-color="#1676a8"/><stop offset="1" stop-color="#0d3f6e"/></radialGradient>
<radialGradient id="bounce" cx="0.5" cy="0.6" r="0.5"><stop offset="0" stop-color="#b8f4ff" stop-opacity="0.6"/><stop offset="1" stop-color="#b8f4ff" stop-opacity="0"/></radialGradient>
</defs>`
out.push(`<circle cx="720" cy="720" r="182" fill="url(#orb)"/>`)
out.push(`<ellipse cx="720" cy="826" rx="108" ry="48" fill="url(#bounce)"/>`)
out.push(`<ellipse cx="664" cy="640" rx="62" ry="34" transform="rotate(-32 664 640)" fill="${CREAM}" opacity="0.92"/>`)

// Full bleed for home screens (iOS and Android round the corners themselves);
// the browser-tab favicon gets its own rounded corners.
const icon = (corner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">\n${defs}\n<rect width="1024" height="1024"${corner ? ` rx="${corner}"` : ''} fill="${V}"/>\n${out.join('\n')}\n</svg>\n`

const pub = (...p) => path.join(__dirname, '..', 'public', ...p)
fs.mkdirSync(pub('icons'), { recursive: true })
fs.writeFileSync(pub('icons', 'icon.svg'), icon(0))
fs.writeFileSync(pub('favicon.svg'), icon(224))
;(async () => {
  // Each size straight from the vector, opaque (iOS turns transparency black).
  for (const [size, file] of [[180, pub('apple-touch-icon.png')], [192, pub('icons', 'icon-192.png')], [512, pub('icons', 'icon-512.png')]]) {
    await sharp(Buffer.from(icon(0)), { density: Math.ceil((72 * size * 2) / 1024) }).resize(size, size).flatten({ background: V }).png({ compressionLevel: 9 }).toFile(file)
  }
  console.log('wrote public/apple-touch-icon.png, public/icons/ (svg, 192, 512) and public/favicon.svg')
})()
