import { describe, expect, it } from 'vitest'
import { article, linkTitles, original, relink, textOf } from './wiki-html.mjs'

const IMG = 'https://static.wikia.nocookie.net/aesthetics/images/5/5f/Glossy.jpg/revision/latest'

// Markup as the Fandom parse API returns it (MediaWiki 1.39 and 1.43 headings both appear).
const html = `<div class="mw-parser-output"><aside class="portable-infobox"><h2>Frutiger Aero</h2><div>Decade of origin 2000s</div></aside>
<p><b>Frutiger Aero</b> (also known as <i>Web 2.0 Gloss</i>) is a design aesthetic<sup class="reference"><a href="#cite_note-1">[1]</a></sup> that followed <a href="/wiki/Y2K_Futurism" title="Y2K Futurism">Y2K Futurism</a> and the <a href="/wiki/Missing" class="new">missing page</a>.
</p>
<div id="toc" class="toc"><ul><li>History</li></ul></div>
<h2><span class="mw-headline" id="History">History</span><span class="mw-editsection">[edit]</span></h2>
<figure class="thumb tright show-info-icon" style="width: 250px"><a href="${IMG}?cb=1" class="image"><img src="data:image/gif;base64,R0lGOD" data-src="${IMG}/scale-to-width-down/250?cb=1" width="250" height="140" data-image-name="Glossy.jpg" class="thumbimage lazyload"></a><figcaption class="thumbcaption"><p class="caption">Windows Vista&#39;s <a href="/wiki/Glass" title="Glass">glass</a></p></figcaption></figure>
<p>It began around 2004.
</p>
<div class="mw-heading mw-heading3"><h3 id="Influences">Influences</h3><span class="mw-editsection">[edit]</span></div>
<ul><li>Skeuomorphism<ul><li>Glossy buttons</li></ul></li><li><a rel="nofollow" class="external text" href="https://example.com/a">An outside site</a></li></ul>
<h2><span class="mw-headline" id="Gallery">Gallery</span></h2>
<div id="gallery-0" class="wikia-gallery wikia-gallery-caption-below"><div class="wikia-gallery-row">
<div class="wikia-gallery-item"><div class="thumb"><div class="gallery-image-wrapper"><a href="https://static.wikia.nocookie.net/aesthetics/images/a/aa/One.png/revision/latest?cb=2" class="image lightbox"><img src="data:," data-src="https://static.wikia.nocookie.net/aesthetics/images/a/aa/One.png/revision/latest/scale-to-width-down/185?cb=2" width="185" height="120"></a></div></div><div class="lightbox-caption">Bubbles &amp; fish</div></div>
<div class="wikia-gallery-item"><div class="thumb"><div class="gallery-image-wrapper"><a href="https://static.wikia.nocookie.net/aesthetics/images/b/bb/Two.png/revision/latest?cb=3" class="image lightbox"><img src="data:," data-src="https://static.wikia.nocookie.net/aesthetics/images/b/bb/Two.png/revision/latest/scale-to-width-down/185?cb=3" width="185" height="185"></a></div></div><div class="lightbox-caption">An AI-generated mall</div></div>
</div></div>
<figure class="thumb tnone"><a href="/wiki/File:A_toy_phone" class="image"><img data-src="https://static.wikia.nocookie.net/aesthetics/images/e/ee/A_toy_phone/revision/latest/scale-to-width-down/180?cb=4" width="180" height="135"></a><figcaption class="thumbcaption"><div> <br>A toy phone<br></div></figcaption></figure>
<div class="main-article">Main article: <a href="/wiki/Y2K_Futurism">Y2K Futurism</a></div>
<div class="mw-heading mw-heading2"><h2 id="Music">Music</h2></div>
<div class="embedvideo ev_center"><div class="embedvideowrap"><iframe src="//www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0"></iframe></div><div class="thumbcaption">A song</div></div>
<table class="wikitable"><tbody><tr><th>Artist</th><th>Year</th></tr><tr><td><a href="/wiki/Some_Band">Some Band</a></td><td>2006</td></tr></tbody></table>
<blockquote><p>Glossy everything.</p></blockquote>
<h2><span class="mw-headline" id="References">References</span></h2>
<div class="mw-references-wrap"><ol class="references"><li>Source</li></ol></div>
<h2><span class="mw-headline" id="Empty">Empty</span></h2>
</div>`

describe('wiki articles', () => {
  const a = article(html)

  it('keeps the lead without the infobox, references or contents box', () => {
    expect(a.lead).toHaveLength(1)
    expect(textOf(a.lead[0].c)).toBe('Frutiger Aero (also known as Web 2.0 Gloss) is a design aesthetic that followed Y2K Futurism and the missing page.')
    expect(a.lead[0].c[0]).toEqual({ t: 'b', c: ['Frutiger Aero'] })
    expect(a.lead[0].c).toContainEqual({ t: 'a', c: ['Y2K Futurism'], w: 'Y2K Futurism' })
  })

  it('splits sections at the top heading level and drops citation and empty sections', () => {
    expect(a.sections.map((s) => [s.id, s.title])).toEqual([
      ['history', 'History'],
      ['gallery', 'Gallery'],
      ['music', 'Music'],
    ])
    expect(a.sections[0].blocks.map((b) => b.t)).toEqual(['img', 'p', 'h', 'ul'])
  })

  it('keeps images on Fandom, full size, with captions', () => {
    const img = a.sections[0].blocks[0]
    expect(img).toEqual({ t: 'img', img: { src: `${IMG}?cb=1`, w: 250, h: 140, cap: ["Windows Vista's ", { t: 'a', c: ['glass'], w: 'Glass' }] } })
    expect(original(`${IMG}/scale-to-width-down/185?cb=2`)).toBe(`${IMG}?cb=2`)
  })

  it('turns galleries into image lists and leaves out pictures captioned as AI-made', () => {
    const g = a.sections[1].blocks[0]
    expect(g.t).toBe('gallery')
    expect(g.items).toHaveLength(1)
    expect(g.items[0].cap).toEqual(['Bubbles & fish'])
  })

  it('marks videos (files without a picture extension) with their wiki page, and drops "main article" notes', () => {
    expect(a.sections[1].blocks).toHaveLength(2)
    expect(a.sections[1].blocks[1]).toEqual({
      t: 'img',
      side: 'center',
      img: { src: 'https://static.wikia.nocookie.net/aesthetics/images/e/ee/A_toy_phone/revision/latest?cb=4', w: 180, h: 135, v: 'https://aesthetics.fandom.com/wiki/File:A_toy_phone', cap: ['A toy phone'] },
    })
  })

  it('nests lists, keeps outside links, turns videos into links and keeps tables', () => {
    const list = a.sections[0].blocks[3]
    expect(list.items[0].sub[0].items[0].c).toEqual(['Glossy buttons'])
    expect(list.items[1].c[0]).toEqual({ t: 'a', c: ['An outside site'], href: 'https://example.com/a' })
    const [video, table, quote] = a.sections[2].blocks
    expect(video).toEqual({ t: 'video', href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', cap: ['A song'] })
    expect(table.rows[0]).toEqual([{ h: 1, c: ['Artist'] }, { h: 1, c: ['Year'] }])
    expect(quote).toEqual({ t: 'quote', c: [{ t: 'p', c: ['Glossy everything.'] }] })
  })

  it('resolves wiki links to app pages, wiki pages or plain text', () => {
    expect([...linkTitles(a)].sort()).toEqual(['Glass', 'Some Band', 'Y2K Futurism'])
    const out = relink(a, (title) => (title === 'Y2K Futurism' ? { id: 'y2k-futurism' } : title === 'Glass' ? null : { href: 'https://aesthetics.fandom.com/wiki/' + title }))
    expect(out.lead[0].c).toContainEqual({ t: 'a', c: ['Y2K Futurism'], id: 'y2k-futurism' })
    expect(out.sections[0].blocks[0].img.cap).toEqual(["Windows Vista's ", 'glass'])
  })

  const pic = (name, w = 200) => `<a href="https://static.wikia.nocookie.net/aesthetics/images/1/11/${name}/revision/latest?cb=1" class="image"><img data-src="https://static.wikia.nocookie.net/aesthetics/images/1/11/${name}/revision/latest/scale-to-width-down/${w}?cb=1" width="${w}" height="${w}"></a>`
  const src = (name) => `https://static.wikia.nocookie.net/aesthetics/images/1/11/${name}/revision/latest?cb=1`

  it('keeps the space at the edge of a mark outside it', () => {
    const { lead } = article('<div class="mw-parser-output"><p>floating clouds<b> and </b>ancient <a href="/wiki/X">Vaporwave </a>and<i> more</i>.</p></div>')
    expect(textOf(lead[0].c)).toBe('floating clouds and ancient Vaporwave and more.')
  })

  it('keeps a picture table with descriptions as a table, pictures in their cells', () => {
    const { lead } = article(`<div class="mw-parser-output"><table><tr><th>Men's fashion</th><th>Women's fashion</th></tr><tr><td>${pic('A.jpg')}</td><td>${pic('B.jpg')}</td></tr><tr><td>${pic('C.jpg')}</td><td>A wide collar</td></tr></table></div>`)
    expect(lead).toHaveLength(1)
    const t = lead[0]
    expect(t.t).toBe('table')
    expect(t.rows[0]).toEqual([{ h: 1, c: ["Men's fashion"] }, { h: 1, c: ["Women's fashion"] }])
    expect(t.rows[1][0].imgs[0].src).toBe(src('A.jpg'))
    expect(t.rows[2][1]).toEqual({ c: ['A wide collar'] })
  })

  it('turns a grid of captioned pictures into a gallery', () => {
    const { lead } = article(`<div class="mw-parser-output"><table><tr><td>${pic('A.jpg')}<br>Chairs</td><td>${pic('B.jpg')}<br>Lamps</td></tr></table></div>`)
    expect(lead[0]).toEqual({ t: 'gallery', items: [{ src: src('A.jpg'), w: 200, h: 200, cap: ['Chairs'] }, { src: src('B.jpg'), w: 200, h: 200, cap: ['Lamps'] }] })
  })

  it('leaves out pictures whose table cell or list item says they were made by AI', () => {
    const t = article(`<div class="mw-parser-output"><table><tr><td>${pic('A.jpg')}</td><td>${pic('B.jpg')} AI-generated image of a mall</td></tr><tr><td>Text</td><td>More</td></tr></table></div>`).lead[0]
    expect(JSON.stringify(t)).not.toContain('B.jpg')
    const l = article(`<div class="mw-parser-output"><ul><li>${pic('A.jpg')} A real one</li><li>${pic('B.jpg')} AI generated art of a mall</li></ul></div>`).lead
    expect(JSON.stringify(l)).not.toContain('B.jpg')
    expect(JSON.stringify(l)).toContain('A.jpg')
  })

  it('keeps the pictures of a list where only some items have one, in a gallery after it', () => {
    const { lead } = article(`<div class="mw-parser-output"><ul><li>Plain item</li><li>${pic('A.jpg')} Pictured item</li></ul></div>`)
    expect(lead.map((b) => b.t)).toEqual(['ul', 'img'])
    expect(lead[0].items.map((i) => textOf(i.c))).toEqual(['Plain item', 'Pictured item'])
    expect(lead[1].img).toEqual({ src: src('A.jpg'), w: 200, h: 200, cap: ['Pictured item'] })
  })

  it('keeps the words of a link that also holds an icon', () => {
    const { lead } = article(`<div class="mw-parser-output"><p>See <a href="/wiki/Y2K_Futurism"><img src="https://static.wikia.nocookie.net/aesthetics/images/1/11/Icon.png/revision/latest" width="16" height="16"> Y2K Futurism</a>.</p></div>`)
    expect(lead[0].c).toContainEqual({ t: 'a', c: ['Y2K Futurism'], w: 'Y2K Futurism' })
  })
})
