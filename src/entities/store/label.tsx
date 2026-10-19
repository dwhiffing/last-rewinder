import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import scuffsUrl from '../../assets/scuffs-color.jpg'

// Wear multiplied over printed signs, loaded once for all of them
const scuffs = new Image()
scuffs.src = scuffsUrl
// metres of sign one copy of the scuff image covers
const SCUFF_TILE = 1.5

// Flat text sign drawn to a canvas texture. Store marquees use the ITC Machine
// face, redrawn once it has loaded.
const MARQUEE_CHECK = 'bold 32px "ITC Machine"'

export function Label({
  text,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 0.5,
  height = 0.1,
  color = '#fff',
  background = '#1d3fbf',
  glow = false,
  align = 'center',
  marquee = false,
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
  align?: 'center' | 'left'
  marquee?: boolean
}) {
  const fontSpec = marquee ? '"ITC Machine", sans-serif' : 'sans-serif'
  const [fontReady, setFontReady] = useState(() => !marquee || document.fonts.check(MARQUEE_CHECK))
  useEffect(() => {
    if (!fontReady) document.fonts.load(MARQUEE_CHECK).then(() => setFontReady(true))
  }, [fontReady])
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round((512 * height) / width)
    const g = canvas.getContext('2d')!
    g.fillStyle = background
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.fillStyle = color
    g.font = `bold ${Math.round(canvas.height * (marquee ? 0.72 : 0.6))}px ${fontSpec}`
    g.textAlign = align
    g.textBaseline = 'middle'
    const x = align === 'left' ? canvas.width * 0.04 : canvas.width / 2
    g.fillText(text, x, canvas.height / 2, canvas.width * 0.92)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    if (!glow) {
      const wear = () => {
        const pattern = g.createPattern(scuffs, 'repeat')!
        const scale = canvas.width / width / scuffs.width * SCUFF_TILE
        pattern.setTransform(new DOMMatrix().scale(scale))
        g.globalCompositeOperation = 'multiply'
        g.fillStyle = pattern
        g.fillRect(0, 0, canvas.width, canvas.height)
        tex.needsUpdate = true
      }
      if (scuffs.complete && scuffs.naturalWidth) wear()
      else scuffs.addEventListener('load', wear, { once: true })
    }
    return tex
  }, [text, width, height, color, background, glow, align, fontSpec, fontReady])

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
