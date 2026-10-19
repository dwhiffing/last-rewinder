import { useEffect, useRef } from 'react'
import useGameStore from '../stores/gameStore'

// VHS look over the 3D view: scanlines, grain, a rolling tracking band, a
// soft vignette, glitches from a worn tape and the curved edge of a tube TV.
// V toggles it (the 3D view's barrel warp lives in CrtWarp). Used over both
// the menu and the game.
// One listener for the whole app; the menu and game each have an overlay
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'v' && !e.repeat) useGameStore.getState().toggleVhs()
  })
}

export function VhsOverlay({ className = '' }: { className?: string }) {
  const on = useGameStore((s) => s.vhsOn)
  if (!on) return null
  return (
    <div className={`vhs ${className}`} aria-hidden>
      <div className="vhs-noise" />
      <div className="vhs-scanlines" />
      <div className="vhs-tracking" />
      <TapeArtefacts />
      <div className="vhs-vignette" />
      {/* rounded, shadowed edge of a tube TV screen */}
      <div className="vhs-tube" />
    </div>
  )
}

// Wear and tear drawn on a low-res canvas: now and then a band of static
// where the picture tears sideways for a few frames
const RES = 4 // canvas pixels are this many screen pixels
function TapeArtefacts() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return
    const resize = () => {
      canvas.width = Math.ceil(window.innerWidth / RES)
      canvas.height = Math.ceil(window.innerHeight / RES)
    }
    resize()
    window.addEventListener('resize', resize)

    // Glitches that last a few frames
    let tear: { y: number; h: number; life: number } | null = null
    let frame = 0
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      // ~30fps is plenty and looks more like video
      if (frame++ % 2) return
      const { width: w, height: h } = canvas
      g.clearRect(0, 0, w, h)

      if (!tear && Math.random() < 0.0018) {
        tear = { y: Math.random() * h, h: 2 + Math.random() * h * 0.06, life: 3 + Math.floor(Math.random() * 6) }
      }

      if (tear) {
        // a band of grainy static, with a few brighter shifted lines
        const top = Math.floor(tear.y)
        for (let y = top; y < top + tear.h; y++) {
          for (let x = 0; x < w; x += 1 + Math.floor(Math.random() * 3)) {
            const v = Math.random()
            if (v < 0.5) continue
            g.fillStyle = `rgba(255,255,255,${(v - 0.5) * 0.5})`
            g.fillRect(x, y, 1, 1)
          }
        }
        g.fillStyle = 'rgba(0,0,0,0.25)'
        g.fillRect(0, top, w * Math.random() * 0.3, tear.h)
        tear.y += (Math.random() - 0.3) * 2
        if (--tear.life <= 0) tear = null
      }
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={ref} className="vhs-artefacts" />
}

export default VhsOverlay
