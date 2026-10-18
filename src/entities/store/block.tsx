import { type ReactNode } from 'react'

// Solid placeholder box
export function Block({
  size,
  position = [0, 0, 0],
  color = '#888',
  emissive,
  name,
  userData,
  children,
}: {
  size: [number, number, number]
  position?: [number, number, number]
  color?: string
  emissive?: string
  name?: string
  userData?: Record<string, unknown>
  children?: ReactNode
}) {
  return (
    <mesh
      castShadow
      receiveShadow
      position={position}
      name={name}
      userData={userData}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.9}
        emissive={emissive ?? '#000'}
        emissiveIntensity={emissive ? 1 : 0}
      />
      {children}
    </mesh>
  )
}

export default Block
