import React, { useEffect, useState } from 'react'
import titleTape from '../assets/title-tape.webp'
import { VhsOverlay } from './VhsOverlay'
import useGameStore from '../stores/gameStore'
import { musicUnlocked, onMusicUnlock, startMusic } from '../entities/ambience'

export function Menu() {
  const setScene = useGameStore((s) => s.setScene)

  // Start the music as soon as the browser allows. If audio is still locked,
  // the first click or key on the title only turns the sound on, so the
  // music plays here before the game starts.
  const [unlocked, setUnlocked] = useState(musicUnlocked)
  useEffect(() => {
    startMusic()
    const off = onMusicUnlock(() => setUnlocked(true))
    const onKey = () => startMusic()
    window.addEventListener('keydown', onKey)
    return () => {
      off()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const onClick = () => {
    if (!musicUnlocked()) startMusic()
    else setScene('game')
  }

  return (
    <div className="menu menu-retro" onClick={onClick}>
      <img className="title-tape" src={titleTape} alt="The Last Rewinder" draggable={false} />
      <button className="menu-start">{unlocked ? 'Start Game' : 'Click for Sound'}</button>
      <VhsOverlay className="vhs-menu" />
    </div>
  )
}

export default Menu
