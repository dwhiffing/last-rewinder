import { useWorld } from 'koota/react'
import { useEffect, useMemo, useRef } from 'react'
import {
  type Group,
  type Mesh as ThreeMesh,
  type PointLight,
} from 'three'
import { useFrame, useThree } from '@react-three/fiber'
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
  POSTERS,
  SHELVES,
  STANDEE_POSITION,
  STORE_HEIGHT,
  STORE_WIDTH,
} from '../data/storeLayout'
import Block from '../entities/store/block'
import Carpet from '../entities/store/carpet'
import { CEILING, glassTexture, NIGHT_SKY, SCUFFS, WALLPAPER, WOOD } from '../entities/store/textures'
import Label from '../entities/store/label'
import TapeShelf from '../entities/store/tapeShelf'
import Standee from '../entities/store/standee'
import Poster from '../entities/store/poster'
import Door from '../entities/store/door'
import RainGlass from '../entities/store/rainGlass'
import Rainfall from '../entities/store/rainfall'
import { Mesh } from '../shared/traits'
import { itemColor } from '../data/snacks'
import { GENRE_COLORS, tapeById } from '../data/tapes'
import useGameStore from '../stores/gameStore'

const WALL = 0.2
const halfW = STORE_WIDTH / 2
const depth = BACK_Z - FRONT_Z
const centerZ = (BACK_Z + FRONT_Z) / 2
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

// Openings in the front wall as [x0, x1, y0, y1]: the door, then a window
// either side of it
const DOOR_W = 1
const DOOR_H = 2
const WINDOW_BOTTOM = 0.65
const WINDOW_TOP = 1.85
// Two matching windows either side of the door, the left one centred on the
// computer desk
const windowInner = ENTRANCE_X + 0.7
const windowOuter = windowInner + 2 * (-COUNTER_POSITION[0] - windowInner)
const OPENINGS: [number, number, number, number][] = [
  [ENTRANCE_X - DOOR_W / 2, ENTRANCE_X + DOOR_W / 2, 0, DOOR_H],
  [-windowOuter, -windowInner, WINDOW_BOTTOM, WINDOW_TOP],
  [windowInner, windowOuter, WINDOW_BOTTOM, WINDOW_TOP],
]
// The solid wall around them
const FRONT_WALL_PIECES: [number, number, number, number][] = [
  [-halfW, halfW, DOOR_H, STORE_HEIGHT],
  ...[-1, 1].flatMap((side): [number, number, number, number][] => {
    const span = (a: number, b: number): [number, number] => (side < 0 ? [-b, -a] : [a, b])
    return [
      [...span(windowOuter, halfW), 0, DOOR_H],
      [...span(DOOR_W / 2, windowInner), 0, DOOR_H],
      [...span(windowInner, windowOuter), 0, WINDOW_BOTTOM],
      [...span(windowInner, windowOuter), WINDOW_TOP, DOOR_H],
    ]
  }),
]

const RETURN_DESK_H = 0.84
const LIGHT_INTENSITY = 1.25
// Panels (by grid fraction) whose tubes are dead, and one on its way out
const DEAD_LIGHTS = ['0.625,0.375', '0.125,0.875', '0.875,0.125', '0.375,0.125']
const FLICKER_LIGHTS = ['0.375,0.625']
// Point-light shadows are costly, so only a few working lights cast them:
// over the counter, the return box and the middle of the shelves
const SHADOW_LIGHTS = ['0.125,0.125', '0.875,0.375', '0.375,0.375', '0.625,0.625']

// Shadows only change when something moves, so the shadow maps are redrawn
// only then (and a few times while the scene and textures settle on load)
function ShadowRefresh() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    const settle = [250, 1000, 3000].map((ms) => window.setTimeout(() => (gl.shadowMap.needsUpdate = true), ms))
    const unsub = useGameStore.subscribe((state, prev) => {
      if (
        state.slots !== prev.slots ||
        state.returnBox !== prev.returnBox ||
        state.rewinder !== prev.rewinder
      )
        gl.shadowMap.needsUpdate = true
    })
    return () => {
      settle.forEach(window.clearTimeout)
      unsub()
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])
  return null
}
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

// Yellow top slab overhanging a table by 2cm on each side; `position` is
// the middle of the table's top surface
const TOP_H = 0.05
function TableTop({ width, depth, position: [x, y, z] }: { width: number; depth: number; position: [number, number, number] }) {
  return (
    <Block
      size={[width + 0.04, TOP_H, depth + 0.04]}
      position={[x, y + TOP_H / 2, z]}
      color="#ffd400"
      textures={SCUFFS}
    />
  )
}

// Night-time panorama seen through the windows, turned so the street lamp
// sits out front
function NightSky() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.background = NIGHT_SKY
    scene.backgroundRotation.set(0, -Math.PI / 2, 0)
    return () => {
      scene.background = null
    }
  }, [scene])
  return null
}

// Drop-ceiling tiles with glowing light panels, just under the ceiling slab
function Ceiling() {
  const maps = useMemo(() => {
    const { map, normalMap, roughnessMap, emissiveMap } = CEILING
    return [map!, normalMap, roughnessMap!, emissiveMap!].map((t) => {
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
      <NightSky />
      <ShadowRefresh />
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
      {/* front wall, built around real openings for the door and windows */}
      {FRONT_WALL_PIECES.map(([x0, x1, y0, y1]) => (
        <Block
          key={`${x0},${y0}`}
          size={[x1 - x0, y1 - y0, WALL]}
          position={[(x0 + x1) / 2, (y0 + y1) / 2, FRONT_Z]}
          color={WALL_COLOR}
          textures={WALLPAPER}
          alignUv
        />
      ))}
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

      {/* glass in the windows, and the shop door */}
      {OPENINGS.slice(1).map(([x0, x1, y0, y1]) => (
        <group key={`${x0},${y0}`} position={[(x0 + x1) / 2, (y0 + y1) / 2, FRONT_Z]}>
          <mesh>
            <boxGeometry args={[x1 - x0, y1 - y0, 0.01]} />
            <meshStandardMaterial map={glassTexture(x1 - x0, y1 - y0)} transparent roughness={0.1} depthWrite={false} />
          </mesh>
          {/* rain runs down the outside of the glass */}
          <RainGlass width={x1 - x0} height={y1 - y0} position={[0, 0, -0.008]} />
        </group>
      ))}
      <Door position={[ENTRANCE_X, 0, FRONT_Z]} width={DOOR_W} height={DOOR_H} />
      <Rainfall width={STORE_WIDTH + 2} depth={5} position={[0, 0, FRONT_Z - WALL / 2 - 0.3]} />

      {/* checkout counter, customers stand between it and the front wall */}
      <group name="counter" userData={{ label: 'Counter' }}>
        <Block size={COUNTER_SIZE} position={[cx, COUNTER_SIZE[1] / 2, cz]} color={TRIM_COLOR} textures={SCUFFS} />
        <TableTop width={COUNTER_SIZE[0]} depth={COUNTER_SIZE[2]} position={[cx, COUNTER_SIZE[1], cz]} />
      </group>
      {/* set back so the monitor touches the wall */}
      <Computer position={[cx, COUNTER_SIZE[1] + TOP_H, cz - 0.03]} />

      {/* rewinder table against the left wall, between shelf A and the counter */}
      <Block
        size={REWINDER_TABLE_SIZE}
        position={[rx, REWINDER_TABLE_SIZE[1] / 2, rz]}
        color={TRIM_COLOR}
        textures={SCUFFS}
      />
      <TableTop width={REWINDER_TABLE_SIZE[0]} depth={REWINDER_TABLE_SIZE[2]} position={[rx, REWINDER_TABLE_SIZE[1], rz]} />
      <group position={[rx, REWINDER_TABLE_SIZE[1] + TOP_H, rz]} rotation={[0, Math.PI / 2, 0]} scale={1.2}>
        <TapeRewinder position={[0, 0.005, 0]} />
      </group>
      <Label
        text="CHECKOUT"
        marquee
        position={[cx, 2.1, frontInner + 0.01]}
        width={1.4}
        height={0.24}
        background={TRIM_COLOR}
        color="#ffd400"
      />

      <Standee position={STANDEE_POSITION} />

      {POSTERS.map(({ id, side, z, y, tilt }) => (
        <Poster
          key={id}
          id={id}
          tilt={tilt}
          position={[side * (halfW - WALL / 2 - 0.005), y, z]}
          rotation={[0, -side * (Math.PI / 2), 0]}
        />
      ))}

      {/* quick drop bin for returned tapes */}
      <group name="dropBin" userData={{ label: 'Return box' }}>
        <Block size={[0.6, RETURN_DESK_H, 0.6]} position={[bx, RETURN_DESK_H / 2, bz]} color={TRIM_COLOR} textures={SCUFFS} />
        <TableTop width={0.6} depth={0.6} position={[bx, RETURN_DESK_H, bz]} />
        <ReturnBoxTapes position={[bx, RETURN_DESK_H + TOP_H, bz]} />
      </group>
      <Label
        text="RETURNS"
        marquee
        position={[halfW - WALL / 2 - 0.01, 1.5, bz]}
        rotation={[0, -Math.PI / 2, 0]}
        width={0.9}
        height={0.2}
        background={TRIM_COLOR}
        color="#ffd400"
      />

      {SHELVES.map(({ id, position, rotationY }) => (
        <TapeShelf key={id} id={id} position={position} rotation={[0, rotationY, 0]} />
      ))}

      {/* floor markers showing where you can stand */}
      {NODES.map((n) => (
        <mesh key={n.id} position={[n.x, 0.005, n.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.18, 24]} />
          {/* lit like the floor so it doesn't glow at full brightness */}
          <meshStandardMaterial color="#ffd400" transparent opacity={0.2} depthWrite={false} roughness={1} />
        </mesh>
      ))}

      {/* one light under each working ceiling light panel */}
      {LIGHT_FRACTIONS.flatMap((fx) =>
        LIGHT_FRACTIONS.map((fz) => {
          const key = `${fx},${fz}`
          const position: [number, number, number] = [-halfW + fx * STORE_WIDTH, STORE_HEIGHT, FRONT_Z + fz * depth]
          if (DEAD_LIGHTS.includes(key)) return <DeadPanel key={key} position={position} />
          if (FLICKER_LIGHTS.includes(key)) return <FlickerPanel key={key} position={position} />
          return (
            <pointLight
              key={key}
              position={[position[0], STORE_HEIGHT - 0.15, position[2]]}
              intensity={LIGHT_INTENSITY}
              distance={5}
              color="#eef8ff"
              castShadow={SHADOW_LIGHTS.includes(key)}
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-bias={-0.002}
              shadow-camera-near={0.05}
              shadow-camera-far={5}
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
        glow
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
      <Block size={[0.4, 0.1, 0.24]} position={[x, y + 0.03, z]} color="#222" />
      {rewinder && (
        <Block
          size={[0.21, 0.13, 0.035]}
          position={[x, y + 0.13, z]}
          color={GENRE_COLORS[tapeById(rewinder.tapeId).genre]}
        />
      )}
      <mesh position={[x + 0.16, y + 0.05, z + 0.121]}>
        <boxGeometry args={[0.03, 0.03, 0.005]} />
        <meshBasicMaterial color={!rewinder ? '#333' : done ? '#3cff3c' : '#ff3030'} toneMapped={false} />
      </mesh>
    </group>
  )
}
