import { useWorld } from 'koota/react'
import { useEffect, useRef } from 'react'
import { type Group } from 'three'
import {
  BACK_Z,
  COUNTER_POSITION,
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

const WALL = 0.2
const halfW = STORE_WIDTH / 2
const depth = BACK_Z - FRONT_Z
const centerZ = (BACK_Z + FRONT_Z) / 2

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
      <Block size={[3.6, 1.4, 0.02]} position={[-2.4, 1.4, frontInner]} color={GLASS} emissive={GLASS_GLOW} />
      <Block size={[2.2, 1.4, 0.02]} position={[2.6, 1.4, frontInner]} color={GLASS} emissive={GLASS_GLOW} />
      <Block size={[1.2, 2.2, 0.02]} position={[ENTRANCE_X, 1.1, frontInner]} color={GLASS} emissive={GLASS_GLOW} />
      <Label
        text="ENTRANCE"
        position={[ENTRANCE_X, 2.45, frontInner + 0.01]}
        width={1.2}
        height={0.22}
        background={TRIM_COLOR}
        color="#ffd400"
      />

      {/* checkout counter, customers stand between it and the front wall */}
      <group name="counter" userData={{ label: 'Counter' }}>
        <Block size={[2.4, 1.0, 0.6]} position={[cx, 0.5, cz]} color={TRIM_COLOR} />
        <Block size={[2.5, 0.05, 0.7]} position={[cx, 1.02, cz]} color="#ffd400" />
        {/* placeholder register */}
        <Block size={[0.4, 0.25, 0.3]} position={[cx + 0.7, 1.17, cz]} color="#222" />
      </group>
      <Label
        text="CHECKOUT"
        position={[cx, 1.75, cz - 0.1]}
        width={1.4}
        height={0.24}
        background={TRIM_COLOR}
        color="#ffd400"
      />

      {/* quick drop bin for returned tapes */}
      <group name="dropBin" userData={{ label: 'Quick drop bin' }}>
        <Block size={[0.7, 0.8, 0.7]} position={[bx, 0.4, bz]} color="#2e7d32" />
      </group>
      <Label
        text="RETURNS"
        position={[bx, 1.6, frontInner + 0.01]}
        width={0.9}
        height={0.2}
        background="#2e7d32"
      />

      {SHELVES.map(({ genre, position }) => (
        <TapeShelf key={genre} genre={genre} position={position} rotation={[0, Math.PI, 0]} />
      ))}

      {/* floor markers showing where you can stand */}
      {NODES.map((n) => (
        <mesh key={n.id} position={[n.x, 0.005, n.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.18, 24]} />
          <meshBasicMaterial color="#ffd400" transparent opacity={0.35} />
        </mesh>
      ))}

      {[-3, 3].flatMap((x) =>
        [-2, 2].map((z) => (
          <FlickerLight
            key={`${x},${z}`}
            position={[x, 0, z]}
            intensity={8}
            baseDistance={9}
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
