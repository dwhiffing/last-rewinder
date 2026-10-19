import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'

// Flat text sign drawn to a canvas texture (no font loading needed)
export function Label({
  text,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 0.5,
  height = 0.1,
  color = '#fff',
  background = '#1d3fbf',
  glow = false,
}: {
  text: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  width?: number
  height?: number
  color?: string
  background?: string
  // screens give off their own light; signs are lit by the room
  glow?: boolean
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round((512 * height) / width)
    const g = canvas.getContext('2d')!
    g.fillStyle = background
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.fillStyle = color
    g.font = `bold ${Math.round(canvas.height * 0.6)}px sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * 0.92)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    return tex
  }, [text, width, height, color, background])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={position} rotation={rotation} receiveShadow>
      <planeGeometry args={[width, height]} />
      {glow ? (
        <meshBasicMaterial map={texture} toneMapped={false} />
      ) : (
        <meshStandardMaterial map={texture} roughness={0.6} />
      )}
    </mesh>
  )
}

export default Label
