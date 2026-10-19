import { useEffect, useState } from 'react'
import {
  cycleMusicVariant,
  getMusicVariant,
  MUSIC_VARIANTS,
  onMusicVariantChange,
  startMusic,
} from '../entities/ambience'

// Prototype helper: cycles between the background music versions
export function MusicButton({ className = '' }: { className?: string }) {
  const [variant, setVariant] = useState(getMusicVariant)
  useEffect(() => onMusicVariantChange(() => setVariant(getMusicVariant())), [])
  return (
    <button
      className={className}
      onClick={(e) => {
        // on the menu, a click anywhere else starts the game
        e.stopPropagation()
        startMusic()
        cycleMusicVariant()
      }}>
      Music {variant + 1}/{MUSIC_VARIANTS.length}: {MUSIC_VARIANTS[variant].name}
    </button>
  )
}

export default MusicButton
