import { useMemo } from 'react'
import { SRGBColorSpace, TextureLoader } from 'three'
import commandoKitchen from '../../assets/poster-commando-kitchen.webp'
import littleRobot from '../../assets/poster-little-robot.webp'
import totalRewind from '../../assets/poster-total-rewind.webp'

const POSTER_ART: Record<string, { url: string; aspect: number }> = {
  'total-rewind': { url: totalRewind, aspect: 700 / 1024 },
  'commando-kitchen': { url: commandoKitchen, aspect: 667 / 1001 },
  'little-robot': { url: littleRobot, aspect: 691 / 1024 },
}

const HEIGHT = 1.056

// A movie poster pinned flat to a wall, facing local +z
export function Poster({
  id,
  position,
  rotation,
  tilt = 0,
}: {
  id: string
  position: [number, number, number]
  rotation: [number, number, number]
  // turn within the wall's plane, in radians
  tilt?: number
}) {
  const { url, aspect } = POSTER_ART[id]
  const map = useMemo(() => {
    const tex = new TextureLoader().load(url)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }, [url])
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[0, 0, tilt]} receiveShadow>
        <planeGeometry args={[HEIGHT * aspect, HEIGHT]} />
        <meshStandardMaterial map={map} roughness={0.7} />
      </mesh>
    </group>
  )
}

export default Poster
