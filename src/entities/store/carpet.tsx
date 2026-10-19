import { useMemo } from 'react'
import { RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2 } from 'three'
import colorUrl from '../../assets/carpet-color.webp'
import normalUrl from '../../assets/carpet-normal.webp'
import roughnessUrl from '../../assets/carpet-roughness.webp'

// Metres of floor covered by one tile of the carpet texture
const TILE = 1.5

// Textured carpet laid just above the floor slab
export function Carpet({ width, depth, z }: { width: number; depth: number; z: number }) {
  const [map, normalMap, roughnessMap] = useMemo(() => {
    const loader = new TextureLoader()
    return [colorUrl, normalUrl, roughnessUrl].map((url, i) => {
      const tex = loader.load(url)
      tex.wrapS = tex.wrapT = RepeatWrapping
      tex.repeat.set(width / TILE, depth / TILE)
      tex.anisotropy = 8
      if (i === 0) tex.colorSpace = SRGBColorSpace
      return tex
    })
  }, [width, depth])

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, z]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial
        map={map}
        normalMap={normalMap}
        normalScale={new Vector2(1, 1)}
        roughnessMap={roughnessMap}
      />
    </mesh>
  )
}

export default Carpet
