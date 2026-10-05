// The app icon: a pixel heart. A pink stepped tile with the heart cut through to
// the brand violet and one cream highlight pixel, drawn on an exact 11 x 11 grid
// so every edge stays crisp. Vectors only, no fonts or images.
// Writes public/icons/icon.svg, the home-screen PNGs and the favicon:  npm run make-icon
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const VIOLET = '#5b3fd9', PINK = '#ff9fc6', CREAM = '#f5f1ea'
// P pink tile, H heart (cut through to violet), C cream highlight, . violet ground
const GRID = [
  '..PPPPPPP..',
  '.PPPPPPPPP.',
  'PPPPPPPPPPP',
  'PPPHHPHHPPP',
  'PPCHHHHHHPP',
  'PPHHHHHHHPP',
  'PPPHHHHHPPP',
  'PPPPHHHPPPP',
  'PPPPPHPPPPP',
  '.PPPPPPPPP.',
  '..PPPPPPP..',
]
const CELL = 72
const OFFSET = (1024 - GRID.length * CELL) / 2 // 116: the tile spans the middle 77%

const cells = (ch) =>
  GRID.flatMap((row, r) => [...row].map((c, k) => (c === ch ? `M${OFFSET + k * CELL} ${OFFSET + r * CELL}h${CELL}v${CELL}h-${CELL}Z` : ''))).join('')

// Full bleed for home screens (iOS and Android round the corners themselves);
// the browser-tab favicon gets its own rounded corners.
const icon = (corner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" shape-rendering="crispEdges">\n` +
  `<rect width="1024" height="1024"${corner ? ` rx="${corner}"` : ''} fill="${VIOLET}"/>\n` +
  `<path d="${cells('P')}" fill="${PINK}"/>\n` +
  `<path d="${cells('C')}" fill="${CREAM}"/>\n` +
  `</svg>\n`

const pub = (...p) => path.join(__dirname, '..', 'public', ...p)
fs.mkdirSync(pub('icons'), { recursive: true })
fs.writeFileSync(pub('icons', 'icon.svg'), icon(0))
fs.writeFileSync(pub('favicon.svg'), icon(224))
;(async () => {
  // Each size straight from the vector, opaque (iOS turns transparency black).
  for (const [size, file] of [[180, pub('apple-touch-icon.png')], [192, pub('icons', 'icon-192.png')], [512, pub('icons', 'icon-512.png')]]) {
    await sharp(Buffer.from(icon(0)), { density: Math.ceil((72 * size * 2) / 1024) }).resize(size, size).flatten({ background: VIOLET }).png({ compressionLevel: 9 }).toFile(file)
  }
  console.log('wrote public/apple-touch-icon.png, public/icons/ (svg, 192, 512) and public/favicon.svg')
})()
