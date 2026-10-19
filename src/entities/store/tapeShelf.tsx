import { memo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { isSnack, isWide, snackOf } from '../../data/snacks'
import { GENRE_COLORS, tapeById } from '../../data/tapes'
import {
  SHELF_DEPTH,
  SHELF_HEIGHT,
  FIRST_TIER,
  SHELF_TIERS,
  SHELF_WIDTH,
  SLOTS_PER_TIER,
  slotId,
} from '../../data/storeLayout'
import useGameStore from '../../stores/gameStore'
import Block from './block'
import { WOOD } from './textures'
import Label from './label'
import { coveringSlot } from '../../data/storeLayout'
import SnackBox, { snackBoxSize } from './snackBox'
import SodaCan, { CAN_HEIGHT } from './sodaCan'

const PANEL = 0.03
// A header panel across the top of the front carries the shelf's sign
const HEADER = 0.24
const tierSpacing = (SHELF_HEIGHT - HEADER - PANEL) / SHELF_TIERS

// A VHS box standing spine-out, filling the full height between tier boards
const TAPE_SIZE: [number, number, number] = [0.0765, tierSpacing - PANEL, 0.13]
const slotSpacing = (SHELF_WIDTH - PANEL * 2) / SLOTS_PER_TIER

const slotPosition = (tier: number, slot: number): [number, number, number] => [
  -SHELF_WIDTH / 2 + PANEL + slotSpacing * (slot + 0.5),
  tier * tierSpacing + PANEL + TAPE_SIZE[1] / 2,
  SHELF_DEPTH / 2 - TAPE_SIZE[2] / 2 - 0.01,
]

// Break a title at the space closest to its middle
function splitInTwo(title: string) {
  const mid = title.length / 2
  let best = -1
  for (let i = 0; i < title.length; i++) {
    if (title[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
  }
  return best < 0 ? [title] : [title.slice(0, best), title.slice(best + 1)]
}

// Spine art: the title running bottom-to-top on the genre color (or a snack's
// type on its color). One texture per item, made on first use and kept.
const spineTextures = new Map<string, CanvasTexture>()
export function spineTexture(tapeId: string) {
  const cached = spineTextures.get(tapeId)
  if (cached) return cached
  const snack = isSnack(tapeId) ? snackOf(tapeId) : null
  const tape = snack ? null : tapeById(tapeId)
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = Math.round((canvas.width * TAPE_SIZE[1]) / TAPE_SIZE[0])
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  spineTextures.set(tapeId, tex)
  drawSpine(canvas, snack, tape)
  // redraw once the marker font has loaded, if it wasn't ready yet
  if (!document.fonts.check(SPINE_FONT_CHECK)) {
    document.fonts.load(SPINE_FONT_CHECK).then(() => {
      drawSpine(canvas, snack, tape)
      tex.needsUpdate = true
    })
  }
  return tex
}

const SPINE_FONT_CHECK = '32px "Permanent Marker"'
function drawSpine(
  canvas: HTMLCanvasElement,
  snack: ReturnType<typeof snackOf> | null,
  tape: ReturnType<typeof tapeById> | null,
) {
  const g = canvas.getContext('2d')!
  g.setTransform(1, 0, 0, 1, 0, 0)
  const W = canvas.width
  const H = canvas.height
  // black plastic spine with a white sticker label, rounded at the corners
  g.fillStyle = '#111'
  g.fillRect(0, 0, W, H)
  const labelW = W * 0.8
  const labelH = H * 0.76
  g.fillStyle = '#f4efe2'
  g.beginPath()
  g.roundRect((W - labelW) / 2, (H - labelH) / 2, labelW, labelH, W * 0.08)
  g.fill()
  g.translate(W / 2, H / 2)
  g.rotate(-Math.PI / 2)
  g.fillStyle = '#1328C6'
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  const title = (snack ? snack.type : tape!.title).toUpperCase()
  const lines = title.length > 12 ? splitInTwo(title) : [title]
  // marker capitals sit well inside their em box, so lines can stack tightly
  const size = W * (lines.length > 1 ? 0.44 : 0.54)
  g.font = `${size}px "Permanent Marker", sans-serif`
  // centre the drawn capitals across the spine (the font's own middle sits
  // low, which pushed the text off the right edge of the label)
  const cap = g.measureText('H')
  const capH = cap.actualBoundingBoxAscent - cap.actualBoundingBoxDescent
  const lineH = size * 0.82
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lineH + capH / 2 - W * 0.02
    g.fillText(line, 0, y, labelH - W * 0.12)
  })
}

// One slot: either a tape you can pick up or an empty space you can fill
const Slot = memo(function Slot({ id, tier, slot }: { id: string; tier: number; slot: number }) {
  const tapeId = useGameStore((s) => s.slots[id])
  // the right half of a wide snack box: the box itself takes the clicks
  const covered = useGameStore((s) => !!coveringSlot(s.slots, id))
  if (covered) return null
  const position = slotPosition(tier, slot)

  // Each slot's click box fills its whole cell, so there are no gaps between
  // slots that ignore the pointer (a wide snack's box covers two cells)
  const wide = isWide(tapeId)
  const [x, y, z] = position
  const hit = (
    <mesh position={[x + (wide ? slotSpacing / 2 : 0), y, z]}>
      <boxGeometry args={[slotSpacing * (wide ? 2 : 1), TAPE_SIZE[1], TAPE_SIZE[2]]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )

  if (!tapeId) {
    return (
      <group key="empty" name="slot" userData={{ label: 'Empty slot', slotId: id }}>
        {hit}
      </group>
    )
  }

  const snack = isSnack(tapeId) ? snackOf(tapeId) : null
  const color = snack ? snack.color : GENRE_COLORS[tapeById(tapeId).genre]
  const label = snack ? `${snack.type} (snack)` : tapeById(tapeId).title
  let item
  if (snack?.type === 'Soda') {
    // a can standing on the shelf board
    item = <SodaCan position={[x, y - TAPE_SIZE[1] / 2 + CAN_HEIGHT / 2, z]} />
  } else if (snack) {
    // a box standing on the shelf board, front flush with the tape spines
    const size = snackBoxSize(snack.type, slotSpacing * 2 - 0.01, TAPE_SIZE[1] - 0.01)
    const [, h, d] = size
    item = (
      <SnackBox
        type={snack.type}
        size={size}
        position={[x + slotSpacing / 2, y - TAPE_SIZE[1] / 2 + h / 2, z + TAPE_SIZE[2] / 2 - d / 2]}
      />
    )
  } else {
    item = (
      <mesh castShadow position={position}>
        <boxGeometry args={TAPE_SIZE} />
        {/* box faces are +x, -x, +y, -y, +z (the spine, facing out), -z */}
        {[0, 1, 2, 3, 4, 5].map((face) =>
          face === 4 ? (
            <meshStandardMaterial key={face} attach={`material-${face}`} map={spineTexture(tapeId)} roughness={0.6} />
          ) : (
            <meshStandardMaterial key={face} attach={`material-${face}`} color={color} roughness={0.6} />
          ),
        )}
      </mesh>
    )
  }
  return (
    // keyed by tape so a swap mounts a fresh group and the hover picks it up
    <group key={tapeId} name="tape" userData={{ label, slotId: id }}>
      {hit}
      {item}
    </group>
  )
})

// Freestanding shelf unit with a grid of tape slots. Front faces local +z.
export function TapeShelf({
  id,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: {
  id: string
  position?: [number, number, number]
  rotation?: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      <group name="shelf" userData={{ label: `Shelf ${id}` }}>
        {/* back panel */}
        <Block
          size={[SHELF_WIDTH, SHELF_HEIGHT, PANEL]}
          position={[0, SHELF_HEIGHT / 2, -SHELF_DEPTH / 2 + PANEL / 2]}
          color="#ffffff"
            textures={WOOD}
        />
        {/* side panels */}
        {[-1, 1].map((side) => (
          <Block
            key={side}
            size={[PANEL, SHELF_HEIGHT, SHELF_DEPTH]}
            position={[side * (SHELF_WIDTH / 2 - PANEL / 2), SHELF_HEIGHT / 2, 0]}
            color="#ffffff"
            textures={WOOD}
          />
        ))}
        {/* tier boards */}
        {Array.from({ length: SHELF_TIERS + 1 }).map((_, i) => (
          <Block
            key={i}
            size={[SHELF_WIDTH, PANEL, SHELF_DEPTH]}
            position={[0, i * tierSpacing + PANEL / 2, 0]}
            color="#ffffff"
            textures={WOOD}
          />
        ))}
      </group>

      <Label
        text={`SHELF ${id}`}
        marquee
        // fills the header between the side panels, above the top board
        position={[0, SHELF_HEIGHT - HEADER / 2, SHELF_DEPTH / 2 - 0.002]}
        width={SHELF_WIDTH - PANEL * 2}
        height={HEADER}
        background="#1d3fbf"
        color="#ffd400"
      />

      {/* the bottom tier is closed off with a plain blue panel */}
      <Label
        text=""
        position={[0, PANEL + (tierSpacing - PANEL) / 2, SHELF_DEPTH / 2 - 0.002]}
        width={SHELF_WIDTH - PANEL * 2}
        height={tierSpacing - PANEL}
        background="#1d3fbf"
      />

      {Array.from({ length: SHELF_TIERS - FIRST_TIER }, (_, i) => i + FIRST_TIER).flatMap((tier) =>
        Array.from({ length: SLOTS_PER_TIER }).map((_, slot) => {
          const sid = slotId(id, tier, slot)
          return <Slot key={sid} id={sid} tier={tier} slot={slot} />
        }),
      )}
    </group>
  )
}

export default TapeShelf
