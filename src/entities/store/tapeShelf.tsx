import { memo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
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
import Label from './label'

const WOOD = '#6b4a2b'
const PANEL = 0.03
// A VHS box standing spine-out (spine exaggerated so it's easy to click)
const TAPE_SIZE: [number, number, number] = [0.1, 0.21, 0.13]

// A header panel across the top of the front carries the shelf's sign
const HEADER = 0.24
const tierSpacing = (SHELF_HEIGHT - HEADER - PANEL) / SHELF_TIERS
const slotSpacing = (SHELF_WIDTH - PANEL * 2) / SLOTS_PER_TIER

const slotPosition = (tier: number, slot: number): [number, number, number] => [
  -SHELF_WIDTH / 2 + PANEL + slotSpacing * (slot + 0.5),
  tier * tierSpacing + PANEL + TAPE_SIZE[1] / 2,
  SHELF_DEPTH / 2 - TAPE_SIZE[2] / 2 - 0.01,
]

// Spine art: the title running bottom-to-top on the genre color. One texture
// per tape, made on first use and kept for the whole game.
const spineTextures = new Map<string, CanvasTexture>()
function spineTexture(tapeId: string) {
  const cached = spineTextures.get(tapeId)
  if (cached) return cached
  const tape = tapeById(tapeId)
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 200
  const g = canvas.getContext('2d')!
  g.fillStyle = GENRE_COLORS[tape.genre]
  g.fillRect(0, 0, canvas.width, canvas.height)
  // light label band behind the title so it reads on any genre color
  g.fillStyle = '#f4efe2'
  g.fillRect(12, 6, canvas.width - 24, canvas.height - 12)
  g.translate(canvas.width / 2, canvas.height / 2)
  g.rotate(-Math.PI / 2)
  g.fillStyle = '#111'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const words = tape.title.toUpperCase()
  const size = words.length > 16 ? 26 : 32
  g.font = `bold ${size}px sans-serif`
  g.fillText(words, 0, 0, canvas.height - 20)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  spineTextures.set(tapeId, tex)
  return tex
}

// One slot: either a tape you can pick up or an empty space you can fill
const Slot = memo(function Slot({ id, tier, slot }: { id: string; tier: number; slot: number }) {
  const tapeId = useGameStore((s) => s.slots[id])
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

  const tape = tapeById(tapeId)
  return (
    // keyed by tape so a swap mounts a fresh mesh and the hover picks it up
    <mesh
      key={tapeId}
      name="tape"
      userData={{ label: `${tape.title} (${tape.genre})`, slotId: id }}
      castShadow
      position={position}>
      <boxGeometry args={TAPE_SIZE} />
      {/* box faces are +x, -x, +y, -y, +z (the spine, facing out), -z */}
      {[0, 1, 2, 3, 4, 5].map((face) =>
        face === 4 ? (
          <meshStandardMaterial key={face} attach={`material-${face}`} map={spineTexture(tapeId)} roughness={0.6} />
        ) : (
          <meshStandardMaterial key={face} attach={`material-${face}`} color={GENRE_COLORS[tape.genre]} roughness={0.6} />
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
          color={WOOD}
        />
        {/* side panels */}
        {[-1, 1].map((side) => (
          <Block
            key={side}
            size={[PANEL, SHELF_HEIGHT, SHELF_DEPTH]}
            position={[side * (SHELF_WIDTH / 2 - PANEL / 2), SHELF_HEIGHT / 2, 0]}
            color={WOOD}
          />
        ))}
        {/* tier boards */}
        {Array.from({ length: SHELF_TIERS + 1 }).map((_, i) => (
          <Block
            key={i}
            size={[SHELF_WIDTH, PANEL, SHELF_DEPTH]}
            position={[0, i * tierSpacing + PANEL / 2, 0]}
            color={WOOD}
          />
        ))}
      </group>

      <Label
        text={`SHELF ${id}`}
        position={[0, SHELF_HEIGHT - HEADER / 2, SHELF_DEPTH / 2 + 0.005]}
        width={SHELF_WIDTH * 0.5}
        height={HEADER - 0.04}
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
