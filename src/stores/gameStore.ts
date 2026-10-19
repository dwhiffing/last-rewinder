import { create } from 'zustand'
import { ALL_SLOT_IDS, coveringSlot, neighbourSlot, SLOTS_PER_TIER, slotId } from '../data/storeLayout'
import { daySchedule, generateOrder, matches, type Order, type ScheduledKind } from '../data/orders'
import { mulberry32, shuffle } from '../data/random'
import { isSnack, isWide, itemName, setNamesHidden, SNACK_TYPES, type SnackType, snackId, snackOf, SNACKS } from '../data/snacks'
import { GENRES, TAPES, tapeById } from '../data/tapes'
import {
  playCash,
  playClick,
  playDrop,
  playError,
  playFail,
  playInteract,
  playOrderIn,
  playPickup,
  playPowerOff,
  playPowerOn,
  playTap,
} from '../entities/sounds'

export type SoundMode = 'all' | 'muteMusic' | 'muteAll'

export const MAX_CARRIED = 5
export const MAX_ORDERS = 5
const FIRST_ORDER_AT = 3
const ORDER_GAP: [number, number] = [12, 20]

// Days and stock
const STARTING_TAPES = 50
// Rented tapes come back unrewound in the return box 1 to 3 days later
const RENTAL_DAYS: [number, number] = [1, 3]
export const REWIND_SECONDS = 8

// Snacks: from day 3 a free shipment arrives and orders may ask for one
export const SNACK_DAY = 3
const FREE_SNACKS_PER_TYPE = 2
const SNACK_ORDER_CHANCE = 0.4

// Rent is due at the end of every fifth day and goes up each time. Not
// having enough money then ends the game.
export const RENT_EVERY = 5
const FIRST_RENT = 50
const RENT_INCREASE = 25

export interface HudMessage {
  text: string
  at: number
}

// What the pointer is over: kind is the object's name ('tape', 'slot', ...)
export interface Hovered {
  kind: string
  label: string
  // the shelf slot it sits in, for tapes and snacks
  slotId?: string
}

export interface Rewinder {
  tapeId: string
  doneAt: number
}

export interface DaySummary {
  filled: number
  missed: number
  earned: number
  rentPaid?: number
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
  // the lights are out until the power is restored from the computer
  powerOut: boolean
  // when today's outage hits (game seconds), if it hasn't yet
  outageAt: number | null
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
  // next id number for a snack item
  nextSnackId: number
  rentDue: number
  // set when rent couldn't be paid
  gameOver: { day: number; rent: number } | null
  // the VHS / tube TV screen effect; V toggles it
  vhsOn: boolean
  toggleVhs: () => void
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
  submitOrder: (orderId: number) => void
  buySnack: (type: SnackType) => void
  debugSkipDay: () => void
  debugAddMoney: () => void
  debugAddReturn: () => void
  notInStock: (orderId: number) => void
  startNextDay: () => void
  setComputerOpen: (open: boolean) => void
  flipCover: () => void
  restorePower: () => void
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
// catalogue arrives a few at a time each morning. The catalogue itself isn't
// shuffled - each genre's titles are introduced in the order they're listed,
// cycled round-robin across genres so the opening stock (and each day's new
// arrivals) still gets a mix instead of one genre at a time.
function initialStock() {
  const rand = mulberry32(1987)
  const byGenre = GENRES.map((genre) => TAPES.filter((t) => t.genre === genre).map((t) => t.id))
  const catalogue: string[] = []
  for (let i = 0; catalogue.length < TAPES.length; i++) {
    for (const list of byGenre) if (list[i]) catalogue.push(list[i])
  }
  // The middle units (F|H and G|I) start empty so there's room to organize
  const startShelves = ['A', 'B', 'C', 'D', 'E']
  const slotIds = shuffle(
    rand,
    ALL_SLOT_IDS.filter((id) => startShelves.some((shelf) => id.startsWith(`${shelf}-`))),
  )
  const slots: Record<string, string | null> = {}
  for (const id of ALL_SLOT_IDS) slots[id] = null
  catalogue.slice(0, STARTING_TAPES).forEach((tapeId, i) => (slots[slotIds[i]] = tapeId))

  // A starter stock of 2-3 of each snack, scattered randomly across the
  // eye-level tiers of shelf H and shelf I
  let nextSnackId = 1
  const snackSlots = shuffle(
    rand,
    ['H', 'I'].flatMap((shelf) =>
      [4, 3, 2].flatMap((tier) =>
        Array.from({ length: SLOTS_PER_TIER }, (_, i) => slotId(shelf, tier, i)),
      ),
    ),
  )
  const usedSnackSlots = new Set<string>()
  let next = 0
  const takeSnackSlot = (wide: boolean) => {
    while (next < snackSlots.length) {
      const candidate = snackSlots[next++]
      if (usedSnackSlots.has(candidate)) continue
      // a wide box needs its own free neighbour, not hanging off the end of a tier
      const right = neighbourSlot(candidate, 1)
      if (wide && (!right || usedSnackSlots.has(right))) continue
      usedSnackSlots.add(candidate)
      if (right && wide) usedSnackSlots.add(right)
      return candidate
    }
    return null
  }
  for (const type of SNACK_TYPES) {
    const count = 2 + Math.floor(rand() * 2)
    for (let i = 0; i < count; i++) {
      const id = snackId(type, nextSnackId++)
      const slot = takeSnackSlot(isWide(id))
      if (slot) slots[slot] = id
    }
  }
  return { slots, stockPool: catalogue.slice(STARTING_TAPES), nextSnackId }
}

// Blackouts start on day 2, somewhere this many game seconds into the day
const OUTAGE_FROM_DAY = 2
const OUTAGE_WINDOW = [15, 60]

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
  powerOut: false,
  outageAt: null as number | null,
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
  rentDue: FIRST_RENT,
  gameOver: null,
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
  return inStore.filter((id) => !isSnack(id) && !reserved.has(id))
}

// Tapes and snacks already added to an order that won't be submitted go back
// to the return box (the tapes never left, so they're still rewound)
const attachedItems = (orders: Order[]) =>
  orders.flatMap((o) => [...o.items.map((i) => i.filled), o.snackFilled]).filter(Boolean) as string[]

const rentalDays = () =>
  RENTAL_DAYS[0] + Math.floor(orderRand() * (RENTAL_DAYS[1] - RENTAL_DAYS[0] + 1))

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
  vhsOn: true,
  toggleVhs: () => set((s) => ({ vhsOn: !s.vhsOn })),
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
  pickUp: (clicked) => {
    const { slots, carried, showMessage } = get()
    const slotId = coveringSlot(slots, clicked) ?? clicked
    const tapeId = slots[slotId]
    if (!tapeId) return
    if (carried.length >= MAX_CARRIED) {
      playError()
      showMessage(`Your hands are full (${MAX_CARRIED} tapes)`)
      return
    }
    set({
      slots: { ...slots, [slotId]: null },
      carried: [...carried, tapeId],
      coverFlipped: false,
    })
  },
  putDown: (clicked) => {
    const { slots, carried, needsRewind, showMessage } = get()
    const tapeId = carried[carried.length - 1]
    if (!tapeId) {
      playTap()
      return
    }
    const free = (id: string | null): id is string => !!id && !slots[id] && !coveringSlot(slots, id)
    let slotId = clicked
    if (!free(slotId)) return
    if (isWide(tapeId)) {
      // needs this slot and the next; at the end of a tier, shift one left
      const left = neighbourSlot(clicked, -1)
      if (!free(neighbourSlot(clicked, 1))) {
        if (free(left)) slotId = left
        else {
          playError()
          showMessage(`${itemName(tapeId)} needs two empty slots`)
          return
        }
      }
    }
    if (needsRewind[tapeId]) {
      playError()
      showMessage(`Rewind ${itemName(tapeId)} before shelving it`)
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
      // with nothing to take, empty hands just tap on the table it sits on
      if (carried.length) playError()
      else playTap()
      showMessage('The return box is empty')
      return
    }
    if (carried.length >= MAX_CARRIED) {
      playError()
      showMessage(`Your hands are full (${MAX_CARRIED} tapes)`)
      return
    }
    playPickup(tapeId)
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
        playError()
        showMessage(`Still rewinding (${Math.ceil(left)}s)`)
        return
      }
      // Holding a tape that needs rewinding swaps it with the finished one
      const top = carried[carried.length - 1]
      if (top && needsRewind[top]) {
        playDrop(top)
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
        playError()
        showMessage(`Your hands are full (${MAX_CARRIED} tapes)`)
        return
      }
      playPickup(rewinder.tapeId)
      set({ rewinder: null, carried: [...carried, rewinder.tapeId], coverFlipped: false })
      return
    }
    const top = carried[carried.length - 1]
    if (!top) {
      playError()
      showMessage('Bring a tape from the return box to rewind')
      return
    }
    if (!needsRewind[top]) {
      playError()
      showMessage(
        isSnack(top) ? "Snacks don't need rewinding" : `${tapeById(top).title} is already rewound`,
      )
      return
    }
    playDrop(top)
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
    if (s.dayOver || s.gameOver) return
    const time = s.time + delta

    // Closing time: every order for the day has been dealt with. Every
    // fifth day the rent comes out, or the game is over.
    if (!s.schedule.length && !s.orders.length) {
      if (s.day % RENT_EVERY === 0) {
        if (s.money < s.rentDue) {
          set({ time, gameOver: { day: s.day, rent: s.rentDue }, computerOpen: false })
          return
        }
        const today = { ...s.today, rentPaid: s.rentDue }
        set({
          time,
          money: s.money - s.rentDue,
          rentDue: s.rentDue + RENT_INCREASE,
          today,
          dayOver: today,
          computerOpen: false,
        })
        return
      }
      set({ time, dayOver: s.today, computerOpen: false })
      return
    }

    const wasRewinding = s.rewinder && s.rewinder.doneAt > s.time
    if (wasRewinding && s.rewinder!.doneAt <= time) {
      playInteract()
      s.showMessage(`${itemName(s.rewinder!.tapeId)} is rewound`)
    }

    // From day 2 the power cuts out once at a random point in the day
    if (s.outageAt !== null && time >= s.outageAt) {
      set({ powerOut: true, outageAt: null })
      s.showMessage('The power went out! Restore it from the computer')
    }

    const expired = s.orders.filter((o) => o.expiresAt <= time)
    let orders = expired.length ? s.orders.filter((o) => o.expiresAt > time) : s.orders
    let { nextOrderAt, nextOrderId } = s
    const patch: Partial<GameState> = { time }

    if (expired.length) {
      playFail()
      const back = attachedItems(expired)
      patch.message = {
        text: back.length
          ? 'An order ran out of time. Its items went to the return box'
          : 'An order ran out of time',
        at: performance.now(),
      }
      patch.today = { ...s.today, missed: s.today.missed + expired.length }
      if (back.length) patch.returnBox = [...s.returnBox, ...back]
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
          if (kind !== 'missing' && s.day >= SNACK_DAY && orderRand() < SNACK_ORDER_CHANCE) {
            order.snack = SNACK_TYPES[Math.floor(orderRand() * SNACK_TYPES.length)]
            order.snackFilled = null
          }
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
  // Adds the top carried item to an order. Nothing is paid until the order
  // is submitted, so a snack can still be added after the tapes.
  handIn: (orderId) => {
    const s = get()
    const order = s.orders.find((o) => o.id === orderId)
    const top = s.carried[s.carried.length - 1]
    if (!order) return
    if (!top) {
      playError()
      s.showMessage('Carry the item you want to add')
      return
    }
    const carried = s.carried.slice(0, -1)
    const update = (o: Order) => s.orders.map((x) => (x.id === orderId ? o : x))
    if (isSnack(top)) {
      const type = snackOf(top).type
      if (order.snack !== type || order.snackFilled) {
        playError()
        s.showMessage(order.snack ? `They wanted ${order.snack}, not ${type}` : "That order didn't ask for a snack")
        return
      }
      playDrop(top)
      set({ carried, coverFlipped: false, orders: update({ ...order, snackFilled: top }) })
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
    playDrop(top)
    set({ carried, coverFlipped: false, orders: update({ ...order, items }) })
  },
  submitOrder: (orderId) => {
    const s = get()
    const order = s.orders.find((o) => o.id === orderId)
    if (!order) return
    const missing = order.items.filter((i) => !i.filled).length
    if (missing) {
      playError()
      s.showMessage(`Still needs ${missing} tape${missing > 1 ? 's' : ''}`)
      return
    }
    const snackPay = order.snackFilled ? snackOf(order.snackFilled).price : 0
    const pay = order.reward + snackPay
    // The tapes leave the store and come back to the return box later
    const rented = [
      ...s.rented,
      ...order.items.map((i) => ({ tapeId: i.filled!, returnDay: s.day + rentalDays() })),
    ]
    playCash()
    set({
      rented,
      orders: s.orders.filter((o) => o.id !== orderId),
      money: s.money + pay,
      ordersFilled: s.ordersFilled + 1,
      today: { ...s.today, filled: s.today.filled + 1, earned: s.today.earned + pay },
      message: {
        text: `Order sent! +${formatMoney(pay)}${snackPay ? ` (snack +${formatMoney(snackPay)})` : ''}`,
        at: performance.now(),
      },
    })
  },
  // Restocking snacks: paid now, delivered straight to the return box
  buySnack: (type) => {
    const s = get()
    const { cost } = SNACKS[type]
    if (s.money < cost) {
      playError()
      s.showMessage(`Not enough money for ${type}`)
      return
    }
    playInteract()
    set({
      money: s.money - cost,
      returnBox: [...s.returnBox, snackId(type, s.nextSnackId)],
      nextSnackId: s.nextSnackId + 1,
      message: { text: `${type} delivered to the return box`, at: performance.now() },
    })
  },
  debugSkipDay: () => {
    const s = get()
    if (s.dayOver || s.gameOver) return
    const back = attachedItems(s.orders)
    set({
      orders: [],
      schedule: [],
      returnBox: [...s.returnBox, ...back],
      today: { ...s.today, missed: s.today.missed + s.orders.length },
    })
  },
  debugAddMoney: () => set((s) => ({ money: s.money + 5 })),
  // a random tape the store doesn't own yet, dropped off unrewound like a return
  debugAddReturn: () =>
    set((s) => {
      // skip tapes an open "not in stock" order is asking for
      const reserved = new Set(s.orders.flatMap((o) => o.items.map((i) => i.target)))
      const pool = s.stockPool.filter((id) => !reserved.has(id))
      if (!pool.length) return {}
      const tapeId = pool[Math.floor(Math.random() * pool.length)]
      return {
        stockPool: s.stockPool.filter((id) => id !== tapeId),
        returnBox: [...s.returnBox, tapeId],
        needsRewind: { ...s.needsRewind, [tapeId]: true },
      }
    }),
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
    // The first snack shipment is on the house
    let { nextSnackId } = s
    const freeSnacks: string[] = []
    if (day === SNACK_DAY) {
      for (const type of SNACK_TYPES)
        for (let i = 0; i < FREE_SNACKS_PER_TYPE; i++) freeSnacks.push(snackId(type, nextSnackId++))
    }
    const needsRewind = { ...s.needsRewind }
    for (const id of due) needsRewind[id] = true
    set({
      day,
      dayOver: null,
      schedule: daySchedule(orderRand, day, s.stockPool.length),
      today: emptyDay(),
      nextOrderAt: s.time + FIRST_ORDER_AT,
      powerOut: false,
      outageAt: day >= OUTAGE_FROM_DAY ? s.time + OUTAGE_WINDOW[0] + Math.random() * (OUTAGE_WINDOW[1] - OUTAGE_WINDOW[0]) : null,
      rented: s.rented.filter((r) => r.returnDay > day),
      incoming: [],
      returnBox: [...s.returnBox, ...freeSnacks, ...arrivals, ...shuffle(orderRand, due)],
      nextSnackId,
      needsRewind,
      message: {
        text: `${freeSnacks.length ? 'Free snack shipment! ' : ''}${arrivals.length} new tape${arrivals.length === 1 ? '' : 's'} and ${due.length} return${due.length === 1 ? '' : 's'} in the return box`,
        at: performance.now(),
      },
    })
  },
  setComputerOpen: (computerOpen) => {
    if (!computerOpen && get().computerOpen) playClick()
    set({ computerOpen })
  },
  restorePower: () => set({ powerOut: false }),
  flipCover: () => set((s) => ({ coverFlipped: !s.coverFlipped })),
}))

// keep tape titles hidden for exactly as long as the lights are out
useGameStore.subscribe((s) => setNamesHidden(s.powerOut))

// Every way the power changes (the outage, restoring it, a new day, the debug
// button) gets its sound
useGameStore.subscribe((s, prev) => {
  if (s.powerOut === prev.powerOut) return
  if (s.powerOut) playPowerOff()
  else playPowerOn()
})

export default useGameStore

// Handy for poking at state from the browser console while prototyping
if (typeof window !== 'undefined') (window as any).__game = useGameStore
