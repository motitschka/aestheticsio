import { describe, expect, it } from 'vitest'
import { decadeYear, introText, linkTargets, parseInfobox, plain, plainList, stripTemplates } from './wikitext.mjs'

const page = `{{Aesthetic
|title1=Art Deco
|image1=Spire.webp
|decade_of_origin=1910s–1930s
|key_motifs=Bold geometric shapes (chevrons, sunbursts, zig-zags), stepped forms, [[symmetry]]
|key_colours=Black<br>silver, gold{{Ref|x}}
|related_aesthetics=[[Art Nouveau]]<br>[[Bauhaus|the Bauhaus]]<br>[https://x.y Decoplex]
|other_names=Style Moderne, Deco}}
{{Quote
|text=A quote
}}
'''Art Deco''' is a style of [[visual arts|visual art]] that first appeared in France just before World War I and spread worldwide.<ref>Source</ref>

It is characterized by symmetry and bold geometric patterns.

== Influences ==
Not part of the intro.`

describe('wikitext', () => {
  it('parses the infobox, keeping nested links and templates intact', () => {
    const { fields, end } = parseInfobox(page)
    expect(fields.title1).toBe('Art Deco')
    expect(fields.key_colours).toBe('Black<br>silver, gold{{Ref|x}}')
    expect(page.slice(end).trimStart().startsWith('{{Quote')).toBe(true)
  })

  it('cleans markup', () => {
    expect(plain("'''Bold''' [[a|b]] [[c]] {{t|{{u}}}} x<br/>y &amp; z")).toBe('Bold b c x\ny & z')
    expect(stripTemplates('a{{b\n|c={{d}}\n}}e')).toBe('ae')
  })

  it('splits lists without breaking parentheses', () => {
    const { fields } = parseInfobox(page)
    expect(plainList(fields.key_motifs)).toEqual(['Bold geometric shapes (chevrons, sunbursts, zig-zags)', 'Stepped forms', 'Symmetry'])
    expect(plainList(fields.key_colours)).toEqual(['Black', 'Silver', 'Gold'])
    expect(plainList('Luxury, "machine aesthetic," speed')).toEqual(['Luxury', '"machine aesthetic"', 'Speed'])
  })

  it('reads link targets', () => {
    expect(linkTargets(parseInfobox(page).fields.related_aesthetics)).toEqual(['Art Nouveau', 'Bauhaus'])
  })

  it('finds the first decade', () => {
    expect(decadeYear('1910s–1930s')).toBe(1910)
    expect(decadeYear('Mid-1970s (Music)\n1980s (Art)')).toBe(1970)
    expect(decadeYear('Late 2010s')).toBe(2010)
    expect(decadeYear('1925')).toBe(1920)
    expect(decadeYear('Unknown')).toBeUndefined()
  })

  it('takes the opening paragraphs only', () => {
    const intro = introText(page, parseInfobox(page).end)
    expect(intro).toBe(
      'Art Deco is a style of visual art that first appeared in France just before World War I and spread worldwide.\n\nIt is characterized by symmetry and bold geometric patterns.',
    )
  })
})
