import { type World } from 'koota'
import { Raycaster, Vector2 } from 'three'
import { Mesh } from '../../shared/traits'
import useGameStore from '../../stores/gameStore'
import { setMusicMuted } from '../ambience'
import { playInteract, resumeAudioContext, setSfxMuted, tickFootstep } from '../sounds'
import { isBusy, nav, step, turn } from './nav'
import { Controllable, NearestItem } from './traits'

const _raycaster = new Raycaster()
const _pointer = new Vector2(0, 0)

// Max distance from the camera to interact with something
export const INTERACT_REACH = 3.5

// Object names that can be pointed at and interacted with. Each such object
// carries a human readable `userData.label`.
export const INTERACTABLE_NAMES = ['tape', 'slot', 'shelf', 'counter', 'computer', 'rewinder', 'dropBin']

export const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)

export type NavAction = 'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight'

const KEY_ACTIONS: Record<string, NavAction> = {
  arrowup: 'forward',
  w: 'forward',
  arrowdown: 'back',
  s: 'back',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right',
  q: 'turnLeft',
  e: 'turnRight',
}

let justPressed = new Set<string>()
let queuedActions: NavAction[] = []
let clicked = false
let initialized = false

// Called by on-screen buttons
export function queueNavAction(action: NavAction) {
  resumeAudioContext()
  queuedActions.push(action)
}

function setPointer(clientX: number, clientY: number) {
  _pointer.set(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1,
  )
}

function isUi(target: EventTarget | null) {
  return !!(target as HTMLElement | null)?.closest?.('button, a, .menu, .computer, .tape-card, .day-summary')
}

function initInputListeners() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  window.addEventListener('keydown', (e) => {
    resumeAudioContext()
    const key = e.key.toLowerCase()
    if (e.repeat) return
    justPressed.add(key)
    if (key.startsWith('arrow')) e.preventDefault()
  })

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') setPointer(e.clientX, e.clientY)
  })

  window.addEventListener('pointerdown', (e) => {
    if (isUi(e.target)) return
    resumeAudioContext()
    setPointer(e.clientX, e.clientY)
    clicked = true
  })
}

export const controllerInputSystem = (world: World, delta: number) => {
  initInputListeners()
  const now = performance.now()
  const store = useGameStore.getState()

  if (store.scene === 'game') store.tick(Math.min(delta, 0.5))
  if (justPressed.has('f') && store.carried.length) store.flipCover()
  if (justPressed.has('escape') && store.computerOpen) store.setComputerOpen(false)

  if (justPressed.has('m')) {
    useGameStore.getState().cycleSoundMode()
    const mode = useGameStore.getState().soundMode
    setMusicMuted(mode === 'muteMusic' || mode === 'muteAll')
    setSfxMuted(mode === 'muteAll')
  }

  for (const key of justPressed) {
    if (KEY_ACTIONS[key]) queuedActions.push(KEY_ACTIONS[key])
  }
  // One action runs at a time; a press during a move or turn waits for it to
  // finish, and anything beyond that one buffered press is dropped
  if (useGameStore.getState().scene !== 'game') queuedActions = []
  if (queuedActions.length && !isBusy(now)) {
    runAction(queuedActions[0], now)
    queuedActions = []
  } else if (queuedActions.length > 1) {
    queuedActions = queuedActions.slice(0, 1)
  }

  // The camera can move under a still pointer, so check what it's over every frame
  const cam = findCamera(world)
  if (cam) updateHovered(world, cam)

  if (clicked) {
    clicked = false
    const hovered = world.get(NearestItem) as any
    if (hovered?.mesh) interact(hovered.mesh)
  }

  justPressed = new Set()
}

export default controllerInputSystem

function runAction(action: NavAction, now: number) {
  switch (action) {
    case 'forward':
    case 'right':
    case 'back':
    case 'left': {
      const relative = { forward: 0, right: 1, back: 2, left: 3 }[action] as 0 | 1 | 2 | 3
      if (step(relative, now)) {
        tickFootstep(true, now)
        useGameStore.getState().setComputerOpen(false)
      }
      break
    }
    case 'turnLeft':
      turn(-1, now)
      useGameStore.getState().setComputerOpen(false)
      break
    case 'turnRight':
      turn(1, now)
      useGameStore.getState().setComputerOpen(false)
      break
  }
}

function interact(mesh: any) {
  const store = useGameStore.getState()
  const { slotId } = mesh.userData ?? {}
  if (mesh.name === 'tape') {
    const before = store.carried.length
    store.pickUp(slotId)
    if (useGameStore.getState().carried.length > before) playInteract()
  } else if (mesh.name === 'slot') {
    const before = store.carried.length
    store.putDown(slotId)
    if (useGameStore.getState().carried.length < before) playInteract()
  } else if (mesh.name === 'computer') {
    if (nav.node.id !== 'counter') {
      store.showMessage('Walk behind the counter to use the computer')
      return
    }
    playInteract()
    store.setComputerOpen(true)
  } else if (mesh.name === 'dropBin') {
    store.takeFromReturnBox()
  } else if (mesh.name === 'rewinder') {
    store.useRewinder()
  }
}

function findCamera(world: World) {
  for (const entity of world.query(Controllable)) {
    const mesh = entity.get(Mesh) as any
    const cam = mesh?.getObjectByName?.('playerCamera')
    if (cam) return cam
  }
  return null
}

const updateHovered = (world: World, camera: any) => {
  let best: { entity: any; mesh: any; distance: number } | null = null
  _raycaster.setFromCamera(_pointer, camera)

  for (const e of world.entities) {
    const mesh = e.get(Mesh) as any
    if (!mesh) continue

    for (const name of INTERACTABLE_NAMES) {
      const objs = mesh.getObjectsByProperty?.('name', name) ?? []
      for (const obj of objs) {
        if (!obj?.visible) continue
        const intersects = _raycaster.intersectObject(obj, true)
        if (intersects.length === 0) continue
        const dist = intersects[0].distance
        if (dist > INTERACT_REACH) continue
        if (best === null || dist < best.distance) {
          best = { entity: e, mesh: obj, distance: dist }
        }
      }
    }
  }

  const current = world.get(NearestItem)
  const next = best
    ? { entity: best.entity, mesh: best.mesh }
    : { entity: null, mesh: null }

  if (current?.entity !== next.entity || current?.mesh !== next.mesh) {
    world.set(NearestItem, next)
    document.body.style.cursor = best ? 'pointer' : ''
    useGameStore.getState().setHovered(
      best
        ? { kind: best.mesh.name, label: best.mesh.userData?.label ?? best.mesh.name }
        : null,
    )
  }
}
