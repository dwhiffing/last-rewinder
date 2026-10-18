import { create } from 'zustand'
import { ALL_SLOT_IDS } from '../data/storeLayout'
import { generateOrder, matches, type Order } from '../data/orders'
import { mulberry32 } from '../data/random'
import { TAPES, tapeById } from '../data/tapes'
import { playCash, playError, playInteract, playOrderIn } from '../entities/sounds'

export type SoundMode = 'all' | 'muteMusic' | 'muteAll'

export const MAX_CARRIED = 5
export const MAX_ORDERS = 5
const FIRST_ORDER_AT = 3
const ORDER_GAP: [number, number] = [12, 20]

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
  money: number
  // seconds of play, paused outside the game scene
  time: number
  orders: Order[]
  nextOrderAt: number
  nextOrderId: number
  ordersFilled: number
  computerOpen: boolean
  // the top tape's card shows its back
  coverFlipped: boolean
  setScene: (scene: 'menu' | 'game') => void
  resetGame: () => void
  toggleLight: (id: string) => void
  setHovered: (hovered: Hovered | null) => void
  showMessage: (text: string) => void
  pickUp: (slotId: string) => void
  putDown: (slotId: string) => void
  tick: (delta: number) => void
  handIn: (orderId: number) => void
  setComputerOpen: (open: boolean) => void
  flipCover: () => void
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

let orderRand = mulberry32(Date.now())

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
  money: 0,
  time: 0,
  orders: [] as Order[],
  nextOrderAt: FIRST_ORDER_AT,
  nextOrderId: 1,
  ordersFilled: 0,
  computerOpen: false,
  coverFlipped: false,
})

// Tapes in the store (shelved or carried) that no open order is after
function availableTapes(s: GameState) {
  const reserved = new Set(s.orders.flatMap((o) => o.items.map((i) => i.target)))
  const inStore = [...Object.values(s.slots), ...s.carried].filter(Boolean) as string[]
  return inStore.filter((id) => !reserved.has(id))
}

const formatMoney = (n: number) => `$${n}`

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
  resetGame: () => {
    orderRand = mulberry32(Date.now())
    set(freshState())
  },
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
      coverFlipped: false,
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
      coverFlipped: false,
    })
  },
  tick: (delta) => {
    const s = get()
    const time = s.time + delta
    const expired = s.orders.filter((o) => o.expiresAt <= time)
    let orders = expired.length ? s.orders.filter((o) => o.expiresAt > time) : s.orders
    let { nextOrderAt, nextOrderId } = s
    const patch: Partial<GameState> = { time }

    if (expired.length) {
      patch.message = { text: `An order ran out of time`, at: performance.now() }
    }
    if (time >= nextOrderAt) {
      const gap = ORDER_GAP[0] + orderRand() * (ORDER_GAP[1] - ORDER_GAP[0])
      if (orders.length < MAX_ORDERS) {
        const order = generateOrder(
          orderRand,
          nextOrderId,
          time,
          availableTapes({ ...s, orders }),
          s.ordersFilled,
        )
        if (order) {
          orders = [...orders, order]
          nextOrderId++
          playOrderIn()
          patch.message = { text: 'New order on the computer', at: performance.now() }
        }
      }
      // An empty queue fills up again quickly
      nextOrderAt = time + (orders.length === 0 ? 4 : gap)
    }
    if (orders !== s.orders) patch.orders = orders
    if (nextOrderAt !== s.nextOrderAt) Object.assign(patch, { nextOrderAt, nextOrderId })
    set(patch)
  },
  handIn: (orderId) => {
    const s = get()
    const order = s.orders.find((o) => o.id === orderId)
    const top = s.carried[s.carried.length - 1]
    if (!order) return
    if (!top) {
      playError()
      s.showMessage('Carry the tape you want to hand in')
      return
    }
    const tape = tapeById(top)
    const itemIndex = order.items.findIndex((i) => !i.filled && matches(tape, i.criteria))
    if (itemIndex < 0) {
      playError()
      s.showMessage(`${tape.title} doesn't fit that order`)
      return
    }
    const items = order.items.map((item, i) => (i === itemIndex ? { ...item, filled: top } : item))
    const carried = s.carried.slice(0, -1)
    if (items.every((i) => i.filled)) {
      playCash()
      set({
        carried,
        coverFlipped: false,
        orders: s.orders.filter((o) => o.id !== orderId),
        money: s.money + order.reward,
        ordersFilled: s.ordersFilled + 1,
        message: { text: `Order filled! +${formatMoney(order.reward)}`, at: performance.now() },
      })
    } else {
      playInteract()
      set({
        carried,
        coverFlipped: false,
        orders: s.orders.map((o) => (o.id === orderId ? { ...o, items } : o)),
      })
    }
  },
  setComputerOpen: (computerOpen) => set({ computerOpen }),
  flipCover: () => set((s) => ({ coverFlipped: !s.coverFlipped })),
}))

export default useGameStore

// Handy for poking at state from the browser console while prototyping
if (typeof window !== 'undefined') (window as any).__game = useGameStore
