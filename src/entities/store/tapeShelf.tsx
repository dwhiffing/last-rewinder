import { memo } from 'react'
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

const tierSpacing = (SHELF_HEIGHT - PANEL) / SHELF_TIERS
const slotSpacing = (SHELF_WIDTH - PANEL * 2) / SLOTS_PER_TIER

const slotPosition = (tier: number, slot: number): [number, number, number] => [
  -SHELF_WIDTH / 2 + PANEL + slotSpacing * (slot + 0.5),
  tier * tierSpacing + PANEL + TAPE_SIZE[1] / 2,
  SHELF_DEPTH / 2 - TAPE_SIZE[2] / 2 - 0.01,
]


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
      <meshStandardMaterial color={GENRE_COLORS[tape.genre]} roughness={0.6} />
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
        position={[0, SHELF_HEIGHT + 0.16, 0]}
        width={SHELF_WIDTH * 0.5}
        height={0.24}
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
