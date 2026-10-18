import { useWorld } from 'koota/react'
import { useEffect, useRef } from 'react'
import { type Group } from 'three'
import {
  BACK_Z,
  COUNTER_POSITION,
  COUNTER_SIZE,
  DROP_BIN_POSITION,
  ENTRANCE_X,
  FRONT_Z,
  NODES,
  SHELVES,
  STORE_HEIGHT,
  STORE_WIDTH,
} from '../data/storeLayout'
import FlickerLight from '../entities/flickerLight'
import Block from '../entities/store/block'
import Label from '../entities/store/label'
import TapeShelf from '../entities/store/tapeShelf'
import { Mesh } from '../shared/traits'
import useGameStore from '../stores/gameStore'

const WALL = 0.2
const halfW = STORE_WIDTH / 2
const depth = BACK_Z - FRONT_Z
const centerZ = (BACK_Z + FRONT_Z) / 2
// Two windows either side of the entrance door, filling the front wall
const windowWidth = halfW - WALL - 0.3 - 0.7
const lightX = STORE_WIDTH / 4
const lightZ = depth / 4

const FLOOR_COLOR = '#3a4a6b'
const WALL_COLOR = '#d8d2c4'
const TRIM_COLOR = '#1d3fbf'
const GLASS = '#9fc6e8'
const GLASS_GLOW = '#3d5a7a'

// Placeholder video store. Front of the store (entrance, counter, drop bin)
// is at -z, shelves fill the back half.
export function Store({ hideCeiling = false }: { hideCeiling?: boolean }) {
  const world = useWorld()
  const ref = useRef<Group>(null)

  // Register the store so the controller can find its interactables
  useEffect(() => {
    if (!ref.current) return
    const entity = world.spawn(Mesh(ref.current))
    return () => void entity.destroy()
  }, [world])

  const [cx, , cz] = COUNTER_POSITION
  const [bx, , bz] = DROP_BIN_POSITION
  const frontInner = FRONT_Z + WALL / 2 + 0.01

  return (
    <group ref={ref}>
      {/* shell */}
      <Block size={[STORE_WIDTH, WALL, depth]} position={[0, -WALL / 2, centerZ]} color={FLOOR_COLOR} />
      {!hideCeiling && (
        <Block size={[STORE_WIDTH, WALL, depth]} position={[0, STORE_HEIGHT + WALL / 2, centerZ]} color="#eeeeee" />
      )}
      <Block size={[STORE_WIDTH, STORE_HEIGHT, WALL]} position={[0, STORE_HEIGHT / 2, BACK_Z]} color={WALL_COLOR} />
      <Block size={[STORE_WIDTH, STORE_HEIGHT, WALL]} position={[0, STORE_HEIGHT / 2, FRONT_Z]} color={WALL_COLOR} />
      <Block size={[WALL, STORE_HEIGHT, depth]} position={[halfW, STORE_HEIGHT / 2, centerZ]} color={WALL_COLOR} />
      <Block size={[WALL, STORE_HEIGHT, depth]} position={[-halfW, STORE_HEIGHT / 2, centerZ]} color={WALL_COLOR} />

      {/* store front: windows and entrance (decorative) */}
      {[-1, 1].map((side) => (
        <Block
          key={side}
          size={[windowWidth, 1.2, 0.02]}
          position={[side * (0.7 + windowWidth / 2), 1.25, frontInner]}
          color={GLASS}
          emissive={GLASS_GLOW}
        />
      ))}
      <Block size={[1, 2, 0.02]} position={[ENTRANCE_X, 1, frontInner]} color={GLASS} emissive={GLASS_GLOW} />
      <Label
        text="ENTRANCE"
        position={[ENTRANCE_X, 2.2, frontInner + 0.01]}
        width={1}
        height={0.2}
        background={TRIM_COLOR}
        color="#ffd400"
      />

      {/* checkout counter, customers stand between it and the front wall */}
      <group name="counter" userData={{ label: 'Counter' }}>
        <Block size={COUNTER_SIZE} position={[cx, COUNTER_SIZE[1] / 2, cz]} color={TRIM_COLOR} />
        <Block
          size={[COUNTER_SIZE[0] + 0.1, 0.05, COUNTER_SIZE[2] + 0.1]}
          position={[cx, COUNTER_SIZE[1] + 0.02, cz]}
          color="#ffd400"
        />
      </group>
      <Computer position={[cx + 0.45, COUNTER_SIZE[1] + 0.045, cz]} />
      <Label
        text="CHECKOUT"
        position={[cx, 1.5, cz - 0.1]}
        width={1.4}
        height={0.24}
        background={TRIM_COLOR}
        color="#ffd400"
      />

      {/* quick drop bin for returned tapes */}
      <group name="dropBin" userData={{ label: 'Quick drop bin' }}>
        <Block size={[0.6, 0.7, 0.6]} position={[bx, 0.35, bz]} color="#2e7d32" />
      </group>
      <Label
        text="RETURNS"
        position={[bx, 1.5, frontInner + 0.01]}
        width={0.9}
        height={0.2}
        background="#2e7d32"
      />

      {SHELVES.map(({ id, position, rotationY }) => (
        <TapeShelf key={id} id={id} position={position} rotation={[0, rotationY, 0]} />
      ))}

      {/* floor markers showing where you can stand */}
      {NODES.map((n) => (
        <mesh key={n.id} position={[n.x, 0.005, n.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.18, 24]} />
          <meshBasicMaterial color="#ffd400" transparent opacity={0.35} />
        </mesh>
      ))}

      {[-lightX, lightX].flatMap((x) =>
        [centerZ - lightZ, centerZ + lightZ].map((z) => (
          <FlickerLight
            key={`${x},${z}`}
            position={[x, 0, z]}
            intensity={8}
            baseDistance={8}
            color="#f4f1e6"
            ceilingHeight={STORE_HEIGHT}
            castShadow={false}
            defaultOn
          />
        )),
      )}
    </group>
  )
}

export default Store

// Placeholder CRT on the counter where orders come in. Its screen shows how
// many orders are waiting.
function Computer({ position }: { position: [number, number, number] }) {
  const count = useGameStore((s) => s.orders.length)
  const [x, y, z] = position
  return (
    <group name="computer" userData={{ label: 'Order computer' }}>
      <Block size={[0.3, 0.04, 0.25]} position={[x, y, z - 0.08]} color="#bbb" />
      <Block size={[0.46, 0.38, 0.4]} position={[x, y + 0.21, z - 0.08]} color="#d9d4c3" />
      <Label
        text={count ? `${count} ORDER${count > 1 ? 'S' : ''}` : 'NO ORDERS'}
        position={[x, y + 0.22, z + 0.125]}
        width={0.36}
        height={0.27}
        background={count ? '#0b3d0b' : '#082008'}
        color="#4cff4c"
      />
      {/* keyboard */}
      <Block size={[0.42, 0.03, 0.14]} position={[x, y, z + 0.18]} color="#cfc9b8" />
    </group>
  )
}
