import { create } from 'zustand'
import { ALL_SLOT_IDS } from '../data/storeLayout'
import { TAPES } from '../data/tapes'

export type SoundMode = 'all' | 'muteMusic' | 'muteAll'

export const MAX_CARRIED = 5

export interface HudMessage {
  text: string
  at: number
}

// What the pointer is over: kind is the object's name ('tape', 'slot', ...)
export interface Hovered {
  kind: string
  label: string
}

export interface GameState {
  soundMode: SoundMode
  cycleSoundMode: () => void
  lights: Record<string, boolean>
  scene: 'menu' | 'game'
  hovered: Hovered | null
  message: HudMessage | null
  // slot id -> tape id (or null when empty)
  slots: Record<string, string | null>
  // tapes in your hands, bottom first; only the last one can be put down
  carried: string[]
  setScene: (scene: 'menu' | 'game') => void
  resetGame: () => void
  toggleLight: (id: string) => void
  setHovered: (hovered: Hovered | null) => void
  showMessage: (text: string) => void
  pickUp: (slotId: string) => void
  putDown: (slotId: string) => void
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

// Small seeded RNG so the starting mess is the same every run
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Scatter every tape into a random slot, with no regard for genre
function initialSlots() {
  const rand = mulberry32(1987)
  const ids = [...ALL_SLOT_IDS]
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  const slots: Record<string, string | null> = {}
  for (const id of ALL_SLOT_IDS) slots[id] = null
  TAPES.forEach((tape, i) => (slots[ids[i]] = tape.id))
  return slots
}

const freshState = () => ({
  lights: {},
  scene: 'menu' as 'menu' | 'game',
  soundMode: loadSoundMode(),
  hovered: null,
  message: null,
  slots: initialSlots(),
  carried: [] as string[],
})

export const useGameStore = create<GameState>((set, get) => ({
  ...freshState(),
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
  resetGame: () => set(freshState()),
  toggleLight: (id: string) => {
    const state = get()
    if (state.lights[id]) {
      set((s) => ({ lights: { ...s.lights, [id]: false } }))
      return
    }
    set((s) => ({ lights: { ...s.lights, [id]: true } }))
  },
  setHovered: (hovered) => set({ hovered }),
  showMessage: (text) => set({ message: { text, at: performance.now() } }),
  pickUp: (slotId) => {
    const { slots, carried, showMessage } = get()
    const tapeId = slots[slotId]
    if (!tapeId) return
    if (carried.length >= MAX_CARRIED) {
      showMessage(`Your hands are full (${MAX_CARRIED} tapes)`)
      return
    }
    set({
      slots: { ...slots, [slotId]: null },
      carried: [...carried, tapeId],
    })
  },
  putDown: (slotId) => {
    const { slots, carried, showMessage } = get()
    if (slots[slotId]) return
    const tapeId = carried[carried.length - 1]
    if (!tapeId) {
      showMessage('You are not carrying any tapes')
      return
    }
    set({
      slots: { ...slots, [slotId]: tapeId },
      carried: carried.slice(0, -1),
    })
  },
}))

export default useGameStore
