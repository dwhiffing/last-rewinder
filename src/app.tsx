import React, { useEffect, useRef, useState } from 'react'
import Game from './components/Game'
import Menu from './components/Menu'
import { setMusicMuted, startMusic } from './entities/ambience'
import { blockInputFor } from './entities/controller/system'
import { playGameStart, setSfxMuted } from './entities/sounds'
import useGameStore from './stores/gameStore'
import './index.css'

// Apply persisted sound mode on load
{
  const mode = useGameStore.getState().soundMode
  setMusicMuted(mode === 'muteMusic' || mode === 'muteAll')
  setSfxMuted(mode === 'muteAll')
}

export function App() {
  const targetScene = useGameStore((s) => s.scene)
  const [currentScene, setCurrentScene] = useState<'menu' | 'game'>(targetScene)
  const [isFading, setIsFading] = useState(false)
  // true for the whole transition, including fading back in, so nothing can
  // be clicked or pressed until the new scene is fully showing
  const [isBlocking, setIsBlocking] = useState(false)
  const FADE_DURATION = 900
  const lastTarget = useRef(targetScene)

  useEffect(() => {
    if (targetScene === lastTarget.current) return
    lastTarget.current = targetScene

    setIsFading(true)
    setIsBlocking(true)
    blockInputFor(FADE_DURATION * 3)
    const unblock = window.setTimeout(() => setIsBlocking(false), FADE_DURATION * 3)
    // The music runs across the menu and the game
    startMusic()
    if (targetScene === 'game') playGameStart()

    const toBlack = window.setTimeout(() => {
      setCurrentScene(targetScene)

      const back = window.setTimeout(() => {
        setIsFading(false)
      }, FADE_DURATION)

      return () => window.clearTimeout(back)
    }, FADE_DURATION)

    return () => {
      window.clearTimeout(toBlack)
      window.clearTimeout(unblock)
    }
  }, [targetScene])

  return (
    <div className="app-root">
      {currentScene === 'menu' && <Menu />}

      <Game />

      <div
        className={`scene-fade ${isFading ? 'visible' : ''} ${isBlocking ? 'blocking' : ''}`}
        aria-hidden
        style={{ transitionDuration: `${FADE_DURATION}ms` }}
      />
    </div>
  )
}
