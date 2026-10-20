import { useFrame } from '@react-three/fiber'
import { memo, type ReactNode, useEffect, useRef } from 'react'
import { CanvasTexture, type Group, SRGBColorSpace, Vector3 } from 'three'
import { isSnack, isWide, snackOf } from '../../data/snacks'
import { GENRE_COLORS, tapeById } from '../../data/tapes'
import {
  SHELF_DEPTH,
  SHELF_HEIGHT,
  FIRST_TIER,
  SHELF_TIERS,
  SHELF_WIDTH,
  SLOTS_PER_TIER,
  SHELF_SIGNS,
  slotId,
} from '../../data/storeLayout'
import useGameStore from '../../stores/gameStore'
import Block from './block'
import { WOOD } from './textures'
import Label from './label'
import { coveringSlot } from '../../data/storeLayout'
import SnackBox, { snackBoxSize } from './snackBox'
import SodaCan, { CAN_HEIGHT, CAN_RADIUS } from './sodaCan'
import { drawSleeveRim, sleeveEdgeTexture, sleeveSideTexture, sleeveVariant } from './sleeveArt'

const PANEL = 0.03
// A header panel across the top of the front carries the shelf's sign
const HEADER = 0.24
const tierSpacing = (SHELF_HEIGHT - HEADER - PANEL) / SHELF_TIERS

// A VHS box standing spine-out, filling the full height between tier boards
export const TAPE_SIZE: [number, number, number] = [0.0765, tierSpacing - PANEL, 0.13]
const slotSpacing = (SHELF_WIDTH - PANEL * 2) / SLOTS_PER_TIER
// Shelved tapes are drawn a touch smaller than their slot, standing on the
// board with their spines where the full-size ones would be
const SHELF_TAPE_SCALE = 0.95
const SHELF_TAPE_SIZE = TAPE_SIZE.map((n) => n * SHELF_TAPE_SCALE) as [number, number, number]

// The click box reaches well past the shelf front (hit slop), so a tape is
// easy to point at and stays hovered while it slides out
const HIT_SLOP = 0.12
// the item's own hover shape is padded out a little on every side too
export const HOVER_PAD = 0.015
const HIT_FRONT = SHELF_DEPTH / 2 + 0.005 + HIT_SLOP
const HIT_BACK = SHELF_DEPTH / 2 - TAPE_SIZE[2] - 0.01

// A hovered tape or snack slides forward (local +z) a little past its own
// depth, so it comes all the way out of the shelf, growing around its own
// centre as it goes
const HOVER_POP_CLEARANCE = 0.01
const HOVER_POP_EXTRA = 1.455
const HOVER_POP_SECONDS = 0.15
const HOVER_SCALE = 1.386
const popDistance = (depth: number) => (depth + HOVER_POP_CLEARANCE) * HOVER_POP_EXTRA
const _toCamera = new Vector3()
export function HoverPop({
  hovered,
  depth,
  center,
  children,
}: {
  hovered: boolean
  depth: number
  center: [number, number, number]
  children: ReactNode
}) {
  const distance = popDistance(depth)
  const ref = useRef<Group>(null)
  // The moving item is never hit-tested: hover goes by where it sits at rest
  // (see the proxy in Slot), so the animation can't change what's hovered
  // and set it flickering between neighbours
  useEffect(() => {
    ref.current?.traverse((o) => (o.raycast = () => {}))
  }, [])
  useFrame(({ camera }, delta) => {
    const group = ref.current
    if (!group?.parent) return
    // resting and staying put: nothing to do (most tapes, most frames)
    if (!hovered && group.position.z === 0) return
    // 0 at rest, 1 fully out; moves linearly so it takes HOVER_POP_SECONDS
    const now = group.position.z / distance
    const step = delta / HOVER_POP_SECONDS
    const t = hovered ? Math.min(1, now + step) : Math.max(0, now - step)
    group.position.z = t * distance
    group.scale.setScalar(1 + (HOVER_SCALE - 1) * t)
    // turn the front (local +z) toward the camera so the spine is easy to read
    if (t === 0) {
      group.rotation.set(0, 0, 0)
      return
    }
    camera.getWorldPosition(_toCamera)
    group.parent.worldToLocal(_toCamera).sub(group.position)
    const yaw = Math.atan2(_toCamera.x, _toCamera.z)
    const pitch = -Math.atan2(_toCamera.y, Math.hypot(_toCamera.x, _toCamera.z))
    group.rotation.set(pitch * t, yaw * t, 0, 'YXZ')
  })
  const [cx, cy, cz] = center
  return (
    <group position={center}>
      <group ref={ref}>
        <group position={[-cx, -cy, -cz]}>{children}</group>
      </group>
    </group>
  )
}

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
  drawSpine(canvas, snack, tape, markerInk(tapeId))
  // redraw once the marker font has loaded, if it wasn't ready yet
  if (!document.fonts.check(SPINE_FONT_CHECK)) {
    document.fonts.load(SPINE_FONT_CHECK).then(() => {
      drawSpine(canvas, snack, tape, markerInk(tapeId))
      tex.needsUpdate = true
    })
  }
  return tex
}

const SPINE_FONT_CHECK = '32px "Permanent Marker"'
// Each label was written with whichever marker was to hand - picked from
// the id so the same tape always looks the same. [ink, weight]
const MARKER_INKS: [string, number][] = [
  ['#1328C6', 40], // blue
  ['#141414', 30], // black
  ['#b3161b', 15], // red
  ['#16803a', 15], // green
]
const MARKER_TOTAL = MARKER_INKS.reduce((sum, [, w]) => sum + w, 0)
function markerInk(tapeId: string) {
  // FNV-1a, then scrambled so ids differing by one digit still spread evenly
  let hash = 2166136261
  for (let i = 0; i < tapeId.length; i++) hash = Math.imul(hash ^ tapeId.charCodeAt(i), 16777619)
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
  hash ^= hash >>> 16
  let roll = (hash >>> 0) % MARKER_TOTAL
  for (const [ink, weight] of MARKER_INKS) {
    if (roll < weight) return ink
    roll -= weight
  }
  return MARKER_INKS[0][0]
}

function drawSpine(
  canvas: HTMLCanvasElement,
  snack: ReturnType<typeof snackOf> | null,
  tape: ReturnType<typeof tapeById> | null,
  ink: string,
) {
  const g = canvas.getContext('2d')!
  g.setTransform(1, 0, 0, 1, 0, 0)
  const W = canvas.width
  const H = canvas.height
  // black plastic spine with a white sticker label, rounded at the corners,
  // showing through the open end of its worn card sleeve
  g.fillStyle = '#111'
  g.fillRect(0, 0, W, H)
  if (tape) drawSleeveRim(g, tape.id, GENRE_COLORS[tape.genre], W, H)
  const labelW = W * 0.8
  const labelH = H * 0.76
  g.fillStyle = '#f4efe2'
  g.beginPath()
  g.roundRect((W - labelW) / 2, (H - labelH) / 2, labelW, labelH, W * 0.08)
  g.fill()
  g.translate(W / 2, H / 2)
  g.rotate(-Math.PI / 2)
  g.fillStyle = ink
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
  const hovered = useGameStore(
    (s) => s.hovered?.kind === 'tape' && s.hovered.slotId === id && s.hovered.popOut !== false,
  )
  if (covered) return null
  const position = slotPosition(tier, slot)

  // Each slot's click box fills its whole cell, so there are no gaps between
  // slots that ignore the pointer (a wide snack's box covers two cells)
  const wide = isWide(tapeId)
  const [x, y, z] = position
  const hitBox = (front: number) => (
    // also covers the board below, so there's no gap between rows either, and
    // reaches just past the boards' front edges so they never catch the pointer
    <mesh position={[x + (wide ? slotSpacing / 2 : 0), y - PANEL / 2, (front + HIT_BACK) / 2]}>
      <boxGeometry args={[slotSpacing * (wide ? 2 : 1), tierSpacing, front - HIT_BACK]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )

  if (!tapeId) {
    return (
      <group key="empty" name="slot" userData={{ label: 'Empty slot', slotId: id }}>
        {hitBox(HIT_FRONT)}
      </group>
    )
  }

  const snack = isSnack(tapeId) ? snackOf(tapeId) : null
  const color = snack ? snack.color : GENRE_COLORS[tapeById(tapeId).genre]
  const label = snack ? snack.type : tapeById(tapeId).title
  let item
  let depth = TAPE_SIZE[2]
  let center = position
  let restSize: [number, number, number] = TAPE_SIZE
  if (snack?.type === 'Soda') {
    depth = CAN_RADIUS * 2
    restSize = [CAN_RADIUS * 2, CAN_HEIGHT, CAN_RADIUS * 2]
    center = [x, y - TAPE_SIZE[1] / 2 + CAN_HEIGHT / 2, z]
    // a can standing on the shelf board
    item = <SodaCan position={center} />
  } else if (snack) {
    // a box standing on the shelf board, front flush with the tape spines
    const size = snackBoxSize(snack.type, slotSpacing * 2 - 0.01, TAPE_SIZE[1] - 0.01)
    const [, h, d] = size
    depth = d
    restSize = size
    center = [x + slotSpacing / 2, y - TAPE_SIZE[1] / 2 + h / 2, z + TAPE_SIZE[2] / 2 - d / 2]
    item = <SnackBox type={snack.type} size={size} position={center} />
  } else {
    item = (
      <mesh
        position={[
          x,
          y - (TAPE_SIZE[1] - SHELF_TAPE_SIZE[1]) / 2,
          z + (TAPE_SIZE[2] - SHELF_TAPE_SIZE[2]) / 2,
        ]}>
        <boxGeometry args={SHELF_TAPE_SIZE} />
        {/* box faces are +x, -x, +y, -y, +z (the spine, facing out), -z;
            the sides and ends are the worn card sleeve */}
        {[0, 1, 2, 3, 4, 5].map((face) => {
          const variant = sleeveVariant(tapeId)
          const map =
            face === 4
              ? spineTexture(tapeId)
              : face < 2
                ? sleeveSideTexture(color, SHELF_TAPE_SIZE[2], SHELF_TAPE_SIZE[1], variant)
                : face < 4
                  ? sleeveEdgeTexture(color, SHELF_TAPE_SIZE[0], SHELF_TAPE_SIZE[2], variant)
                  : null
          return map ? (
            <meshStandardMaterial key={face} attach={`material-${face}`} map={map} roughness={face === 4 ? 0.6 : 0.85} />
          ) : (
            <meshStandardMaterial key={face} attach={`material-${face}`} color={color} roughness={0.85} />
          )
        })}
      </mesh>
    )
  }
  return (
    // keyed by tape so a swap mounts a fresh group and the hover picks it up
    <group key={tapeId} name="tape" userData={{ label, slotId: id }}>
      {/* while out, the click box stretches to cover it so no part of it loses the hover */}
      {hitBox(hovered ? Math.max(HIT_FRONT, SHELF_DEPTH / 2 + popDistance(depth) + (depth * (HOVER_SCALE - 1)) / 2) : HIT_FRONT)}
      {/* the item's shape at rest, for hover and clicks */}
      <mesh position={center} userData={{ hoverProxy: true }}>
        <boxGeometry args={[restSize[0] + HOVER_PAD * 2, restSize[1] + HOVER_PAD * 2, restSize[2] + HOVER_PAD * 2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <HoverPop hovered={hovered} depth={depth} center={center}>
        {item}
      </HoverPop>
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
        text={SHELF_SIGNS[id] ?? `SHELF ${id}`}
        marquee
        // fills the header between the side panels, above the top board
        position={[0, SHELF_HEIGHT - HEADER / 2, SHELF_DEPTH / 2 - 0.002]}
        width={SHELF_WIDTH - PANEL * 2}
        height={HEADER}
        background="#1d3fbf"
        color="#ffd400"
      />

      {/* the tiers below the first slots are closed off with a plain blue panel */}
      <Label
        text=""
        position={[0, PANEL + (FIRST_TIER * tierSpacing - PANEL) / 2, SHELF_DEPTH / 2 - 0.002]}
        width={SHELF_WIDTH - PANEL * 2}
        height={FIRST_TIER * tierSpacing - PANEL}
        background="#142c86"
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
