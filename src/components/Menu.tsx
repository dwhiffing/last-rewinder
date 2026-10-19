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
    <div
      className="menu"
      onClick={() => setScene('game')}
      style={{ cursor: 'pointer' }}>
      <h1 style={{ fontSize: 48, marginBottom: 24 }}>The Last Rewinder</h1>
      <button
        style={{ fontSize: 18, padding: '12px 24px', pointerEvents: 'none' }}>
        Start Game
      </button>
    </div>
  )
}

export default Menu
