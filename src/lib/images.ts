// Fandom serves resized copies when the width is added to the image URL.
// Images must be requested with the browser's default referrer: Fandom
// refuses requests that arrive without one.
export function thumb(url: string, width: number): string {
  return url.replace('/revision/latest', `/revision/latest/scale-to-width-down/${width}`)
}

export const SIZE = { large: 800, medium: 400, small: 160 } as const

export function preload(urls: string[], width: number) {
  for (const url of urls) {
    const img = new Image()
    img.decoding = 'async'
    img.src = thumb(url, width)
  }
}
