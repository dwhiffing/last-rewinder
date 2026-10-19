import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace, type Group } from 'three'
import { GENRE_COLORS, lengthOf, RATING_COLORS, tapeById } from '../../data/tapes'
import { spineTexture } from './tapeShelf'

// The tape in your hands: a VHS case with the cover art printed on the front
// and the blurb on the back. Sizes in metres, art drawn at PX pixels per CSS
// pixel of the old 170x250 card.
export const CASE_SIZE: [number, number, number] = [0.17, 0.25, 0.035]
const CARD_W = 170
const CARD_H = 250
const PX = 4

type Tape = ReturnType<typeof tapeById>

function makeCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W * PX
  canvas.height = CARD_H * PX
  const g = canvas.getContext('2d')!
  g.scale(PX, PX)
  return { canvas, g }
}

function toTexture(canvas: HTMLCanvasElement) {
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// Break text into lines that fit a width, in the context's current font
function wrap(g: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && g.measureText(next).width > width) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function frontArt(tape: Tape, unrewound: boolean) {
  const { canvas, g } = makeCanvas()
  g.fillStyle = GENRE_COLORS[tape.genre]
  g.fillRect(0, 0, CARD_W, CARD_H)
  const shade = g.createLinearGradient(0, 0, CARD_W * 0.6, CARD_H)
  shade.addColorStop(0, 'rgba(255,255,255,0.25)')
  shade.addColorStop(1, 'rgba(0,0,0,0.35)')
  g.fillStyle = shade
  g.fillRect(0, 0, CARD_W, CARD_H)

  g.fillStyle = '#fff'
  g.shadowColor = 'rgba(0,0,0,0.7)'
  g.shadowBlur = 3
  g.shadowOffsetY = 1
  g.textBaseline = 'top'
  g.font = '10px sans-serif'
  g.letterSpacing = '1px'
  wrap(g, tape.actors.join(' · ').toUpperCase(), CARD_W - 20).forEach((l, i) =>
    g.fillText(l, 10, 12 + i * 13),
  )
  g.letterSpacing = '0px'

  g.font = '900 22px sans-serif'
  const title = wrap(g, tape.title.toUpperCase(), CARD_W - 20)
  const lineH = 22 * 1.05
  const top = (CARD_H - title.length * lineH) / 2
  title.forEach((l, i) => g.fillText(l, 10, top + i * lineH))

  // rating badge and year along the foot
  g.font = 'bold 11px sans-serif'
  const badgeW = g.measureText(tape.rating).width + 12
  const badgeY = CARD_H - 12 - 19
  g.shadowColor = 'transparent'
  g.fillStyle = RATING_COLORS[tape.rating]
  g.beginPath()
  g.roundRect(10, badgeY, badgeW, 19, 4)
  g.fill()
  g.strokeStyle = '#fff'
  g.lineWidth = 2
  g.stroke()
  g.fillStyle = '#fff'
  g.textBaseline = 'middle'
  g.fillText(tape.rating, 16, badgeY + 10)
  g.font = '12px sans-serif'
  g.textAlign = 'right'
  g.shadowColor = 'rgba(0,0,0,0.7)'
  g.fillText(String(tape.year), CARD_W - 10, badgeY + 10)
  g.textAlign = 'left'

  if (unrewound) {
    g.save()
    g.translate(CARD_W - 6 - 52, CARD_H * 0.4 + 10)
    g.rotate((-12 * Math.PI) / 180)
    g.shadowColor = 'rgba(0,0,0,0.5)'
    g.shadowBlur = 4
    g.shadowOffsetY = 2
    g.fillStyle = '#ffd400'
    g.fillRect(-52, -10, 104, 20)
    g.shadowColor = 'transparent'
    g.fillStyle = '#111'
    g.font = '900 11px sans-serif'
    g.textAlign = 'center'
    g.fillText('PLEASE REWIND', 0, 1)
    g.restore()
  }
  return toTexture(canvas)
}

function backArt(tape: Tape) {
  const { canvas, g } = makeCanvas()
  g.fillStyle = '#f4efe2'
  g.fillRect(0, 0, CARD_W, CARD_H)
  g.fillStyle = '#222'
  g.textBaseline = 'top'
  const w = CARD_W - 20
  let y = 10
  g.font = 'bold 13px sans-serif'
  for (const l of wrap(g, tape.title, w)) {
    g.fillText(l, 10, y)
    y += 15
  }
  y += 6
  g.font = 'italic 11px sans-serif'
  for (const l of wrap(g, tape.bio, w)) {
    g.fillText(l, 10, y)
    y += 14.3
  }
  y += 6
  const stats: [string, string][] = [
    ['GENRE', tape.genre],
    ['RATED', tape.rating],
    ['RELEASED', `${tape.year} (${tape.decade})`],
    ['RUNTIME', `${tape.minutes} min (${lengthOf(tape.minutes)})`],
    ['STARRING', tape.actors.join(', ')],
  ]
  g.font = 'bold 9px sans-serif'
  const labelW = Math.max(...stats.map(([k]) => g.measureText(k).width)) + 6
  for (const [k, v] of stats) {
    g.font = 'bold 9px sans-serif'
    g.fillText(k, 10, y + 1)
    g.font = '11px sans-serif'
    for (const l of wrap(g, v, w - labelW)) {
      g.fillText(l, 10 + labelW, y)
      y += 13
    }
    y += 2
  }
  return toTexture(canvas)
}

export function HeldTape({ tapeId, unrewound, flipped }: { tapeId: string; unrewound: boolean; flipped: boolean }) {
  const ref = useRef<Group>(null)
  const tape = tapeById(tapeId)
  const front = useMemo(() => frontArt(tape, unrewound), [tape, unrewound])
  const back = useMemo(() => backArt(tape), [tape])
  const spine = spineTexture(tapeId)
  useEffect(() => () => front.dispose(), [front])
  useEffect(() => () => back.dispose(), [back])
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const target = flipped ? Math.PI : 0
    g.rotation.y += (target - g.rotation.y) * (1 - Math.exp(-10 * dt))
  })
  const edge = '#151515'
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={CASE_SIZE} />
        {/* faces: +x, -x (spines), +y, -y, +z (front cover), -z (back cover) */}
        <meshStandardMaterial attach="material-0" map={spine} roughness={0.6} />
        <meshStandardMaterial attach="material-1" map={spine} roughness={0.6} />
        <meshStandardMaterial attach="material-2" color={edge} roughness={0.6} />
        <meshStandardMaterial attach="material-3" color={edge} roughness={0.6} />
        <meshStandardMaterial attach="material-4" map={front} roughness={0.5} />
        <meshStandardMaterial attach="material-5" map={back} roughness={0.5} />
      </mesh>
    </group>
  )
}

export default HeldTape
