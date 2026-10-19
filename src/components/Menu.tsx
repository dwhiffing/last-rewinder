import React, { useEffect } from 'react'
import titleTape from '../assets/title-tape.webp'
import { VhsOverlay } from './VhsOverlay'
import useGameStore from '../stores/gameStore'
import { startMusic } from '../entities/ambience'
import { MusicButton } from './MusicButton'

export function Menu() {
  const setScene = useGameStore((s) => s.setScene)

  useEffect(() => {
    const onInteract = () => {
      startMusic()
      window.removeEventListener('pointerdown', onInteract)
      window.removeEventListener('keydown', onInteract)
    }
    window.addEventListener('pointerdown', onInteract)
    window.addEventListener('keydown', onInteract)
    return () => {
      window.removeEventListener('pointerdown', onInteract)
      window.removeEventListener('keydown', onInteract)
    }
  }, [])

  return (
    <div className="menu menu-retro" onClick={() => setScene('game')}>
      <img className="title-tape" src={titleTape} alt="The Last Rewinder" draggable={false} />
      <button className="menu-start">Start Game</button>
      <MusicButton className="menu-music" />
      <VhsOverlay className="vhs-menu" />
    </div>
  )
}

export default Menu
