import React, { useEffect } from 'react'
import useGameStore from '../stores/gameStore'
import { startMenuHowl } from '../entities/ambience'

export function Menu() {
  const setScene = useGameStore((s) => s.setScene)

  useEffect(() => {
    const onInteract = () => {
      startMenuHowl()
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
      {/* yellow torn-ticket title in the style of a 90s video store sign */}
      <div className="title-ticket">
        <span className="title-small">THE LAST</span>
        <span className="title-big">REWINDER</span>
      </div>
      <div className="menu-tagline">Be kind. Rewind.</div>
      <button className="menu-start">Start Game</button>
    </div>
  )
}

export default Menu
