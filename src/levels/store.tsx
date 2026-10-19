import { useWorld } from 'koota/react'
import { useEffect, useMemo, useRef } from 'react'
import { type Group, type Mesh as ThreeMesh, type PointLight } from 'three'
import { useFrame } from '@react-three/fiber'
import {
  BACK_Z,
  COUNTER_POSITION,
  COUNTER_SIZE,
  DROP_BIN_POSITION,
  ENTRANCE_X,
  FRONT_Z,
  NODES,
  REWINDER_TABLE_POSITION,
  REWINDER_TABLE_SIZE,
  SHELVES,
  STORE_HEIGHT,
  STORE_WIDTH,
} from '../data/storeLayout'
import Block from '../entities/store/block'
import Carpet from '../entities/store/carpet'
import { CEILING, WALLPAPER, WOOD } from '../entities/store/textures'
import Label from '../entities/store/label'
import TapeShelf from '../entities/store/tapeShelf'
import { Mesh } from '../shared/traits'
import { itemColor } from '../data/snacks'
import { GENRE_COLORS, tapeById } from '../data/tapes'
import useGameStore from '../stores/gameStore'

const WALL = 0.2
const halfW = STORE_WIDTH / 2
const depth = BACK_Z - FRONT_Z
const centerZ = (BACK_Z + FRONT_Z) / 2
// Two windows either side of the entrance door, filling the front wall
const windowWidth = halfW - WALL - 0.3 - 0.7
// The ceiling texture is 6x6 tiles with light panels in a 2x2 pattern. Two
// copies across each way, offset so the panels land on an even 4x4 grid.
const CEILING_REPEAT = 2
const LIGHT_FRACTIONS = [0.125, 0.375, 0.625, 0.875]

// Baseboard height and thickness
const BASE_H = 0.12
const BASE_T = 0.025
const frontBaseWidth = halfW - WALL / 2 - 0.5

const FLOOR_COLOR = '#3a4a6b'
const WALL_COLOR = '#d8d2c4'
const TRIM_COLOR = '#1d3fbf'
const GLASS = '#9fc6e8'
const GLASS_GLOW = '#3d5a7a'

const LIGHT_INTENSITY = 1.25
// Panels (by grid fraction) whose tubes are dead, ones smashed out of the
// ceiling, and one on its way out
const DEAD_LIGHTS = ['0.625,0.375']
const BROKEN_LIGHTS = ['0.125,0.875', '0.875,0.125', '0.375,0.125']
const FLICKER_LIGHTS = ['0.375,0.625']
// A light panel's size on the ceiling (about 0.154 of one texture copy)
const PANEL_W = (STORE_WIDTH / CEILING_REPEAT) * 0.154
const PANEL_D = (depth / CEILING_REPEAT) * 0.154

// Grey cover over a light panel, hiding its glow
function PanelCover({ position, coverRef }: { position: [number, number, number]; coverRef?: React.Ref<ThreeMesh> }) {
  return (
    <mesh ref={coverRef} rotation={[Math.PI / 2, 0, 0]} position={[position[0], STORE_HEIGHT - 0.004, position[2]]}>
      <planeGeometry args={[PANEL_W, PANEL_D]} />
      <meshStandardMaterial color="#8d9698" roughness={0.5} />
    </mesh>
  )
}

function DeadPanel({ position }: { position: [number, number, number] }) {
  return <PanelCover position={position} />
}

// Smashed panel: a dark hole where the light was, with its cover hanging
// down off one edge
function BrokenPanel({ position, hang }: { position: [number, number, number]; hang: number }) {
  const [x, , z] = position
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[x, STORE_HEIGHT - 0.004, z]}>
        <planeGeometry args={[PANEL_W, PANEL_D]} />
        <meshBasicMaterial color="#0b0b0c" />
      </mesh>
      {/* cover hinged on its -x edge, swung down */}
      <group position={[x - PANEL_W / 2, STORE_HEIGHT - 0.01, z]} rotation={[0, 0, -hang]}>
        <mesh position={[PANEL_W / 2, 0, 0]} castShadow>
          <boxGeometry args={[PANEL_W, 0.008, PANEL_D]} />
          <meshStandardMaterial color="#cfd6d6" roughness={0.4} />
        </mesh>
      </group>
    </>
  )
}

// A dying tube: mostly on, with bursts of stuttering off
function FlickerPanel({ position }: { position: [number, number, number] }) {
  const light = useRef<PointLight>(null)
  const cover = useRef<ThreeMesh>(null)
  const burst = useRef(0)
  useFrame((_, delta) => {
    if (burst.current > 0) burst.current -= delta
    else if (Math.random() < delta / 25) burst.current = 0.3 + Math.random() * 1.2
    const off = burst.current > 0 && Math.random() < 0.5
    if (light.current) light.current.intensity = off ? 0 : LIGHT_INTENSITY
    if (cover.current) cover.current.visible = off
  })
  return (
    <>
      <pointLight
        ref={light}
        position={[position[0], STORE_HEIGHT - 0.15, position[2]]}
        intensity={LIGHT_INTENSITY}
        distance={5}
        color="#eef8ff"
      />
      <PanelCover position={position} coverRef={cover} />
    </>
  )
}

// Drop-ceiling tiles with glowing light panels, just under the ceiling slab
function Ceiling() {
  const maps = useMemo(() => {
    const { map, normalMap, roughnessMap, emissiveMap } = CEILING
    return [map, normalMap, roughnessMap, emissiveMap!].map((t) => {
      const tex = t.clone()
      tex.repeat.set(CEILING_REPEAT, CEILING_REPEAT)
      // shift so the panels (at 0.42/0.92 across the image) sit at 0.25/0.75
      tex.offset.set(0.167, 0.333)
      tex.needsUpdate = true
      return tex
    })
  }, [])
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, STORE_HEIGHT - 0.002, centerZ]}>
      <planeGeometry args={[STORE_WIDTH, depth]} />
      <meshStandardMaterial
        map={maps[0]}
        normalMap={maps[1]}
        roughnessMap={maps[2]}
        emissiveMap={maps[3]}
        emissive="#ffffff"
        emissiveIntensity={1.2}
      />
    </mesh>
  )
}

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
  const [rx, , rz] = REWINDER_TABLE_POSITION
  const frontInner = FRONT_Z + WALL / 2 + 0.01

  return (
    <group ref={ref}>
      {/* shell */}
      <Block size={[STORE_WIDTH, WALL, depth]} position={[0, -WALL / 2, centerZ]} color={FLOOR_COLOR} />
      <Carpet width={STORE_WIDTH} depth={depth} z={centerZ} />
      {!hideCeiling && (
        <>
          <Block size={[STORE_WIDTH, WALL, depth]} position={[0, STORE_HEIGHT + WALL / 2, centerZ]} color="#eeeeee" />
          <Ceiling />
        </>
      )}
      <Block size={[STORE_WIDTH, STORE_HEIGHT, WALL]} position={[0, STORE_HEIGHT / 2, BACK_Z]} color={WALL_COLOR} textures={WALLPAPER} />
      <Block size={[STORE_WIDTH, STORE_HEIGHT, WALL]} position={[0, STORE_HEIGHT / 2, FRONT_Z]} color={WALL_COLOR} textures={WALLPAPER} />
      <Block size={[WALL, STORE_HEIGHT, depth]} position={[halfW, STORE_HEIGHT / 2, centerZ]} color={WALL_COLOR} textures={WALLPAPER} />
      <Block size={[WALL, STORE_HEIGHT, depth]} position={[-halfW, STORE_HEIGHT / 2, centerZ]} color={WALL_COLOR} textures={WALLPAPER} />

      {/* wooden baseboard around the inside of the walls, broken at the door */}
      <Block size={[STORE_WIDTH - WALL, BASE_H, BASE_T]} position={[0, BASE_H / 2, BACK_Z - WALL / 2 - BASE_T / 2]} color="#ffffff" textures={WOOD} />
      {[-1, 1].map((side) => (
        <Block
          key={`side${side}`}
          size={[BASE_T, BASE_H, depth - WALL]}
          position={[side * (halfW - WALL / 2 - BASE_T / 2), BASE_H / 2, centerZ]}
          color="#ffffff"
          textures={WOOD}
        />
      ))}
      {[-1, 1].map((side) => (
        <Block
          key={`front${side}`}
          size={[frontBaseWidth, BASE_H, BASE_T]}
          position={[ENTRANCE_X + side * (0.5 + frontBaseWidth / 2), BASE_H / 2, FRONT_Z + WALL / 2 + BASE_T / 2]}
          color="#ffffff"
          textures={WOOD}
        />
      ))}

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
      <Computer position={[cx, COUNTER_SIZE[1] + 0.045, cz]} />

      {/* rewinder table against the left wall, between shelf A and the counter */}
      <Block
        size={REWINDER_TABLE_SIZE}
        position={[rx, REWINDER_TABLE_SIZE[1] / 2, rz]}
        color={TRIM_COLOR}
      />
      <group position={[rx, REWINDER_TABLE_SIZE[1], rz]} rotation={[0, Math.PI / 2, 0]}>
        <TapeRewinder position={[0, 0.005, 0]} />
      </group>
      <Label
        text="CHECKOUT"
        position={[cx, 1.5, cz - 0.1]}
        width={1.4}
        height={0.24}
        background={TRIM_COLOR}
        color="#ffd400"
      />

      {/* quick drop bin for returned tapes */}
      <group name="dropBin" userData={{ label: 'Return box' }}>
        <Block size={[0.6, 0.7, 0.6]} position={[bx, 0.35, bz]} color="#2e7d32" />
        <ReturnBoxTapes position={[bx, 0.7, bz]} />
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
          {/* lit like the floor so it doesn't glow at full brightness */}
          <meshStandardMaterial color="#ffd400" transparent opacity={0.5} depthWrite={false} roughness={1} />
        </mesh>
      ))}

      {/* one light under each working ceiling light panel */}
      {LIGHT_FRACTIONS.flatMap((fx) =>
        LIGHT_FRACTIONS.map((fz) => {
          const key = `${fx},${fz}`
          const position: [number, number, number] = [-halfW + fx * STORE_WIDTH, STORE_HEIGHT, FRONT_Z + fz * depth]
          if (DEAD_LIGHTS.includes(key)) return <DeadPanel key={key} position={position} />
          const broken = BROKEN_LIGHTS.indexOf(key)
          if (broken >= 0) return <BrokenPanel key={key} position={position} hang={0.5 + broken * 0.35} />
          if (FLICKER_LIGHTS.includes(key)) return <FlickerPanel key={key} position={position} />
          return (
            <pointLight
              key={key}
              position={[position[0], STORE_HEIGHT - 0.15, position[2]]}
              intensity={LIGHT_INTENSITY}
              distance={5}
              color="#eef8ff"
            />
          )
        }),
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

// Tapes waiting in the return box, piled flat on top so you can see how many
function ReturnBoxTapes({ position }: { position: [number, number, number] }) {
  const box = useGameStore((s) => s.returnBox)
  const [x, y, z] = position
  return (
    <>
      {box.map((id, i) => (
        <Block
          key={id}
          size={[0.21, 0.035, 0.13]}
          position={[x + ((i % 2) - 0.5) * 0.24, y + 0.018 + Math.floor(i / 2) * 0.036, z + ((i % 3) - 1) * 0.04]}
          color={itemColor(id, (g) => GENRE_COLORS[g as keyof typeof GENRE_COLORS])}
        />
      ))}
    </>
  )
}

// Placeholder tape rewinder: a slot on top holds one tape; the light is red
// while it rewinds and green when the tape is ready to take out
function TapeRewinder({ position }: { position: [number, number, number] }) {
  const rewinder = useGameStore((s) => s.rewinder)
  const done = useGameStore((s) => !!s.rewinder && s.rewinder.doneAt <= s.time)
  const [x, y, z] = position
  return (
    <group name="rewinder" userData={{ label: 'Tape rewinder' }}>
      <Block size={[0.32, 0.1, 0.24]} position={[x, y + 0.03, z]} color="#222" />
      {rewinder && (
        <Block
          size={[0.21, 0.13, 0.035]}
          position={[x, y + 0.13, z]}
          color={GENRE_COLORS[tapeById(rewinder.tapeId).genre]}
        />
      )}
      <mesh position={[x + 0.12, y + 0.05, z + 0.121]}>
        <boxGeometry args={[0.03, 0.03, 0.005]} />
        <meshBasicMaterial color={!rewinder ? '#333' : done ? '#3cff3c' : '#ff3030'} toneMapped={false} />
      </mesh>
    </group>
  )
}
