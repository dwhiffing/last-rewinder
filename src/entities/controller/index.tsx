import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useWorld } from 'koota/react'
import { useEffect, useRef } from 'react'
import useGameStore from '../../stores/gameStore'
import { MathUtils, type Object3D, type PerspectiveCamera as Cam } from 'three'
import {
  CAMERA_PITCH,
  CAMERA_VFOV,
  EYE_HEIGHT,
  SHELF_WIDTH,
  VIEW_DISTANCE,
} from '../../data/storeLayout'
import { Mesh } from '../../shared/traits'
import { sampleNav } from './nav'
import { isZoomHeld, pointerNdc } from './system'
import { Controllable, NearestItem } from './traits'

// Horizontal half-angle needed to fit a whole shelf (plus a little margin)
const SHELF_HALF_ANGLE = Math.atan((SHELF_WIDTH / 2 + 0.02) / VIEW_DISTANCE)

// The view is zoomed in a little, and the pointer pivots the camera past the
// cropped edges so you can look around from any spot
const ZOOM = 1.875
// The view normally sits at a lighter zoom; holding the right mouse button
// eases in to the full ZOOM for a closer look
const NORMAL_ZOOM = Math.max(1, ZOOM * 0.693)
const ZOOM_EASE = 14
const PIVOT = 1.936
const EASE = 6

// First person camera locked to the navigation nodes
export function Controller() {
  const world = useWorld()
  const ref = useRef<Object3D>(null)
  const camRef = useRef<Cam>(null)
  const size = useThree((s) => s.size)
  const baseFov = useRef(CAMERA_VFOV)
  const look = useRef({ yaw: 0, pitch: 0 })
  const zoom = useRef(NORMAL_ZOOM)

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
    const l = look.current
    const k = 1 - Math.exp(-EASE * dt)
    const zoomTarget = isZoomHeld() ? ZOOM : NORMAL_ZOOM
    zoom.current += (zoomTarget - zoom.current) * (1 - Math.exp(-ZOOM_EASE * dt))
    const z0 = zoom.current
    // how much of each half-angle the zoom crops away
    const halfV = MathUtils.degToRad(baseFov.current) / 2
    const halfH = Math.atan(Math.tan(halfV) * cam.aspect)
    // the look-around range comes from the normal zoom, so zooming in only
    // narrows the view and never swings where the camera's pointing
    const cropV = halfV - Math.atan(Math.tan(halfV) / NORMAL_ZOOM)
    const cropH = halfH - Math.atan(Math.tan(halfH) / NORMAL_ZOOM)
    // the view holds still while the order computer is up
    if (!useGameStore.getState().computerOpen) {
      const px = MathUtils.clamp(pointerNdc.x, -1, 1)
      const py = MathUtils.clamp(pointerNdc.y, -1, 1)
      l.yaw += (-px * cropH * PIVOT - l.yaw) * k
      l.pitch += (py * cropV * PIVOT - l.pitch) * k
    }
    const fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(halfV) / z0))
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
