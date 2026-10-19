import { type World } from 'koota'
import { Raycaster, Vector2, Vector3 } from 'three'
import { Mesh } from '../../shared/traits'
import useGameStore from '../../stores/gameStore'
import { setMusicMuted } from '../ambience'
import { shakeDoor } from '../store/door'
import {
  DOOR_RATTLE_SECONDS,
  playDoorRattle,
  playDrop,
  playError,
  playFootstep,
  playPickup,
  playTap,
  playTyping,
  playWallTap,
  playWindowTap,
  playWhoosh,
  resumeAudioContext,
  setSfxMuted,
} from '../sounds'
import { isBusy, nav, step, turn } from './nav'
import { Controllable, NearestItem } from './traits'

const _raycaster = new Raycaster()
const _pointer = new Vector2(0, 0)
// pointer in -1..1 screen space, for the camera's look-around at shelves
export const pointerNdc = _pointer

// Max distance from the camera to interact with something
export const INTERACT_REACH = 3.5

// Object names that can be pointed at and interacted with. Each such object
// carries a human readable `userData.label`.
export const INTERACTABLE_NAMES = ['tape', 'slot', 'shelf', 'counter', 'computer', 'rewinder', 'dropBin', 'door', 'window', 'wall', 'table']

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
let justPlaced: string | null = null
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
        playFootstep()
        useGameStore.getState().setComputerOpen(false)
      }
      break
    }
    case 'turnLeft':
      if (turn(-1, now)) playWhoosh()
      useGameStore.getState().setComputerOpen(false)
      break
    case 'turnRight':
      if (turn(1, now)) playWhoosh()
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
    const { carried } = useGameStore.getState()
    if (carried.length > before) playPickup(carried[carried.length - 1])
  } else if (mesh.name === 'slot') {
    const before = store.carried.length
    const item = store.carried[before - 1]
    store.putDown(slotId)
    const after = useGameStore.getState()
    if (after.carried.length < before) {
      playDrop(item)
      // don't pop the tape straight back out at you; it can be highlighted
      // again once the pointer has left it
      justPlaced = Object.keys(after.slots).find((id) => after.slots[id] === item) ?? null
    }
  } else if (mesh.name === 'shelf' || mesh.name === 'counter' || mesh.name === 'table') {
    if (!store.carried.length) playTap()
  } else if (mesh.name === 'computer') {
    if (nav.node.id !== 'counter') {
      playError()
      store.showMessage('Walk behind the counter to use the computer')
      return
    }
    playTyping()
    store.setComputerOpen(true)
  } else if (mesh.name === 'dropBin') {
    store.takeFromReturnBox()
  } else if (mesh.name === 'rewinder') {
    store.useRewinder()
  } else if (mesh.name === 'window') {
    playWindowTap()
  } else if (mesh.name === 'wall') {
    playWallTap()
  } else if (mesh.name === 'door') {
    shakeDoor()
    playDoorRattle()
    window.setTimeout(() => useGameStore.getState().showMessage("You can't leave"), DOOR_RATTLE_SECONDS * 1000)
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

const _camDir = new Vector3()
const _shelfFront = new Vector3()
const _shelfPos = new Vector3()
const _toCamera = new Vector3()
// Tapes and slots can only be picked from the shelf you're standing in front
// of and facing, not one off to the side or the back of a double-sided unit.
// Their parent is the shelf's group, whose front is local +z.
function facingShelf(obj: any, camera: any) {
  const shelf = obj.parent
  if (!shelf) return true
  _shelfFront.set(0, 0, 1).transformDirection(shelf.matrixWorld)
  shelf.getWorldPosition(_shelfPos)
  camera.getWorldPosition(_toCamera).sub(_shelfPos)
  if (_toCamera.dot(_shelfFront) <= 0) return false
  camera.getWorldDirection(_camDir)
  // looking at it head-on, within about 45 degrees
  return _camDir.dot(_shelfFront) < -0.7
}

function isDrawn(object: any) {
  if (object.userData?.hoverProxy) return true
  const material = object.material
  if (!material) return false
  return Array.isArray(material) ? material.some((m: any) => m.visible) : material.visible
}

const updateHovered = (world: World, camera: any) => {
  let best: { entity: any; mesh: any; distance: number; rank: number } | null = null
  _raycaster.setFromCamera(_pointer, camera)
  const carryingAnything = useGameStore.getState().carried.length > 0

  for (const e of world.entities) {
    const mesh = e.get(Mesh) as any
    if (!mesh) continue

    for (const name of INTERACTABLE_NAMES) {
      const objs = mesh.getObjectsByProperty?.('name', name) ?? []
      for (const obj of objs) {
        if (!obj?.visible) continue
        if ((name === 'tape' || name === 'slot') && !facingShelf(obj, camera)) continue
        // walls and windows can only be tapped with empty hands
        if ((name === 'wall' || name === 'window') && carryingAnything) continue
        const intersects = _raycaster.intersectObject(obj, true)
        if (intersects.length === 0) continue
        // What's actually drawn beats the invisible click boxes around it, so
        // a neighbour's box can't steal the edge of a tape you're pointing at;
        // a shelf's own boards and sides, and the walls, come last of all
        const seen = intersects.find((i) => isDrawn(i.object))
        const dist = (seen ?? intersects[0]).distance
        if (dist > INTERACT_REACH) continue
        const rank = name === 'shelf' || name === 'wall' ? 2 : seen ? 0 : 1
        if (best === null || rank < best.rank || (rank === best.rank && dist < best.distance)) {
          best = { entity: e, mesh: obj, distance: dist, rank }
        }
      }
    }
  }

  // the slot something was just put in stays unhighlighted until the pointer
  // moves off it
  if (justPlaced) {
    if (best?.mesh.userData?.slotId === justPlaced) best = null
    else justPlaced = null
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
        ? {
            kind: best.mesh.name,
            label: best.mesh.userData?.label ?? best.mesh.name,
            slotId: best.mesh.userData?.slotId,
          }
        : null,
    )
  }
}
