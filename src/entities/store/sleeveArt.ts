// Worn cardboard rental sleeves. A shelved tape shows the cassette's spine
// through the sleeve's open end; the rest of it is printed card in the genre
// color, scuffed down to bare grey-white board along its edges and corners
// from years of being pulled off the shelf. Textures are drawn on canvases,
// a few variants per color, made on first use and shared.
import { CanvasTexture, SRGBColorSpace } from 'three'
import { mulberry32, type Rand } from '../../data/random'

const VARIANTS = 3
// bare board where the print has rubbed off, and grime along the tear
const BOARD = [233, 226, 210]
const PX_PER_M = 740

const cache = new Map<string, CanvasTexture>()

function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

// which of the variants a tape gets, the same every time
export const sleeveVariant = (tapeId: string) => hashString(tapeId) % VARIANTS

// How far wear eats in from an edge at each pixel along it: a wobbly base
// with the odd deeper chip (the corners are rounded off separately)
function edgeProfile(rand: Rand, length: number, depth: number) {
  const phases = [rand() * 6.28, rand() * 6.28, rand() * 6.28]
  const out: number[] = []
  let chip = 0
  let chipDepth = 0
  for (let i = 0; i < length; i++) {
    const t = i / length
    const wobble =
      0.5 +
      0.25 * Math.sin(t * 9 + phases[0]) +
      0.15 * Math.sin(t * 23 + phases[1]) +
      0.1 * Math.sin(t * 61 + phases[2])
    if (chip <= 0 && rand() < 0.03) {
      chip = 2 + Math.floor(rand() * 6)
      chipDepth = depth * (0.8 + rand() * 1.4)
    }
    let d = depth * (0.25 + 0.6 * wobble)
    if (chip > 0) {
      d = Math.max(d, chipDepth)
      chip--
    }
    // and it's never quite continuous
    if (rand() < 0.12) d *= 0.35
    out.push(d)
  }
  return out
}

// Rubbed-through card along all four edges of a w x h face
function wearEdges(g: CanvasRenderingContext2D, rand: Rand, w: number, h: number, depth: number) {
  const edges: [number, (i: number, d: number) => [number, number, number, number]][] = [
    [w, (i, d) => [i, 0, 1, d]], // top
    [w, (i, d) => [i, h - d, 1, d]], // bottom
    [h, (i, d) => [0, i, d, 1]], // left
    [h, (i, d) => [w - d, i, d, 1]], // right
  ]
  for (const [length, rect] of edges) {
    const profile = edgeProfile(rand, length, depth)
    profile.forEach((d, i) => {
      if (d < 0.4) return
      const a = 0.55 + rand() * 0.4
      g.fillStyle = `rgba(${BOARD[0]},${BOARD[1]},${BOARD[2]},${a})`
      g.fillRect(...rect(i, d))
      // a darker frayed line where the print tore away
      g.fillStyle = 'rgba(40,30,20,0.18)'
      const [x, y, rw, rh] = rect(i, d)
      if (rw === 1) g.fillRect(x, y === 0 ? d : y - 1, 1, 1)
      else g.fillRect(x === 0 ? d : x - 1, y, 1, 1)
    })
  }
}

// Corners take the most knocks: each is worn round, the bare board showing
// outside a rough quarter circle
function roundCorners(g: CanvasRenderingContext2D, rand: Rand, w: number, h: number) {
  for (const [cx, cy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    const r = Math.min(w, h) * (0.14 + rand() * 0.08)
    // centre of the rounded print corner, r in from both edges
    const ox = cx ? w - r : r
    const oy = cy ? h - r : r
    for (let y = 0; y < Math.ceil(r); y++) {
      for (let x = 0; x < Math.ceil(r); x++) {
        const px = cx ? w - 1 - x : x
        const py = cy ? h - 1 - y : y
        const dist = Math.hypot(px + 0.5 - ox, py + 0.5 - oy)
        // a little ragged along the curve
        const edge = r - rand() * 1.5
        if (dist < edge) continue
        const a = dist < edge + 1 ? 0.45 : 0.6 + rand() * 0.35
        g.fillStyle = `rgba(${BOARD[0]},${BOARD[1]},${BOARD[2]},${a})`
        g.fillRect(px, py, 1, 1)
      }
    }
  }
}

// Paper grain, a few scuffs and a crease or two over the print
function ageCard(g: CanvasRenderingContext2D, rand: Rand, w: number, h: number) {
  for (let i = 0; i < (w * h) / 6; i++) {
    const light = rand() < 0.5
    g.fillStyle = light ? `rgba(255,255,255,${rand() * 0.07})` : `rgba(0,0,0,${rand() * 0.09})`
    g.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1, 1)
  }
  // scuffs: short pale streaks where it's rubbed against its neighbours
  for (let i = 0; i < 4 + rand() * 5; i++) {
    g.strokeStyle = `rgba(${BOARD[0]},${BOARD[1]},${BOARD[2]},${0.08 + rand() * 0.14})`
    g.lineWidth = 1 + rand() * 2
    const x = rand() * w
    const y = rand() * h
    const len = 4 + rand() * w * 0.4
    const angle = (rand() - 0.5) * 0.8 + (rand() < 0.5 ? 0 : Math.PI / 2)
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
    g.stroke()
  }
  // creases: a faint pale line with a shadow beside it
  for (let i = 0; i < Math.floor(rand() * 3); i++) {
    const horizontal = rand() < 0.6
    const at = (horizontal ? h : w) * (0.1 + rand() * 0.8)
    const from = rand() * 0.3
    const to = 0.6 + rand() * 0.4
    g.lineWidth = 1
    for (const [offset, style] of [
      [0, 'rgba(255,255,255,0.22)'],
      [1, 'rgba(0,0,0,0.18)'],
    ] as const) {
      g.strokeStyle = style
      g.beginPath()
      if (horizontal) {
        g.moveTo(w * from, at + offset)
        g.lineTo(w * to, at + offset + (rand() - 0.5) * 3)
      } else {
        g.moveTo(at + offset, h * from)
        g.lineTo(at + offset + (rand() - 0.5) * 3, h * to)
      }
      g.stroke()
    }
  }
}

function cardTexture(key: string, color: string, widthM: number, heightM: number, variant: number) {
  const cacheKey = `${key}:${color}:${variant}`
  const cached = cache.get(cacheKey)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(16, Math.round(widthM * PX_PER_M))
  canvas.height = Math.max(16, Math.round(heightM * PX_PER_M))
  const g = canvas.getContext('2d')!
  const rand = mulberry32(hashString(cacheKey))
  const { width: w, height: h } = canvas
  g.fillStyle = color
  g.fillRect(0, 0, w, h)
  ageCard(g, rand, w, h)
  wearEdges(g, rand, w, h, Math.max(1.5, Math.min(w, h) * 0.035))
  roundCorners(g, rand, w, h)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  cache.set(cacheKey, tex)
  return tex
}

// The sleeve's big printed sides (a box's +x and -x faces: depth by height)
export const sleeveSideTexture = (color: string, depth: number, height: number, variant: number) =>
  cardTexture('side', color, depth, height, variant)

// Its folded top and bottom edges (+y and -y faces: width by depth)
export const sleeveEdgeTexture = (color: string, width: number, depth: number, variant: number) =>
  cardTexture('edge', color, width, depth, variant)

// Around the cassette on the spine face, the sleeve's own card shows as a
// thin rim with a ragged, worn edge. Drawn under the cassette's sticker.
export function drawSleeveRim(g: CanvasRenderingContext2D, tapeId: string, color: string, W: number, H: number) {
  const rand = mulberry32(hashString(`rim:${tapeId}`))
  const side = W * 0.06
  const end = W * 0.05
  g.fillStyle = color
  for (let y = 0; y < H; y++) {
    const jitter = () => (rand() < 0.15 ? rand() * side * 0.6 : rand() * side * 0.2)
    g.fillRect(0, y, side + jitter(), 1)
    const r = side + jitter()
    g.fillRect(W - r, y, r, 1)
  }
  for (let x = 0; x < W; x++) {
    const jitter = () => (rand() < 0.15 ? rand() * end * 0.6 : rand() * end * 0.2)
    g.fillRect(x, 0, 1, end + jitter())
    const b = end + jitter()
    g.fillRect(x, H - b, 1, b)
  }
  // the very edge of the card, rubbed down to bare board in places
  for (let y = 0; y < H; y++) {
    for (const x of [0, W - 1]) {
      if (rand() < 0.55) continue
      g.fillStyle = `rgba(${BOARD[0]},${BOARD[1]},${BOARD[2]},${0.4 + rand() * 0.5})`
      g.fillRect(x === 0 ? 0 : W - 2, y, 2, 1)
    }
  }
  for (let x = 0; x < W; x++) {
    for (const y of [0, H - 1]) {
      if (rand() < 0.4) continue
      g.fillStyle = `rgba(${BOARD[0]},${BOARD[1]},${BOARD[2]},${0.4 + rand() * 0.5})`
      g.fillRect(x, y === 0 ? 0 : H - 2, 1, 2)
    }
  }
}
