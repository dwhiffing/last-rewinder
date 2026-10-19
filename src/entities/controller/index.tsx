import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useWorld } from 'koota/react'
import { useEffect, useRef } from 'react'
import { MathUtils, type Object3D, type PerspectiveCamera as Cam } from 'three'
import {
  CAMERA_PITCH,
  CAMERA_VFOV,
  EYE_HEIGHT,
  SHELF_DEPTH,
  SHELF_WIDTH,
  SHELVES,
  VIEW_DISTANCE,
} from '../../data/storeLayout'
import { Mesh } from '../../shared/traits'
import { facingToYaw, nav, sampleNav } from './nav'
import { pointerNdc } from './system'
import { Controllable, NearestItem } from './traits'

// Horizontal half-angle needed to fit a whole shelf (plus a little margin)
const SHELF_HALF_ANGLE = Math.atan((SHELF_WIDTH / 2 + 0.02) / VIEW_DISTANCE)

// At a shelf the view zooms in this much, and the pointer pivots the camera
// far enough to bring the cropped edges back into view
const SHELF_ZOOM = 1.15
const EASE = 6

// Whether the spot we're at (or heading to) looks straight at a shelf
function facingShelf() {
  const yaw = facingToYaw(nav.facing)
  const reach = VIEW_DISTANCE + SHELF_DEPTH / 2
  const x = nav.node.x - Math.sin(yaw) * reach
  const z = nav.node.z - Math.cos(yaw) * reach
  return SHELVES.some(({ position: [sx, , sz] }) => Math.hypot(sx - x, sz - z) < 0.2)
}

// First person camera locked to the navigation nodes
export function Controller() {
  const world = useWorld()
  const ref = useRef<Object3D>(null)
  const camRef = useRef<Cam>(null)
  const size = useThree((s) => s.size)
  const baseFov = useRef(CAMERA_VFOV)
  const look = useRef({ zoom: 1, yaw: 0, pitch: 0 })

  useEffect(() => {
    if (!ref.current) return
    const entity = world.spawn(Controllable, Mesh(ref.current))
    if (!world.has(NearestItem)) world.add(NearestItem())
    return () => void entity.destroy()
  }, [world])

  // Widen the view on narrow (portrait) screens so a shelf still fits
  useEffect(() => {
    const cam = camRef.current
    if (!cam) return
    const aspect = size.width / size.height
    const needed = 2 * Math.atan(Math.tan(SHELF_HALF_ANGLE) / aspect)
    baseFov.current = Math.max(CAMERA_VFOV, MathUtils.radToDeg(needed))
  }, [size])

  useFrame((_, dt) => {
    const cam = camRef.current
    if (!cam) return
    const { x, z, yaw } = sampleNav(performance.now())
    const atShelf = facingShelf()
    const l = look.current
    const k = 1 - Math.exp(-EASE * dt)
    l.zoom += ((atShelf ? SHELF_ZOOM : 1) - l.zoom) * k
    // how much of each half-angle the zoom crops away
    const halfV = MathUtils.degToRad(baseFov.current) / 2
    const halfH = Math.atan(Math.tan(halfV) * cam.aspect)
    const cropV = halfV - Math.atan(Math.tan(halfV) / SHELF_ZOOM)
    const cropH = halfH - Math.atan(Math.tan(halfH) / SHELF_ZOOM)
    const px = MathUtils.clamp(pointerNdc.x, -1, 1)
    const py = MathUtils.clamp(pointerNdc.y, -1, 1)
    l.yaw += ((atShelf ? -px * cropH : 0) - l.yaw) * k
    l.pitch += ((atShelf ? py * cropV : 0) - l.pitch) * k
    const fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(halfV) / l.zoom))
    if (Math.abs(cam.fov - fov) > 1e-4) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    cam.position.set(x, EYE_HEIGHT, z)
    cam.rotation.set(CAMERA_PITCH + l.pitch, yaw + l.yaw, 0, 'YXZ')
  })

  return (
    <group ref={ref}>
      <PerspectiveCamera ref={camRef} makeDefault name="playerCamera" fov={CAMERA_VFOV} near={0.05} far={50} />
    </group>
  )
}
