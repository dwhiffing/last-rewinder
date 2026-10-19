import { create } from 'zustand'
import { ALL_SLOT_IDS } from '../data/storeLayout'
import { daySchedule, generateOrder, matches, type Order, type ScheduledKind } from '../data/orders'
import { mulberry32, shuffle } from '../data/random'
import { TAPES, tapeById } from '../data/tapes'
import { playCash, playError, playInteract, playOrderIn } from '../entities/sounds'

export type SoundMode = 'all' | 'muteMusic' | 'muteAll'

export const MAX_CARRIED = 5
export const MAX_ORDERS = 5
const FIRST_ORDER_AT = 3
const ORDER_GAP: [number, number] = [12, 20]

// Days and stock
const STARTING_TAPES = 25
// Rented tapes come back unrewound in the return box 1 to 3 days later
const RENTAL_DAYS: [number, number] = [1, 3]
export const REWIND_SECONDS = 8

export interface HudMessage {
  text: string
  at: number
}

// What the pointer is over: kind is the object's name ('tape', 'slot', ...)
export interface Hovered {
  kind: string
  label: string
}

export interface Rewinder {
  tapeId: string
  doneAt: number
}

export interface DaySummary {
  filled: number
  missed: number
  earned: number
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
  // seconds of play, paused outside the game scene and between days
  time: number
  orders: Order[]
  nextOrderAt: number
  nextOrderId: number
  ordersFilled: number
  computerOpen: boolean
  // the top tape's card shows its back
  coverFlipped: boolean
  day: number
  // set when the day has ended and the summary is showing
  dayOver: DaySummary | null
  today: DaySummary
  // catalogue tapes the store doesn't own and hasn't ordered yet
  stockPool: string[]
  // tapes ordered in through "Not in stock"; they arrive tomorrow morning
  incoming: string[]
  // return box, bottom first; the last one is taken first
  returnBox: string[]
  // tapes that have to go through the rewinder before shelving or renting
  needsRewind: Record<string, boolean>
  rewinder: Rewinder | null
  rented: { tapeId: string; returnDay: number }[]
  // the rest of today's orders; the day ends once these and the open ones are done
  schedule: ScheduledKind[]
  setScene: (scene: 'menu' | 'game') => void
  resetGame: () => void
  toggleLight: (id: string) => void
  setHovered: (hovered: Hovered | null) => void
  showMessage: (text: string) => void
  pickUp: (slotId: string) => void
  putDown: (slotId: string) => void
  takeFromReturnBox: () => void
  useRewinder: () => void
  tick: (delta: number) => void
  handIn: (orderId: number) => void
  notInStock: (orderId: number) => void
  startNextDay: () => void
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

// The store opens with a few tapes scattered at random; the rest of the
// catalogue arrives a few at a time each morning
function initialStock() {
  const rand = mulberry32(1987)
  const catalogue = shuffle(rand, TAPES.map((t) => t.id))
  const slotIds = shuffle(rand, ALL_SLOT_IDS)
  const slots: Record<string, string | null> = {}
  for (const id of ALL_SLOT_IDS) slots[id] = null
  catalogue.slice(0, STARTING_TAPES).forEach((tapeId, i) => (slots[slotIds[i]] = tapeId))
  return { slots, stockPool: catalogue.slice(STARTING_TAPES) }
}

const emptyDay = (): DaySummary => ({ filled: 0, missed: 0, earned: 0 })

const freshState = () => ({
  lights: {},
  scene: 'menu' as 'menu' | 'game',
  soundMode: loadSoundMode(),
  hovered: null,
  message: null,
  ...initialStock(),
  carried: [] as string[],
  money: 0,
  time: 0,
  orders: [] as Order[],
  nextOrderAt: FIRST_ORDER_AT,
  nextOrderId: 1,
  ordersFilled: 0,
  computerOpen: false,
  coverFlipped: false,
  day: 1,
  dayOver: null,
  today: emptyDay(),
  returnBox: [] as string[],
  needsRewind: {} as Record<string, boolean>,
  rewinder: null,
  rented: [] as { tapeId: string; returnDay: number }[],
  schedule: daySchedule(orderRand, 1, 0),
  incoming: [] as string[],
})

// Tapes in the store that no open order is after. Unrewound ones count, since
// the player can rewind them in time.
function availableTapes(s: GameState) {
  const reserved = new Set(s.orders.flatMap((o) => o.items.map((i) => i.target)))
  const inStore = [
    ...Object.values(s.slots),
    ...s.carried,
    ...s.returnBox,
    s.rewinder?.tapeId,
  ].filter(Boolean) as string[]
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
    const { slots, carried, needsRewind, showMessage } = get()
    if (slots[slotId]) return
    const tapeId = carried[carried.length - 1]
    if (!tapeId) {
      showMessage('You are not carrying any tapes')
      return
    }
    if (needsRewind[tapeId]) {
      playError()
      showMessage(`Rewind ${tapeById(tapeId).title} before shelving it`)
      return
    }
    set({
      slots: { ...slots, [slotId]: tapeId },
      carried: carried.slice(0, -1),
      coverFlipped: false,
    })
  },
  takeFromReturnBox: () => {
    const { returnBox, carried, showMessage } = get()
    const tapeId = returnBox[returnBox.length - 1]
    if (!tapeId) {
      showMessage('The return box is empty')
      return
    }
    if (carried.length >= MAX_CARRIED) {
      showMessage(`Your hands are full (${MAX_CARRIED} tapes)`)
      return
    }
    playInteract()
    set({
      returnBox: returnBox.slice(0, -1),
      carried: [...carried, tapeId],
      coverFlipped: false,
    })
  },
  useRewinder: () => {
    const { rewinder, carried, needsRewind, time, showMessage } = get()
    if (rewinder) {
      const left = rewinder.doneAt - time
      if (left > 0) {
        showMessage(`Still rewinding (${Math.ceil(left)}s)`)
        return
      }
      // Holding a tape that needs rewinding swaps it with the finished one
      const top = carried[carried.length - 1]
      if (top && needsRewind[top]) {
        playInteract()
        const { [top]: _, ...rest } = needsRewind
        set({
          carried: [...carried.slice(0, -1), rewinder.tapeId],
          rewinder: { tapeId: top, doneAt: time + REWIND_SECONDS },
          needsRewind: rest,
          coverFlipped: false,
        })
        return
      }
      if (carried.length >= MAX_CARRIED) {
        showMessage(`Your hands are full (${MAX_CARRIED} tapes)`)
        return
      }
      playInteract()
      set({ rewinder: null, carried: [...carried, rewinder.tapeId], coverFlipped: false })
      return
    }
    const top = carried[carried.length - 1]
    if (!top) {
      showMessage('Bring a tape from the return box to rewind')
      return
    }
    if (!needsRewind[top]) {
      showMessage(`${tapeById(top).title} is already rewound`)
      return
    }
    playInteract()
    const { [top]: _, ...rest } = needsRewind
    set({
      carried: carried.slice(0, -1),
      rewinder: { tapeId: top, doneAt: time + REWIND_SECONDS },
      needsRewind: rest,
      coverFlipped: false,
    })
  },
  tick: (delta) => {
    const s = get()
    if (s.dayOver) return
    const time = s.time + delta

    // Closing time: every order for the day has been dealt with
    if (!s.schedule.length && !s.orders.length) {
      set({ time, dayOver: s.today, computerOpen: false })
      return
    }

    const wasRewinding = s.rewinder && s.rewinder.doneAt > s.time
    if (wasRewinding && s.rewinder!.doneAt <= time) {
      playInteract()
      s.showMessage(`${tapeById(s.rewinder!.tapeId).title} is rewound`)
    }

    const expired = s.orders.filter((o) => o.expiresAt <= time)
    let orders = expired.length ? s.orders.filter((o) => o.expiresAt > time) : s.orders
    let { nextOrderAt, nextOrderId } = s
    const patch: Partial<GameState> = { time }

    if (expired.length) {
      patch.message = { text: `An order ran out of time`, at: performance.now() }
      patch.today = { ...s.today, missed: s.today.missed + expired.length }
    }
    if (time >= nextOrderAt) {
      const gap = ORDER_GAP[0] + orderRand() * (ORDER_GAP[1] - ORDER_GAP[0])
      if (orders.length < MAX_ORDERS && s.schedule.length) {
        const kind = s.schedule[0]
        const reserved = new Set(orders.flatMap((o) => o.items.map((i) => i.target)))
        const order =
          kind === 'missing'
            ? generateOrder(
                orderRand,
                nextOrderId,
                time,
                s.stockPool.filter((id) => !reserved.has(id)),
                'title',
                false,
              )
            : generateOrder(
                orderRand,
                nextOrderId,
                time,
                availableTapes({ ...s, orders }),
                kind,
                s.day >= 3,
              )
        // An order that can't be made (nothing left to ask for) is skipped
        patch.schedule = s.schedule.slice(1)
        if (order) {
          if (kind === 'missing') order.missing = true
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
    if (s.needsRewind[top]) {
      playError()
      s.showMessage(`Rewind ${tape.title} before renting it out`)
      return
    }
    const itemIndex = order.items.findIndex((i) => !i.filled && matches(tape, i.criteria))
    if (itemIndex < 0) {
      playError()
      s.showMessage(`${tape.title} doesn't fit that order`)
      return
    }
    const items = order.items.map((item, i) => (i === itemIndex ? { ...item, filled: top } : item))
    const carried = s.carried.slice(0, -1)
    // The tape leaves the store and comes back to the return box later
    const rented = [...s.rented, { tapeId: top, returnDay: s.day + RENTAL_DAYS[0] + Math.floor(orderRand() * (RENTAL_DAYS[1] - RENTAL_DAYS[0] + 1)) }]
    if (items.every((i) => i.filled)) {
      playCash()
      set({
        carried,
        rented,
        coverFlipped: false,
        orders: s.orders.filter((o) => o.id !== orderId),
        money: s.money + order.reward,
        ordersFilled: s.ordersFilled + 1,
        today: {
          ...s.today,
          filled: s.today.filled + 1,
          earned: s.today.earned + order.reward,
        },
        message: { text: `Order filled! +${formatMoney(order.reward)}`, at: performance.now() },
      })
    } else {
      playInteract()
      set({
        carried,
        rented,
        coverFlipped: false,
        orders: s.orders.map((o) => (o.id === orderId ? { ...o, items } : o)),
      })
    }
  },
  // Saying a title order is out of stock: right if the store doesn't own the
  // tape (it gets ordered in for tomorrow), wrong if it does (the customer
  // leaves and the order is lost)
  notInStock: (orderId) => {
    const s = get()
    const order = s.orders.find((o) => o.id === orderId)
    if (!order || order.kind !== 'title') return
    const orders = s.orders.filter((o) => o.id !== orderId)
    if (order.missing) {
      const tapeId = order.items[0].target
      playCash()
      set({
        orders,
        money: s.money + order.reward,
        stockPool: s.stockPool.filter((id) => id !== tapeId),
        incoming: [...s.incoming, tapeId],
        today: {
          ...s.today,
          filled: s.today.filled + 1,
          earned: s.today.earned + order.reward,
        },
        message: {
          text: `Ordered ${tapeById(tapeId).title} for tomorrow. +${formatMoney(order.reward)}`,
          at: performance.now(),
        },
      })
      return
    }
    playError()
    set({
      orders,
      today: { ...s.today, missed: s.today.missed + 1 },
      message: { text: 'We do carry that one! The customer gave up', at: performance.now() },
    })
  },
  // Morning: rentals that are due come back unrewound, and tapes ordered
  // yesterday arrive in the return box already rewound
  startNextDay: () => {
    const s = get()
    const day = s.day + 1
    const due = s.rented.filter((r) => r.returnDay <= day).map((r) => r.tapeId)
    const arrivals = s.incoming
    const needsRewind = { ...s.needsRewind }
    for (const id of due) needsRewind[id] = true
    set({
      day,
      dayOver: null,
      schedule: daySchedule(orderRand, day, s.stockPool.length),
      today: emptyDay(),
      nextOrderAt: s.time + FIRST_ORDER_AT,
      rented: s.rented.filter((r) => r.returnDay > day),
      incoming: [],
      returnBox: [...s.returnBox, ...arrivals, ...shuffle(orderRand, due)],
      needsRewind,
      message: {
        text: `${arrivals.length} new tape${arrivals.length === 1 ? '' : 's'} and ${due.length} return${due.length === 1 ? '' : 's'} in the return box`,
        at: performance.now(),
      },
    })
  },
  setComputerOpen: (computerOpen) => set({ computerOpen }),
  flipCover: () => set((s) => ({ coverFlipped: !s.coverFlipped })),
}))

export default useGameStore

// Handy for poking at state from the browser console while prototyping
if (typeof window !== 'undefined') (window as any).__game = useGameStore
