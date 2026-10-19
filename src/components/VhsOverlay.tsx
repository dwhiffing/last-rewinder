import { useEffect, useState } from 'react'

// VHS look over the 3D view: scanlines, grain, a rolling tracking band and a
// soft vignette. Pure CSS so it costs nothing on the GPU. V toggles it.
// Used over both the menu and the game.
export function VhsOverlay({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'v' && !e.repeat) setOn((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!on) return null
  return (
    <div className={`vhs ${className}`} aria-hidden>
      <div className="vhs-noise" />
      <div className="vhs-scanlines" />
      <div className="vhs-tracking" />
      <div className="vhs-vignette" />
    </div>
  )
}

export default VhsOverlay
