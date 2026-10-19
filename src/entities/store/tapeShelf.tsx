import { memo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { isSnack, snackOf } from '../../data/snacks'
import { GENRE_COLORS, tapeById } from '../../data/tapes'
import {
  SHELF_DEPTH,
  SHELF_HEIGHT,
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
const TAPE_SIZE: [number, number, number] = [0.085, tierSpacing - PANEL, 0.13]
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
function spineTexture(tapeId: string) {
  const cached = spineTextures.get(tapeId)
  if (cached) return cached
  const snack = isSnack(tapeId) ? snackOf(tapeId) : null
  const tape = snack ? null : tapeById(tapeId)
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = Math.round((canvas.width * TAPE_SIZE[1]) / TAPE_SIZE[0])
  const g = canvas.getContext('2d')!
  g.fillStyle = snack ? snack.color : GENRE_COLORS[tape!.genre]
  g.fillRect(0, 0, canvas.width, canvas.height)
  // light label band behind the title so it reads on any genre color
  g.fillStyle = '#f4efe2'
  g.fillRect(12, 6, canvas.width - 24, canvas.height - 12)
  g.translate(canvas.width / 2, canvas.height / 2)
  g.rotate(-Math.PI / 2)
  g.fillStyle = '#111'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const title = (snack ? snack.type : tape!.title).toUpperCase()
  const lines = title.length > 12 ? splitInTwo(title) : [title]
  const size = lines.length > 1 ? 26 : 32
  g.font = `bold ${size}px sans-serif`
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * size * 1.05
    g.fillText(line, 0, y, canvas.height - 20)
  })
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  spineTextures.set(tapeId, tex)
  return tex
}

// One slot: either a tape you can pick up or an empty space you can fill
const Slot = memo(function Slot({ id, tier, slot }: { id: string; tier: number; slot: number }) {
  const tapeId = useGameStore((s) => s.slots[id])
  // the right half of a wide snack box: the box itself takes the clicks
  const covered = useGameStore((s) => !!coveringSlot(s.slots, id))
  if (covered) return null
  const position = slotPosition(tier, slot)

  if (!tapeId) {
    return (
      // Invisible but still hit by the pointer ray (material hidden, mesh visible)
      <mesh key="empty" name="slot" userData={{ label: 'Empty slot', slotId: id }} position={position}>
        <boxGeometry args={TAPE_SIZE} />
        <meshBasicMaterial visible={false} />
      </mesh>
    )
  }

  const snack = isSnack(tapeId) ? snackOf(tapeId) : null
  const color = snack ? snack.color : GENRE_COLORS[tapeById(tapeId).genre]
  const label = snack ? `${snack.type} (snack)` : `${tapeById(tapeId).title} (${tapeById(tapeId).genre})`
  if (snack?.type === 'Soda') {
    // a can standing on the shelf board
    const [x, y, z] = position
    return (
      <SodaCan
        key={tapeId}
        name="tape"
        userData={{ label, slotId: id }}
        position={[x, y - TAPE_SIZE[1] / 2 + CAN_HEIGHT / 2, z]}
      />
    )
  }
  if (snack) {
    // a box standing on the shelf board, front flush with the tape spines
    const [x, y, z] = position
    const size = snackBoxSize(snack.type, slotSpacing * 2 - 0.01, TAPE_SIZE[1] - 0.01)
    const [, h, d] = size
    return (
      <SnackBox
        key={tapeId}
        type={snack.type}
        size={size}
        name="tape"
        userData={{ label, slotId: id }}
        position={[x + slotSpacing / 2, y - TAPE_SIZE[1] / 2 + h / 2, z + TAPE_SIZE[2] / 2 - d / 2]}
      />
    )
  }
  return (
    // keyed by tape so a swap mounts a fresh mesh and the hover picks it up
    <mesh
      key={tapeId}
      name="tape"
      userData={{ label, slotId: id }}
      castShadow
      position={position}>
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
        // fills the header between the side panels, above the top board
        position={[0, SHELF_HEIGHT - HEADER / 2, SHELF_DEPTH / 2 - 0.002]}
        width={SHELF_WIDTH - PANEL * 2}
        height={HEADER}
        background="#1d3fbf"
        color="#ffd400"
      />

      {Array.from({ length: SHELF_TIERS }).flatMap((_, tier) =>
        Array.from({ length: SLOTS_PER_TIER }).map((_, slot) => {
          const sid = slotId(id, tier, slot)
          return <Slot key={sid} id={sid} tier={tier} slot={slot} />
        }),
      )}
    </group>
  )
}

export default TapeShelf
