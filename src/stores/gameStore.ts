import { create } from 'zustand'

export type SoundMode = 'all' | 'muteMusic' | 'muteAll'

export interface Interaction {
  label: string
  at: number
}

export interface GameState {
  soundMode: SoundMode
  cycleSoundMode: () => void
  lights: Record<string, boolean>
  scene: 'menu' | 'game'
  // Label of the interactable the player is currently looking at
  lookingAt: string | null
  lastInteraction: Interaction | null
  setScene: (scene: 'menu' | 'game') => void
  resetGame: () => void
  toggleLight: (id: string) => void
  setLookingAt: (label: string | null) => void
  interact: (label: string) => void
}

const SOUND_MODE_KEY = 'soundMode'
const SOUND_MODES: SoundMode[] = ['all', 'muteMusic', 'muteAll']

function loadSoundMode(): SoundMode {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(SOUND_MODE_KEY)
  } catch {
    // storage can be blocked (private mode, sandboxed iframes)
  }
  return (
    SOUND_MODES.includes(stored as SoundMode) ? stored : 'all'
  ) as SoundMode
}

export const initialState = {
  lights: {},
  scene: 'menu' as 'menu' | 'game',
  soundMode: loadSoundMode(),
  lookingAt: null,
  lastInteraction: null,
}

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,
  cycleSoundMode: () => {
    const current = get().soundMode
    const next =
      SOUND_MODES[(SOUND_MODES.indexOf(current) + 1) % SOUND_MODES.length]
    try {
      localStorage.setItem(SOUND_MODE_KEY, next)
    } catch {}
    set({ soundMode: next })
  },
  setScene: (scene: 'menu' | 'game') => set(() => ({ scene })),
  resetGame: () => set(() => initialState),
  toggleLight: (id: string) => {
    const state = get()
    if (state.lights[id]) {
      set((s) => ({ lights: { ...s.lights, [id]: false } }))
      return
    }
    set((s) => ({ lights: { ...s.lights, [id]: true } }))
  },
  setLookingAt: (label: string | null) => set({ lookingAt: label }),
  interact: (label: string) =>
    set({ lastInteraction: { label, at: performance.now() } }),
}))

export default useGameStore
