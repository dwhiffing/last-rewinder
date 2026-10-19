import { CanvasTexture, SRGBColorSpace } from 'three'

// A small green seven-segment readout. Segments are named a (top), b (upper
// right), c (lower right), d (bottom), e (lower left), f (upper left) and
// g (middle). Letters follow the usual 7-segment spellings; W takes two digits.
const GLYPHS: Record<string, string[]> = {
  A: ['abcefg'],
  D: ['bcdeg'],
  E: ['adefg'],
  G: ['acdef'],
  I: ['bc'],
  N: ['abcef'],
  O: ['abcdef'],
  P: ['abefg'],
  R: ['eg'],
  S: ['acdfg'],
  T: ['defg'],
  W: ['cdef', 'bcde'],
  ' ': [''],
}

export const DIGITS = 11
const CELL_W = 40
const CELL_H = 64
const PAD = 8
const ON = '#3cff3c'
const OFF = '#0f2a10'

// Segment shapes as polygons in a cell, slanted slightly like real displays
const T = 6
const W = CELL_W - 12
const H = (CELL_H - 2 * PAD) / 2
function segment(g: CanvasRenderingContext2D, seg: string, x0: number, y0: number) {
  const skew = 0.12
  const pt = (x: number, y: number): [number, number] => [x0 + 6 + x + (CELL_H - y) * skew - 4, y0 + y]
  const horiz = (y: number) => [pt(T, y), pt(W - T, y), pt(W - T / 2, y + T / 2), pt(W - T, y + T), pt(T, y + T), pt(T / 2, y + T / 2)]
  const vert = (x: number, y: number) => [pt(x + T / 2, y + T / 2), pt(x + T, y + T), pt(x + T, y + H - T / 2), pt(x + T / 2, y + H), pt(x, y + H - T / 2), pt(x, y + T)]
  const shapes: Record<string, [number, number][]> = {
    a: horiz(0),
    g: horiz(H - T / 2),
    d: horiz(2 * H - T),
    f: vert(0, 0),
    b: vert(W - T, 0),
    e: vert(0, H - T / 2),
    c: vert(W - T, H - T / 2),
  }
  const poly = shapes[seg]
  g.beginPath()
  poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
  g.fill()
}

const cache = new Map<string, CanvasTexture>()
export function segmentTexture(text: string) {
  const hit = cache.get(text)
  if (hit) return hit
  const cells = [...text.toUpperCase()].flatMap((ch) => GLYPHS[ch] ?? [''])
  // centred in the display
  const lead = Math.max(0, Math.floor((DIGITS - cells.length) / 2))
  const lit = [...Array(lead).fill(''), ...cells]
  const canvas = document.createElement('canvas')
  canvas.width = DIGITS * CELL_W + 2 * PAD
  canvas.height = CELL_H
  const g = canvas.getContext('2d')!
  g.fillStyle = '#020a02'
  g.fillRect(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < DIGITS; i++) {
    const on = lit[i] ?? ''
    for (const seg of 'abcdefg') {
      g.fillStyle = on.includes(seg) ? ON : OFF
      g.shadowColor = on.includes(seg) ? ON : 'transparent'
      g.shadowBlur = on.includes(seg) ? 6 : 0
      segment(g, seg, PAD + i * CELL_W, PAD)
    }
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  cache.set(text, tex)
  return tex
}

// The readout as a glowing plane facing +z
export function SegmentDisplay({
  text,
  position,
  width,
  visible = true,
}: {
  text: string
  position: [number, number, number]
  width: number
  visible?: boolean
}) {
  const height = (width * CELL_H) / (DIGITS * CELL_W + 2 * PAD)
  return (
    <mesh position={position} visible={visible}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={segmentTexture(text)} toneMapped={false} />
    </mesh>
  )
}

export default SegmentDisplay
