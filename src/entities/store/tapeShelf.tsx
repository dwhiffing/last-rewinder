import { type Genre, GENRE_COLORS, tapesForGenre } from '../../data/tapes'
import {
  SHELF_DEPTH,
  SHELF_HEIGHT,
  SHELF_WIDTH,
} from '../../data/storeLayout'
import Block from './block'
import Label from './label'

const WOOD = '#6b4a2b'

export const SHELF_TIERS = 5
export const SLOTS_PER_TIER = 12

const PANEL = 0.03
// A VHS box standing spine-out
const TAPE_SIZE: [number, number, number] = [0.06, 0.21, 0.13]

// Freestanding shelf unit labelled with a genre. Front faces local +z.
// Tapes stand spine-out in slots; for now each unit is stocked with its own genre.
export function TapeShelf({
  genre,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: {
  genre: Genre
  position?: [number, number, number]
  rotation?: [number, number, number]
}) {
  const tierSpacing = (SHELF_HEIGHT - PANEL) / SHELF_TIERS
  const slotSpacing = (SHELF_WIDTH - PANEL * 2) / SLOTS_PER_TIER
  const tapes = tapesForGenre(genre)
  const label = `Shelf: ${genre}`

  return (
    <group position={position} rotation={rotation}>
      <group name="shelf" userData={{ label, genre }}>
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
        text={genre.toUpperCase()}
        position={[0, SHELF_HEIGHT + 0.16, 0]}
        width={SHELF_WIDTH * 0.8}
        height={0.26}
        background={GENRE_COLORS[genre]}
        color={genre === 'Comedy' ? '#000' : '#fff'}
      />

      {tapes.map((tape, i) => {
        // spread the placeholder stock over the middle tiers
        const tier = Math.floor(i / 3) + 1
        const slot = (i % 3) * 4 + 1
        const x = -SHELF_WIDTH / 2 + PANEL + slotSpacing * (slot + 0.5)
        const y = tier * tierSpacing + PANEL + TAPE_SIZE[1] / 2
        return (
          <mesh
            key={tape.id}
            name="tape"
            userData={{ label: `${tape.title} (${tape.genre})`, tapeId: tape.id }}
            castShadow
            position={[x, y, SHELF_DEPTH / 2 - TAPE_SIZE[2] / 2 - 0.01]}>
            <boxGeometry args={TAPE_SIZE} />
            <meshStandardMaterial color={GENRE_COLORS[tape.genre]} roughness={0.6} />
          </mesh>
        )
      })}
    </group>
  )
}

export default TapeShelf
