import { RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import colaUrl from '../../assets/cola.webp'

// A soda can. The texture holds the lid and base as two circles across the
// top half, and the label wrap across the bottom half.
export const CAN_HEIGHT = 0.15
export const CAN_RADIUS = 0.038

const loader = new TextureLoader()
function region(repeatX: number, repeatY: number, offsetX: number, offsetY: number) {
  const tex = loader.load(colaUrl)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  tex.wrapS = RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.offset.set(offsetX, offsetY)
  return tex
}
// the wrap is shifted so the big block SODA logo faces out (+z)
const SIDE = region(1, 0.5, 0.47, 0)
const LID = region(0.46, 0.46, 0.02, 0.52)
const BASE = region(0.46, 0.46, 0.52, 0.52)

export { colaUrl }

export function SodaCan({
  position,
  name,
  userData,
}: {
  position: [number, number, number]
  name?: string
  userData?: Record<string, unknown>
}) {
  return (
    <mesh name={name} userData={userData} position={position} receiveShadow>
      <cylinderGeometry args={[CAN_RADIUS, CAN_RADIUS, CAN_HEIGHT, 24]} />
      {/* cylinder groups: 0 side, 1 top, 2 bottom */}
      <meshStandardMaterial attach="material-0" map={SIDE} metalness={0.4} roughness={0.35} />
      <meshStandardMaterial attach="material-1" map={LID} metalness={0.6} roughness={0.3} />
      <meshStandardMaterial attach="material-2" map={BASE} metalness={0.6} roughness={0.3} />
    </mesh>
  )
}

export default SodaCan
