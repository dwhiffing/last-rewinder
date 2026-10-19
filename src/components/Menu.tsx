import React, { useEffect } from 'react'
import titleTape from '../assets/title-tape.webp'
import { VhsOverlay } from './VhsOverlay'
import useGameStore from '../stores/gameStore'
import { startMusic } from '../entities/ambience'

export function Menu() {
  const setScene = useGameStore((s) => s.setScene)

  // Start the music as soon as the browser allows: right away if it can,
  // otherwise on the first key or click
  useEffect(() => {
    startMusic()
    window.addEventListener('keydown', startMusic)
    window.addEventListener('pointerdown', startMusic)
    return () => {
      window.removeEventListener('keydown', startMusic)
      window.removeEventListener('pointerdown', startMusic)
    }
  }, [])

  return (
    <div className="menu menu-retro" onClick={() => setScene('game')}>
      <img className="title-tape" src={titleTape} alt="The Last Rewinder" draggable={false} />
      <button className="menu-start">Start Game</button>
      <VhsOverlay className="vhs-menu" />
    </div>
  )
}

export default Menu
