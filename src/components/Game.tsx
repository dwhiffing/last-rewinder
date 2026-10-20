import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { type Group } from 'three'
import { processMountQueue } from '../entities/mountScheduler'
import { CrtWarp } from './CrtWarp'
import { VhsOverlay } from './VhsOverlay'
import { PerfPanel, PerfProbe } from './PerfStats'
import { playDayEnd } from '../entities/sounds'
import { resetNav } from '../entities/controller/nav'

import { Preload } from '@react-three/drei'
import {
  cursor,
  isTouchDevice,
  onCursorMove,
  type NavAction,
  queueNavAction,
} from '../entities/controller/system'
import { DebugLevel } from '../levels/debug'
import { KootaSystems } from '../providers'
import { type Order } from '../data/orders'
import SnackBox, { snackBoxSize } from '../entities/store/snackBox'
import SodaCan from '../entities/store/sodaCan'
import HeldTape, { CASE_SIZE } from '../entities/store/heldTape'
import {
  isSnack,
  itemColor,
  itemName,
  SNACK_TYPES,
  type SnackType,
  snackOf,
  SNACKS,
} from '../data/snacks'
import { GENRE_COLORS, lengthOf, RATING_COLORS, tapeById } from '../data/tapes'
import useGameStore, {
  orderPicks,
  type GameState,
  MAX_CARRIED,
  RENT_EVERY,
  SNACK_DAY,
  SNACKS_PER_ORDER,
  type SoundMode,
} from '../stores/gameStore'

function MountScheduler() {
  useFrame(() => {
    processMountQueue()
  })
  return null
}
// Compiles all shaders (including from initially-hidden rooms) before first frame
function ShaderWarmup() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    gl.compileAsync(scene, camera).catch(() => {})
  }, [])
  return null
}

export function Game() {
  // The VHS/CRT filter already hides fine detail, so there's nothing to gain
  // from rendering above native resolution
  const dpr = 0.6
  return (
    <div className="game">
      {/* The post-processing pass renders into its own (non-multisampled)
          target, so antialiasing the screen buffer is wasted work. Prefer
          the low-power GPU: on laptops with two this keeps the discrete
          one (and its fans) asleep, and the store is light enough for it */}
      <Canvas
        dpr={dpr}
        shadows
        gl={{ antialias: false, powerPreference: 'low-power', stencil: false }}>
        {import.meta.env.DEV && <PerfProbe />}
        <Preload all />
        <ShaderWarmup />
        <MountScheduler />
        <KootaSystems>
          <DebugLevel />
        </KootaSystems>
        <CrtWarp />
      </Canvas>
      <Hud />
    </div>
  )
}

export default Game

const SOUND_MODE_LABELS: Record<SoundMode, string> = {
  all: 'Unmute All',
  muteMusic: 'Mute Music',
  muteAll: 'Mute All',
}

function SoundModeToast() {
  const soundMode = useGameStore((s) => s.soundMode)
  const [toastKey, setToastKey] = useState<number | null>(null)
  const prevMode = useRef(soundMode)

  useEffect(() => {
    if (soundMode === prevMode.current) return
    prevMode.current = soundMode
    setToastKey(Date.now())
  }, [soundMode])

  if (toastKey === null) return null

  return (
    <div
      key={toastKey}
      style={{
        color: 'white',
        fontSize: 17.5,
        pointerEvents: 'none',
        animation: 'soundToastFade 0.5s ease-out 1.5s forwards',
        opacity: 1,
      }}>
      {SOUND_MODE_LABELS[soundMode]}
    </div>
  )
}

function actionHint(kind: string, s: GameState) {
  const { carried } = s
  const verb = isTouchDevice ? 'Tap' : 'Click'
  const top = carried[carried.length - 1]
  if (kind === 'computer') return `${verb} to check orders`
  if (kind === 'dropBin') {
    if (!s.returnBox.length) return 'Empty'
    if (carried.length >= MAX_CARRIED) return 'Hands full'
    return `${verb} to take one (${s.returnBox.length} inside)`
  }
  if (kind === 'rewinder') {
    if (s.rewinder) {
      const left = s.rewinder.doneAt - s.time
      return left > 0
        ? `Rewinding ${itemName(s.rewinder.tapeId)}: ${Math.ceil(left)}s`
        : top && s.needsRewind[top]
          ? `${verb} to swap in ${itemName(top)}`
          : `${verb} to take out ${itemName(s.rewinder.tapeId)}`
    }
    if (top && s.needsRewind[top]) return `${verb} to rewind ${itemName(top)}`
    return 'Empty'
  }
  if (kind === 'tape' || kind === 'returnTape')
    return carried.length >= MAX_CARRIED ? 'Hands full' : `${verb} to pick up`
  if (kind === 'slot') {
    return top ? `${verb} to put down` : null
  }
  return null
}

// What the pointer is over, and what clicking it would do
// Things you can tap or click that don't need naming at the bottom of the screen
const UNLABELLED = new Set([
  'slot',
  'shelf',
  'counter',
  'table',
  'wall',
  'window',
  'door',
])
function LookPrompt() {
  const hovered = useGameStore((s) => s.hovered)
  // re-read the rest of the state whenever the hint text would change
  const hint = useGameStore((s) =>
    s.hovered ? actionHint(s.hovered.kind, s) : null,
  )
  const dark = useGameStore((s) => s.powerOut)
  if (!hovered) return null
  // too dark to read a tape's label; empty slots and scenery go unnamed
  const label = dark
    ? 'too dark to see'
    : UNLABELLED.has(hovered.kind)
      ? ''
      : hovered.label
  if (!label && !hint) return null
  return (
    <div className="look-prompt">
      {label}
      {hint && <span className="look-hint">{hint}</span>}
    </div>
  )
}

const genreColor = (g: string) => GENRE_COLORS[g as keyof typeof GENRE_COLORS]

// Tapes in your hands; the top of the stack is the one you can put down
function CarriedStack() {
  const carried = useGameStore((s) => s.carried)
  const needsRewind = useGameStore((s) => s.needsRewind)
  // re-render when the lights go out so the titles are hidden
  useGameStore((s) => s.powerOut)
  return (
    <div className="carried">
      <div className="carried-title">
        Carrying {carried.length}/{MAX_CARRIED}
      </div>
      {[...carried].reverse().map((id, i) => {
        return (
          <div key={id} className={`carried-tape ${i === 0 ? 'top' : ''}`}>
            <span
              className="swatch"
              style={{ background: itemColor(id, genreColor) }}
            />
            {itemName(id)}
            {needsRewind[id] && <span className="rewind-tag">rewind</span>}
          </div>
        )
      })}
    </div>
  )
}

function MessageToast() {
  const message = useGameStore((s) => s.message)
  if (!message) return null
  return (
    <div
      key={message.at}
      style={{
        color: '#ffd400',
        fontSize: 17.5,
        letterSpacing: 1,
        pointerEvents: 'none',
        animation: 'hudMessageFade 2s ease-out forwards',
      }}>
      {message.text}
    </div>
  )
}

const NAV_BUTTONS: { action: NavAction; label: string; title: string }[] = [
  { action: 'turnLeft', label: '\u21b6', title: 'Turn left (Q)' },
  { action: 'forward', label: '\u2191', title: 'Forward (\u2191)' },
  { action: 'turnRight', label: '\u21b7', title: 'Turn right (E)' },
  { action: 'left', label: '\u2190', title: 'Step left (\u2190)' },
  { action: 'back', label: '\u2193', title: 'Back (\u2193)' },
  { action: 'right', label: '\u2192', title: 'Step right (\u2192)' },
]

function NavButtons() {
  return (
    <div className="nav-buttons">
      {NAV_BUTTONS.map(({ action, label, title }) => (
        <button
          key={action}
          title={title}
          aria-label={title}
          onPointerDown={(e) => {
            e.preventDefault()
            queueNavAction(action)
          }}>
          {label}
        </button>
      ))}
    </div>
  )
}

// Re-render a few times a second for countdowns, not every frame
const useClock = () => useGameStore((s) => Math.floor(s.time * 4) / 4)

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function MoneyHud() {
  const money = useGameStore((s) => s.money)
  const orders = useGameStore((s) => s.orders)
  const day = useGameStore((s) => s.day)
  const rentDue = useGameStore((s) => s.rentDue)
  const rentDay = Math.ceil(day / RENT_EVERY) * RENT_EVERY

  return (
    <div className="money-hud">
      <div className="day-clock">Day {day}</div>
      <div className="money">${money}</div>
      <div className={`rent-line ${money < rentDue ? 'short' : ''}`}>
        ${rentDue} due day {rentDay}
      </div>
    </div>
  )
}

const KIND_LABELS: Record<Order['kind'], string> = {
  title: 'Title',
  suggestion: 'Suggestion',
}

// Film titles in an order's text are written in quotes; they're shown bold
// (without the quotes) so they stand out
function OrderText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/"([^"]+)"/)
        .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
    </>
  )
}

function OrderCard({ order, time }: { order: Order; time: number }) {
  const fill = useGameStore((s) => s.fillOrder)
  const day = useGameStore((s) => s.day)
  // lit up when you're holding everything it needs, so one click sends it
  const ready = useGameStore(
    (s) => !!orderPicks(order, s.carried, s.needsRewind),
  )
  const total = order.expiresAt - order.createdAt
  const left = order.expiresAt - time
  return (
    <div
      role="button"
      tabIndex={0}
      className={`order-card kind-${order.kind} ${ready ? 'ready' : ''}`}
      onClick={() => fill(order.id)}>
      <div className="order-head">
        <span className="order-kind">{KIND_LABELS[order.kind]}</span>
        <span className="order-reward">${order.reward}</span>
      </div>
      <div className="order-text">
        <OrderText text={order.text} />
      </div>
      {order.tags.length > 0 && (
        <div className="order-tags">
          {order.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      {order.snack && (
        <div className="order-progress">
          <span className="order-snack">
            Needs {SNACKS_PER_ORDER > 1 ? `${SNACKS_PER_ORDER} ` : ''}
            {order.snack}
          </span>
        </div>
      )}
      <div className="order-timer">
        <div
          className={left < 15 ? 'urgent' : ''}
          style={{ width: `${Math.max(0, (left / total) * 100)}%` }}
        />
      </div>
      <div className="order-foot">
        <span className="order-time">{formatTime(left)} left</span>
      </div>
    </div>
  )
}

// The counter computer: lists open orders. Clicking one hands in the top tape.
function OrdersScreen() {
  const open = useGameStore((s) => s.computerOpen)
  const orders = useGameStore((s) => s.orders)
  const top = useGameStore((s) => s.carried[s.carried.length - 1])
  const close = useGameStore((s) => s.setComputerOpen)
  const day = useGameStore((s) => s.day)
  const time = useClock()
  const powerOut = useGameStore((s) => s.powerOut)
  const restorePower = useGameStore((s) => s.restorePower)
  // any press outside the screen closes it, even on HUD bits above the backdrop
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.('.computer-screen'))
        close(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [open, close])
  if (!open) return null
  if (powerOut)
    return (
      <div className="computer">
        <div className="computer-screen power-screen">
          <div className="computer-title">
            <span>POWER FAILURE</span>
            <button
              className="computer-close"
              onClick={() => close(false)}
              aria-label="Close">
              {'\u2715'}
            </button>
          </div>
          <div className="computer-hint">
            Running on backup battery. Orders are still ticking.
          </div>
          <button className="restore-power" onClick={() => restorePower()}>
            Restore power
          </button>
        </div>
      </div>
    )
  return (
    <div className="computer">
      <div className="computer-screen">
        <div className="computer-title">
          <span>VIDEO-NET ORDERS</span>
          <button
            className="computer-close"
            onClick={() => close(false)}
            aria-label="Close">
            {'\u2715'}
          </button>
        </div>
        <div className="computer-hint">
          {top
            ? 'Click an order to send it with the tapes you are carrying'
            : 'Pick up the tapes an order asks for, then click it to send it'}
        </div>
        <div className="order-list">
          {orders.length === 0 && (
            <div className="no-orders">Waiting for orders...</div>
          )}
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} time={time} />
          ))}
        </div>
        {day >= SNACK_DAY && <SnackShop />}
      </div>
    </div>
  )
}

// Restock snacks; they're put out on the snack shelves the next morning
function SnackShop() {
  const buy = useGameStore((s) => s.buySnack)
  const money = useGameStore((s) => s.money)
  return (
    <div className="snack-shop">
      <div className="computer-title">SNACK ORDERS</div>
      <div className="computer-hint">On the snack shelves tomorrow morning</div>
      <div className="snack-list">
        {SNACK_TYPES.map((type) => (
          <button
            key={type}
            disabled={money < SNACKS[type].cost}
            onClick={() => buy(type)}>
            <span
              className="swatch"
              style={{ background: SNACKS[type].color }}
            />
            {type}
            <span className="snack-cost">${SNACKS[type].cost}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// The snack in your hands, front on
function HeldSnack({ type }: { type: SnackType }) {
  return (
    <group rotation={[0.15, 0, 0]}>
      {type === 'Soda' ? (
        <SodaCan position={[0, 0, 0]} />
      ) : (
        <SnackBox
          type={type}
          size={snackBoxSize(type, 0.25, 0.3)}
          position={[0, 0, 0]}
        />
      )}
    </group>
  )
}

// Box art for the top tape in your hands. Click (or F) to flip it over.
// Everything you're carrying, piled up in your hands: the items under the
// top one peek out above and behind it, each nudged and tilted a little (the
// same way every time for the same item)
const PILE_UP = 0.016
const PILE_BACK = 0.04
function pileJitter(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return {
    x: ((h & 255) / 255 - 0.5) * 0.024,
    tilt: (((h >>> 8) & 255) / 255 - 0.5) * 0.12,
  }
}
// One item's place in the pile (0 is the top). It eases there rather than
// jumping when the pile changes, and a newly picked-up item slides up into
// your hands from below.
const PILE_EASE = 12
// the item you're actually holding (the front one) shows this much bigger
const FRONT_SCALE = 1.43
// how far below its spot a picked-up item starts: off the bottom of the screen
const PILE_ENTER_FROM = 1.2
function PileSlot({
  id,
  depth,
  children,
}: {
  id: string
  depth: number
  children: ReactNode
}) {
  const ref = useRef<Group>(null)
  const { x, tilt } = pileJitter(id)
  const target = () => ({
    x: depth ? x : 0,
    // the ones behind sit up enough to peek over the bigger front item
    y: depth ? FRONT_RAISE + depth * PILE_UP : 0,
    z: -depth * PILE_BACK,
    tilt: depth ? tilt : 0,
    scale: depth ? 1 : FRONT_SCALE,
  })
  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    const t = target()
    // start below the bottom of the card, out of sight
    g.position.set(t.x, t.y - PILE_ENTER_FROM, t.z + 0.04)
    g.rotation.z = t.tilt
    g.scale.setScalar(t.scale)
  }, [])
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const t = target()
    const k = 1 - Math.exp(-PILE_EASE * Math.min(dt, MAX_PILE_DT))
    g.position.x += (t.x - g.position.x) * k
    g.position.y += (t.y - g.position.y) * k
    g.position.z += (t.z - g.position.z) * k
    g.rotation.z += (t.tilt - g.rotation.z) * k
    g.scale.setScalar(g.scale.x + (t.scale - g.scale.x) * k)
  })
  return <group ref={ref}>{children}</group>
}

// The pile view runs down to the bottom of the screen, so things picked up can
// rise in from the screen's edge without being clipped; the pile itself rests
// in its top PILE_REGION_PX (keep in step with .held-art in index.css). The
// camera backs off just enough to fit the whole pile in that region.
const PILE_FOV = 40
// The pile rests in at most this many px of the view, and never more than
// PILE_REGION_VH of the window's height (keep in step with .held-art in
// index.css)
const PILE_REGION_PX = 644
const PILE_REGION_VH = 0.6
// ...and no more than this share of the window's width, so it stays small on
// narrow windows too
const PILE_REGION_VW = 0.5
const ITEM_HALF_HEIGHT = 0.16
const ITEM_HALF_WIDTH = 0.14
// lifts everything behind the front item so its top still shows over it
const FRONT_RAISE = ITEM_HALF_HEIGHT * (FRONT_SCALE - 1) + 0.01
// A tape in front is framed on its real size (with some room around it)
// rather than the generic item size, which is sized for the bigger snack
// boxes. Bigger padding shows it smaller.
const TAPE_FIT_PAD = 1.39
// gap left of the pile, as a share of the view's half-width (negative lets it
// hang off the left edge of the screen a little, like it's in your hand)
const PILE_LEFT_MARGIN = -0.05
function PileCamera({
  count,
  frontIsTape,
  hint,
}: {
  count: number
  frontIsTape: boolean
  // the label under the front item, kept centred under it on screen
  hint: RefObject<HTMLDivElement | null>
}) {
  const { camera, size } = useThree()
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, MAX_PILE_DT)
    const t = Math.tan(((PILE_FOV / 2) * Math.PI) / 180)
    // share of the view's height the pile sits in
    const regionPx = Math.min(
      PILE_REGION_PX,
      PILE_REGION_VH * window.innerHeight,
      PILE_REGION_VW * window.innerWidth,
    )
    const region = Math.min(1, regionPx / size.height)
    // the bigger front item, and the ones behind peeking out over it
    const frontHalf = frontIsTape
      ? (CASE_SIZE[1] / 2) * FRONT_SCALE * TAPE_FIT_PAD
      : ITEM_HALF_HEIGHT * FRONT_SCALE
    const behindTop =
      count > 1 ? FRONT_RAISE + (count - 1) * PILE_UP + ITEM_HALF_HEIGHT : 0
    const top = Math.max(frontHalf, behindTop)
    const bottom = -frontHalf
    const halfH = (top - bottom) / 2 + 0.02
    const middle = (top + bottom) / 2
    const halfW =
      frontIsTape && count === 1
        ? (CASE_SIZE[0] / 2) * FRONT_SCALE * TAPE_FIT_PAD
        : ITEM_HALF_WIDTH * FRONT_SCALE
    const dist = Math.max(
      halfH / (t * region),
      halfW / (t * (size.width / size.height)),
    )
    const k = 1 - Math.exp(-PILE_EASE * dt)
    camera.position.z += (dist - camera.position.z) * k
    // drop the camera so the pile sits up in its region, not mid-view
    const drop = (1 - region) * camera.position.z * t
    camera.position.y += (middle - drop - camera.position.y) * k
    // and slide it so the pile hugs the left of the view (the left edge of the
    // screen), keeping it clear of what you're looking at
    const viewHalfW = camera.position.z * t * (size.width / size.height)
    const shift = viewHalfW - halfW - viewHalfW * PILE_LEFT_MARGIN
    camera.position.x += (shift - camera.position.x) * k
    // the front item is centred on x = 0, so it shows this far across the view
    if (hint.current) {
      const across = (-camera.position.x / viewHalfW + 1) / 2
      hint.current.style.left = `${across * size.width}px`
    }
  })
  return null
}

// The pile view only draws on demand: once everything has eased into place
// it's a still picture, and redrawing it 60+ times a second would be wasted
// GPU time. Whenever something about the pile changes this keeps it drawing
// long enough for the easing (and a cover flip) to finish.
const PILE_AWAKE_MS = 1500
// after a pause in drawing the next frame's delta is huge; clamp it so the
// easing picks up smoothly instead of snapping to the end
const MAX_PILE_DT = 1 / 30
function AwakeWhileChanging({ deps }: { deps: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate)
  const size = useThree((s) => s.size)
  const until = useRef(0)
  useEffect(() => {
    until.current = performance.now() + PILE_AWAKE_MS
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, size.width, size.height, invalidate])
  useFrame(() => {
    if (performance.now() < until.current) invalidate()
  })
  return null
}

function HeldItem({
  id,
  unrewound,
  flipped,
}: {
  id: string
  unrewound: boolean
  flipped: boolean
}) {
  return isSnack(id) ? (
    <HeldSnack type={snackOf(id).type} />
  ) : (
    <HeldTape tapeId={id} unrewound={unrewound} flipped={flipped} />
  )
}

function TapeCard() {
  const carried = useGameStore((s) => s.carried)
  const needsRewind = useGameStore((s) => s.needsRewind)
  const flipped = useGameStore((s) => s.coverFlipped)
  const dark = useGameStore((s) => s.powerOut)
  const top = carried[carried.length - 1]
  const hintRef = useRef<HTMLDivElement>(null)
  // can't make out tapes in the dark, only snacks
  const visible = dark ? carried.filter(isSnack) : carried
  const shown = visible[visible.length - 1]
  const topIsTape = !!top && shown === top && !isSnack(top)
  // The 3D view stays mounted even with empty hands, just hidden and only
  // drawing on demand: tearing its WebGL context down when the last item was
  // put away flashed the canvas white. On demand (rather than not at all) it
  // still draws once after the last item goes, so the next pickup doesn't
  // briefly show that stale picture.
  const empty = !visible.length
  return (
    <div
      className={`tape-card ${topIsTape ? 'held-card' : 'snack-card'} ${empty ? 'empty' : ''}`}>
      <Canvas
        className="held-art"
        camera={{ position: [0, 0, 0.6], fov: PILE_FOV }}
        dpr={[1, 2]}
        frameloop="demand">
        <ambientLight intensity={1.3} />
        <directionalLight position={[0.3, 0.5, 1]} intensity={1.6} />
        <directionalLight position={[-0.3, 0.5, -1]} intensity={1.6} />
        <PileCamera
          count={visible.length}
          frontIsTape={!!shown && !isSnack(shown)}
          hint={hintRef}
        />
        <AwakeWhileChanging
          deps={[visible.join(), flipped, topIsTape, needsRewind]}
        />
        {visible.map((id, i) => {
          const depth = visible.length - 1 - i
          return (
            <PileSlot key={id} id={id} depth={depth}>
              <HeldItem
                id={id}
                unrewound={!!needsRewind[id]}
                flipped={depth === 0 && topIsTape && flipped}
              />
            </PileSlot>
          )
        })}
      </Canvas>
      <div className="tape-card-hint" ref={hintRef}>
        {topIsTape
          ? 'F to flip'
          : shown && isSnack(shown)
            ? snackOf(shown).type
            : ''}
      </div>
    </div>
  )
}

// End of day: what happened today and a button to open tomorrow.
// The store fades to black, the summary comes up with its sound, and a click
// fades the card out, starts the next day behind the black, then fades the
// store back in.
const DAY_END_FADE_MS = 1000
const CARD_FADE_MS = 300
const DAY_START_FADE_MS = 1000
type DayFade = 'none' | 'toBlack' | 'card' | 'cardOut' | 'fromBlack'
function DaySummaryScreen() {
  const summary = useGameStore((s) => s.dayOver)
  const day = useGameStore((s) => s.day)
  const money = useGameStore((s) => s.money)
  const next = useGameStore((s) => s.startNextDay)
  const [phase, setPhase] = useState<DayFade>('none')
  // the last summary shown, so the card can fade out after the store clears it
  const shown = useRef(summary)
  if (summary) shown.current = summary
  const ended = !!summary
  useEffect(() => {
    if (!ended) {
      // cleared from outside (back to the menu): drop the overlay, unless
      // we're the ones starting the next day
      setPhase((p) => (p === 'cardOut' || p === 'fromBlack' ? p : 'none'))
      return
    }
    setPhase('toBlack')
    const timer = window.setTimeout(() => {
      setPhase('card')
      playDayEnd()
    }, DAY_END_FADE_MS)
    return () => window.clearTimeout(timer)
  }, [ended])
  useEffect(() => {
    if (phase === 'cardOut') {
      const timer = window.setTimeout(() => {
        next()
        setPhase('fromBlack')
      }, CARD_FADE_MS)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'fromBlack') {
      const timer = window.setTimeout(() => setPhase('none'), DAY_START_FADE_MS)
      return () => window.clearTimeout(timer)
    }
  }, [phase, next])
  const card = shown.current
  if (phase === 'none' || !card) return null
  const showCard = phase === 'card' || phase === 'cardOut'
  return (
    <div
      className={`day-summary day-fade ${phase}`}
      style={{
        animationDuration: `${phase === 'fromBlack' ? DAY_START_FADE_MS : DAY_END_FADE_MS}ms`,
        cursor: phase === 'card' ? 'pointer' : undefined,
      }}
      // once the card's up, a click anywhere opens the next day
      onClick={() => phase === 'card' && setPhase('cardOut')}>
      {showCard && (
        <div
          className={`day-summary-card ${phase === 'cardOut' ? 'leaving' : ''}`}
          style={{ animationDuration: `${CARD_FADE_MS}ms` }}>
          <h2>Day {day} is over</h2>
          <div>Orders filled: {card.filled}</div>
          <div>Orders missed: {card.missed}</div>
          <div>Earned today: ${card.earned}</div>
          {card.rentPaid !== undefined && (
            <div>Rent paid: ${card.rentPaid}</div>
          )}
          <div className="day-summary-total">Total: ${money}</div>
          <button>Open day {day + 1}</button>
        </div>
      )}
    </div>
  )
}

function GameOverScreen() {
  const over = useGameStore((s) => s.gameOver)
  const money = useGameStore((s) => s.money)
  const reset = useGameStore((s) => s.resetGame)
  if (!over) return null
  // fades to black like a day end, then the card comes up
  return (
    <div
      className="day-summary day-fade toBlack"
      style={{ animationDuration: `${DAY_END_FADE_MS}ms` }}>
      <div
        className="day-summary-card"
        style={{
          animationDuration: `${CARD_FADE_MS}ms`,
          animationDelay: `${DAY_END_FADE_MS}ms`,
        }}>
        <h2>Evicted!</h2>
        <div>
          Rent of ${over.rent} was due at the end of day {over.day}, but you
          only had ${money}.
        </div>
        <button
          onClick={() => {
            resetNav()
            reset()
          }}>
          Back to the menu
        </button>
      </div>
    </div>
  )
}

// Prototype helpers
function DebugButtons() {
  const skipDay = useGameStore((s) => s.debugSkipDay)
  const addMoney = useGameStore((s) => s.debugAddMoney)
  const vhsOn = useGameStore((s) => s.vhsOn)
  // switch suspects off to see what they cost (see PerfStats)
  const [filterOn, setFilterOn] = useState(true)
  useEffect(() => {
    document.querySelector('.game')?.classList.toggle('no-filter', !filterOn)
  }, [filterOn])
  return (
    <div className="debug-buttons">
      <PerfPanel />
      <button onClick={() => setFilterOn(!filterOn)}>
        CSS filter: {filterOn ? 'on' : 'off'}
      </button>
      <button onClick={() => useGameStore.getState().toggleVhs()}>
        VHS: {vhsOn ? 'on' : 'off'}
      </button>
      <button onClick={() => skipDay()}>Skip day</button>
      <button onClick={() => addMoney()}>+$5</button>
      <button onClick={() => useGameStore.setState({ powerOut: true })}>
        Power cut
      </button>
      <button onClick={() => useGameStore.getState().debugAddReturn()}>
        +Return
      </button>
    </div>
  )
}

// A small white dot in place of the system cursor during play, fading back
// while it's over something you can interact with
function CustomCursor() {
  const ref = useRef<HTMLDivElement>(null)
  const inGame = useGameStore((s) => s.scene === 'game')
  const onItem = useGameStore((s) => !!s.hovered)
  // follows our own cursor position, which keeps moving while the mouse is locked
  useEffect(
    () =>
      onCursorMove(() => {
        const dot = ref.current
        if (!dot) return
        dot.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`
        dot.style.display = 'block'
      }),
    [],
  )
  useEffect(() => {
    if (!inGame) return
    document.documentElement.classList.add('hide-cursor')
    return () => document.documentElement.classList.remove('hide-cursor')
  }, [inGame])
  if (!inGame) return null
  return (
    <div
      ref={ref}
      className={`custom-cursor ${onItem ? 'dim' : ''}`}
      aria-hidden
    />
  )
}

// Fades the corner HUD back while you're pointing at a tape (or snack) on a
// shelf, so it doesn't compete with reading it
function HudDimmer() {
  const pointing = useGameStore(
    (s) => s.hovered?.kind === 'tape' || s.hovered?.kind === 'returnTape',
  )
  useEffect(() => {
    document.body.classList.toggle('hud-dim', pointing)
    return () => document.body.classList.remove('hud-dim')
  }, [pointing])
  return null
}

function Hud() {
  return (
    <>
      <HudDimmer />
      <CustomCursor />
      <VhsOverlay />
      {import.meta.env.DEV && <DebugButtons />}
      <GameOverScreen />
      <DaySummaryScreen />
      <LookPrompt />
      <CarriedStack />
      <MoneyHud />
      <TapeCard />
      <OrdersScreen />
      <NavButtons />
      <div className="ui">
        <SoundModeToast />
        <MessageToast />
      </div>
    </>
  )
}
