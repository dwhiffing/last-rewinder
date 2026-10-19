import { useMemo } from 'react'
import { DoubleSide, Shape, SRGBColorSpace, TextureLoader } from 'three'
import maskUrl from '../../assets/standee-mask.webp'
import artUrl from '../../assets/standee.webp'

const HEIGHT = 1.75
const WIDTH = HEIGHT * (663 / 951)
const LEAN = (10 * Math.PI) / 180
const CARDBOARD = '#a88a5e'

// The brace: a cardboard triangle from the floor up to the middle of the
// standee's back, drawn in (z, y) with z running backwards
const BRACE_TOP = HEIGHT * 0.4
const braceShape = new Shape()
braceShape.moveTo(-0.02, 0)
braceShape.lineTo(-0.45, 0)
braceShape.lineTo(-Math.sin(LEAN) * BRACE_TOP, Math.cos(LEAN) * BRACE_TOP)
braceShape.closePath()

// Cardboard cutout of a movie poster, leaning back on a brace. It faces +z.
export function Standee({ position }: { position: [number, number, number] }) {
  const [art, mask] = useMemo(() => {
    const loader = new TextureLoader()
    const art = loader.load(artUrl)
    art.colorSpace = SRGBColorSpace
    art.anisotropy = 8
    return [art, loader.load(maskUrl)]
  }, [])
  return (
    <group position={position}>
      {/* the cutout, pivoting at its base */}
      <group rotation={[-LEAN, 0, 0]}>
        <mesh position={[0, HEIGHT / 2, 0]} receiveShadow>
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshStandardMaterial map={art} alphaTest={0.5} roughness={0.8} />
        </mesh>
        {/* plain cardboard on the back */}
        <mesh position={[0, HEIGHT / 2, -0.004]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshStandardMaterial color={CARDBOARD} alphaMap={mask} alphaTest={0.5} roughness={0.9} />
        </mesh>
      </group>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[0.006, 0, 0]}>
        <extrudeGeometry args={[braceShape, { depth: 0.012, bevelEnabled: false }]} />
        <meshStandardMaterial color={CARDBOARD} roughness={0.9} side={DoubleSide} />
      </mesh>
    </group>
  )
}

export default Standee
