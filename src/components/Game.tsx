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
import { GENRE_COLORS, tapeById } from '../data/tapes'
import useGameStore, { MAX_CARRIED, type SoundMode } from '../stores/gameStore'

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

function actionHint(kind: string, carried: string[]) {
  const verb = isTouchDevice ? 'Tap' : 'Click'
  if (kind === 'tape')
    return carried.length >= MAX_CARRIED ? 'Hands full' : `${verb} to pick up`
  if (kind === 'slot') {
    const top = carried[carried.length - 1]
    return top ? `${verb} to put down ${tapeById(top).title}` : 'Nothing to put down'
  }
  return null
}

// What the pointer is over, and what clicking it would do
function LookPrompt() {
  const hovered = useGameStore((s) => s.hovered)
  const carried = useGameStore((s) => s.carried)
  if (!hovered) return null
  const hint = actionHint(hovered.kind, carried)
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

function Hud() {
  return (
    <>
      <LookPrompt />
      <CarriedStack />
      <NavButtons />
      <div className="ui">
        <SoundModeToast />
        <MessageToast />
      </div>
    </>
  )
}
