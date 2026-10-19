import { type ReactNode, useMemo } from 'react'
import { scaledBoxGeometry, type TextureSet } from './textures'

// Solid placeholder box, optionally covered in a texture set
export function Block({
  size,
  position = [0, 0, 0],
  color = '#888',
  emissive,
  textures,
  alignUv,
  name,
  userData,
  children,
}: {
  size: [number, number, number]
  position?: [number, number, number]
  color?: string
  emissive?: string
  textures?: TextureSet
  // line the texture up with neighbouring blocks (by world position)
  alignUv?: boolean
  name?: string
  userData?: Record<string, unknown>
  children?: ReactNode
}) {
  const geometry = useMemo(
    () => (textures ? scaledBoxGeometry(size, textures.tile, alignUv ? position : undefined) : null),
    [textures, alignUv, ...size, ...position],
  )
  return (
    <mesh
      castShadow
      receiveShadow
      position={position}
      name={name}
      userData={userData}
      geometry={geometry ?? undefined}>
      {!geometry && <boxGeometry args={size} />}
      <meshStandardMaterial
        color={color}
        roughness={textures ? 1 : 0.9}
        map={textures?.map}
        normalMap={textures?.normalMap}
        roughnessMap={textures?.roughnessMap}
        emissive={emissive ?? '#000'}
        emissiveIntensity={emissive ? 1 : 0}
      />
      {children}
    </mesh>
  )
}

export default Block
