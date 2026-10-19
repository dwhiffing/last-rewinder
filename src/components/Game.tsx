import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { processMountQueue } from '../entities/mountScheduler'

import { PerformanceMonitor, Preload } from '@react-three/drei'
import {
  isTouchDevice,
  type NavAction,
  queueNavAction,
} from '../entities/controller/system'
import { DebugLevel } from '../levels/debug'
import { KootaSystems } from '../providers'
import { type Order } from '../data/orders'
import { GENRE_COLORS, lengthOf, RATING_COLORS, tapeById } from '../data/tapes'
import useGameStore, { type GameState, MAX_CARRIED, type SoundMode } from '../stores/gameStore'

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
  const [dpr, setDpr] = useState(1.5)
  return (
    <div className="game">
      {/* <Canvas dpr={dpr} shadows frameloop="demand"> */}
      <Canvas dpr={dpr} shadows>
        <PerformanceMonitor
          iterations={10}
          threshold={0.75}
          flipflops={4}
          onIncline={() => setDpr(2)}
          onDecline={() => setDpr(1)}
        />
        <Preload all />
        <ShaderWarmup />
        <MountScheduler />
        <KootaSystems>
          <DebugLevel />
        </KootaSystems>
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
        fontSize: 14,
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
    return `${verb} to take a tape (${s.returnBox.length} inside)`
  }
  if (kind === 'rewinder') {
    if (s.rewinder) {
      const left = s.rewinder.doneAt - s.time
      return left > 0
        ? `Rewinding ${tapeById(s.rewinder.tapeId).title}: ${Math.ceil(left)}s`
        : top && s.needsRewind[top]
          ? `${verb} to swap in ${tapeById(top).title}`
          : `${verb} to take out ${tapeById(s.rewinder.tapeId).title}`
    }
    if (top && s.needsRewind[top]) return `${verb} to rewind ${tapeById(top).title}`
    return 'Empty'
  }
  if (kind === 'tape')
    return carried.length >= MAX_CARRIED ? 'Hands full' : `${verb} to pick up`
  if (kind === 'slot') {
    if (top && s.needsRewind[top]) return `Rewind ${tapeById(top).title} first`
    return top ? `${verb} to put down ${tapeById(top).title}` : 'Nothing to put down'
  }
  return null
}

// What the pointer is over, and what clicking it would do
function LookPrompt() {
  const hovered = useGameStore((s) => s.hovered)
  // re-read the rest of the state whenever the hint text would change
  const hint = useGameStore((s) => (s.hovered ? actionHint(s.hovered.kind, s) : null))
  if (!hovered) return null
  return (
    <div className="look-prompt">
      {hovered.label}
      {hint && <span className="look-hint">{hint}</span>}
    </div>
  )
}

// Tapes in your hands; the top of the stack is the one you can put down
function CarriedStack() {
  const carried = useGameStore((s) => s.carried)
  const needsRewind = useGameStore((s) => s.needsRewind)
  return (
    <div className="carried">
      <div className="carried-title">
        Carrying {carried.length}/{MAX_CARRIED}
      </div>
      {[...carried].reverse().map((id, i) => {
        const tape = tapeById(id)
        return (
          <div key={id} className={`carried-tape ${i === 0 ? 'top' : ''}`}>
            <span className="swatch" style={{ background: GENRE_COLORS[tape.genre] }} />
            {tape.title}
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
        fontSize: 14,
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
  const ordersLeft = useGameStore((s) => s.schedule.length + s.orders.length)
  const time = useClock()
  const soonest = orders.reduce((min, o) => Math.min(min, o.expiresAt), Infinity)
  const left = soonest - time
  return (
    <div className="money-hud">
      <div className="day-clock">
        Day {day} \u00b7 {ordersLeft} order{ordersLeft === 1 ? '' : 's'} left today
      </div>
      <div className="money">${money}</div>
      <div className={`orders-count ${left < 15 ? 'urgent' : ''}`}>
        {orders.length
          ? `${orders.length} order${orders.length > 1 ? 's' : ''} \u00b7 next due ${formatTime(left)}`
          : 'No orders yet'}
      </div>
    </div>
  )
}

const KIND_LABELS: Record<Order['kind'], string> = {
  title: 'Title',
  requirements: 'Request',
  clue: 'Clue',
}

function OrderCard({ order, time }: { order: Order; time: number }) {
  const handIn = useGameStore((s) => s.handIn)
  const notInStock = useGameStore((s) => s.notInStock)
  const day = useGameStore((s) => s.day)
  const total = order.expiresAt - order.createdAt
  const left = order.expiresAt - time
  const done = order.items.filter((i) => i.filled).length
  return (
    <div
      role="button"
      tabIndex={0}
      className={`order-card kind-${order.kind}`}
      onClick={() => handIn(order.id)}>
      <div className="order-head">
        <span className="order-kind">{KIND_LABELS[order.kind]}</span>
        <span className="order-reward">${order.reward}</span>
      </div>
      <div className="order-text">{order.text}</div>
      {order.tags.length > 0 && (
        <div className="order-tags">
          {order.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      {order.items.length > 1 && (
        <div className="order-progress">
          {done}/{order.items.length} tapes handed in
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
        {/* from day 2 some title orders ask for tapes the store doesn't carry */}
        {order.kind === 'title' && day >= 2 && done === 0 && (
          <button
            className="order-missing"
            onClick={(e) => {
              e.stopPropagation()
              notInStock(order.id)
            }}>
            Not in stock
          </button>
        )}
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
  const time = useClock()
  if (!open) return null
  return (
    <div className="computer" onPointerDown={(e) => e.target === e.currentTarget && close(false)}>
      <div className="computer-screen">
        <div className="computer-title">
          <span>VIDEO-NET ORDERS</span>
          <button className="computer-close" onClick={() => close(false)} aria-label="Close">
            {'\u2715'}
          </button>
        </div>
        <div className="computer-hint">
          {top
            ? `Click an order to hand in ${tapeById(top).title}`
            : 'Pick up a tape, then click an order to hand it in'}
        </div>
        <div className="order-list">
          {orders.length === 0 && <div className="no-orders">Waiting for orders...</div>}
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} time={time} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Box art for the top tape in your hands. Click (or F) to flip it over.
function TapeCard() {
  const top = useGameStore((s) => s.carried[s.carried.length - 1])
  const flipped = useGameStore((s) => s.coverFlipped)
  const flip = useGameStore((s) => s.flipCover)
  const unrewound = useGameStore((s) => !!top && !!s.needsRewind[top])
  if (!top) return null
  const tape = tapeById(top)
  return (
    <div className="tape-card" onPointerDown={() => flip()} title="Flip (F)">
      <div className={`tape-card-inner ${flipped ? 'flipped' : ''}`}>
        <div className="tape-front" style={{ background: GENRE_COLORS[tape.genre] }}>
          {unrewound && <div className="rewind-sticker">Please rewind</div>}
          <div className="tape-actors">{tape.actors.join(' \u00b7 ')}</div>
          <div className="tape-title">{tape.title}</div>
          <div className="tape-front-foot">
            <span className="tape-rating" style={{ background: RATING_COLORS[tape.rating] }}>
              {tape.rating}
            </span>
            <span className="tape-year">{tape.year}</span>
          </div>
        </div>
        <div className="tape-back">
          <div className="tape-back-title">{tape.title}</div>
          <p className="tape-bio">{tape.bio}</p>
          <dl className="tape-stats">
            <dt>Genre</dt>
            <dd>{tape.genre}</dd>
            <dt>Rated</dt>
            <dd>{tape.rating}</dd>
            <dt>Released</dt>
            <dd>
              {tape.year} ({tape.decade})
            </dd>
            <dt>Runtime</dt>
            <dd>
              {tape.minutes} min ({lengthOf(tape.minutes)})
            </dd>
            <dt>Starring</dt>
            <dd>{tape.actors.join(', ')}</dd>
          </dl>
        </div>
      </div>
      <div className="tape-card-hint">{flipped ? 'Back' : 'Front'}{' \u00b7 click or F to flip'}</div>
    </div>
  )
}

// End of day: what happened today and a button to open tomorrow
function DaySummaryScreen() {
  const summary = useGameStore((s) => s.dayOver)
  const day = useGameStore((s) => s.day)
  const money = useGameStore((s) => s.money)
  const next = useGameStore((s) => s.startNextDay)
  if (!summary) return null
  return (
    <div className="day-summary">
      <div className="day-summary-card">
        <h2>Day {day} is over</h2>
        <div>Orders filled: {summary.filled}</div>
        <div>Orders missed: {summary.missed}</div>
        <div>Earned today: ${summary.earned}</div>
        <div className="day-summary-total">Total: ${money}</div>
        <button onClick={() => next()}>Open day {day + 1}</button>
      </div>
    </div>
  )
}

function Hud() {
  return (
    <>
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
