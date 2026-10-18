import { PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useWorld } from 'koota/react'
import { useEffect, useRef } from 'react'
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
import { Controllable, NearestItem } from './traits'

// Horizontal half-angle needed to fit a whole shelf (plus a little margin)
const SHELF_HALF_ANGLE = Math.atan((SHELF_WIDTH / 2 + 0.15) / VIEW_DISTANCE)

// First person camera locked to the navigation nodes
export function Controller() {
  const world = useWorld()
  const ref = useRef<Object3D>(null)
  const camRef = useRef<Cam>(null)
  const size = useThree((s) => s.size)

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
    cam.fov = Math.max(CAMERA_VFOV, MathUtils.radToDeg(needed))
    cam.updateProjectionMatrix()
  }, [size])

  useFrame(() => {
    const cam = camRef.current
    if (!cam) return
    const { x, z, yaw } = sampleNav(performance.now())
    cam.position.set(x, EYE_HEIGHT, z)
    cam.rotation.set(CAMERA_PITCH, yaw, 0, 'YXZ')
  })

  return (
    <group ref={ref}>
      <PerspectiveCamera ref={camRef} makeDefault name="playerCamera" fov={CAMERA_VFOV} near={0.05} far={50} />
    </group>
  )
}
