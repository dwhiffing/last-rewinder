import { create } from 'zustand'
import { ALL_SLOT_IDS, SHELF_GENRES, SLOTS_PER_TIER, coveringSlot, neighbourSlot, slotId } from '../data/storeLayout'
import { daySchedule, generateOrder, matches, type Order, type ScheduleSlot } from '../data/orders'
import { mulberry32, shuffle } from '../data/random'
import { shakeDoor } from '../entities/store/door'
import { isSnack, isWide, itemName, setNamesHidden, SNACK_TYPES, type SnackType, snackId, snackOf, SNACKS } from '../data/snacks'
import { GENRES, TAPES, tapeById } from '../data/tapes'
import {
  playCash,
  playDoorRattle,
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
  playWhoosh,
} from '../entities/sounds'

export type SoundMode = 'all' | 'muteMusic' | 'muteAll'

export const MAX_CARRIED = 5
export const MAX_ORDERS = 5
const FIRST_ORDER_AT = 3
// every day opens with this many orders already on the computer
const OPENING_ORDERS = 2
// while the day has orders left, at least this many are always open
const MIN_OPEN_ORDERS = 2
const ORDER_GAP: [number, number] = [12, 20]

// A plain one-tape order gives ORDER_SECONDS_START to fill it on day 1, and
// ORDER_SECONDS_STEP less every ORDER_SECONDS_EVERY days, down to
// MIN_ORDER_SECONDS. Harder orders (more tapes, tougher suggestions) get
// proportionally longer: their base time from orders.ts is scaled by the same
// factor that takes a plain order's BASE_ORDER_SECONDS to the day's time.
const ORDER_SECONDS_START = 90
const ORDER_SECONDS_STEP = 3
const ORDER_SECONDS_EVERY = 1
const MIN_ORDER_SECONDS = 30
const BASE_ORDER_SECONDS = 60
const plainOrderSeconds = (day: number) =>
  Math.max(
    MIN_ORDER_SECONDS,
    ORDER_SECONDS_START - ORDER_SECONDS_STEP * Math.floor((day - 1) / ORDER_SECONDS_EVERY),
  )
const orderTimeScale = (day: number) => plainOrderSeconds(day) / BASE_ORDER_SECONDS
// on the first day orders also come in this much further apart
const FIRST_DAY_GAP_MULTIPLIER = 3

// Days and stock
const STARTING_TAPES = 40
// new tapes delivered to the return box every morning, in catalogue order
const NEW_TAPES_PER_DAY = 5
// Rented tapes come back unrewound in the return box 1 to 3 days later
const RENTAL_DAYS: [number, number] = [1, 3]
export const REWIND_SECONDS = 8

// Snacks: from day 3 the starter stock goes out and orders may ask for one
export const SNACK_DAY = 3
// how many of each snack the starter stock (put out on SNACK_DAY) has
const STARTER_SNACKS_PER_TYPE = 2
// share of orders that want a snack: this much on SNACK_DAY, rising daily
const SNACK_ORDER_CHANCE_START = 0.2
const SNACK_ORDER_CHANCE_STEP = 0.1
const snackOrderChance = (day: number) =>
  Math.min(1, SNACK_ORDER_CHANCE_START + SNACK_ORDER_CHANCE_STEP * (day - SNACK_DAY))
export const SNACKS_PER_ORDER = 1

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
  // the tape, for one in the return box
  returnId?: string
  // false for something just put down, so it doesn't slide straight back out
  popOut?: boolean
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
  // orders still to put up at once when the day opens
  openingOrders: number
  nextOrderId: number
  ordersFilled: number
  computerOpen: boolean
  // the lights are out until the power is restored from the computer
  powerOut: boolean
  // when today's outage hits (game seconds), if it hasn't yet
  outageAt: number | null
  // when someone outside tries the locked front door today, if they do
  rattleAt: number | null
  // the top tape's card shows its back
  coverFlipped: boolean
  day: number
  // set when the day has ended and the summary is showing
  dayOver: DaySummary | null
  today: DaySummary
  // catalogue tapes the store doesn't own and hasn't ordered yet
  stockPool: string[]
  // return box, bottom first; the last one is taken first
  returnBox: string[]
  // tapes that have to go through the rewinder before renting (they can sit on
  // a shelf unrewound, but handing one over fails the order)
  needsRewind: Record<string, boolean>
  rewinder: Rewinder | null
  rented: { tapeId: string; returnDay: number }[]
  // the rest of today's orders; the day ends once these and the open ones are done
  schedule: ScheduleSlot[]
  // next id number for a snack item
  nextSnackId: number
  // snacks bought today, put out on the snack shelves tomorrow morning
  snackDeliveries: string[]
  // the starter snacks and the slots they go in, put out on SNACK_DAY
  starterSnacks: Record<string, string>
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
  // a particular tape, or the one on top when none is given
  takeFromReturnBox: (tapeId?: string) => void
  useRewinder: () => void
  tick: (delta: number) => void
  fillOrder: (orderId: number) => void
  dismissOrder: (orderId: number) => void
  buySnack: (type: SnackType) => void
  debugSkipDay: () => void
  debugAddMoney: () => void
  debugAddReturn: () => void
  debugFillOrder: (orderId: number) => void
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
// How a title files on the shelf: a leading "The", "A" or "An" is skipped
const sortTitle = (title: string) => title.replace(/^(the|a|an)\s+/i, '')

function initialStock() {
  const rand = mulberry32(1987)
  const byGenre = GENRES.map((genre) => TAPES.filter((t) => t.genre === genre).map((t) => t.id))
  const catalogue: string[] = []
  for (let i = 0; catalogue.length < TAPES.length; i++) {
    for (const list of byGenre) if (list[i]) catalogue.push(list[i])
  }
  // Each starting tape goes on its own genre's shelf (A-F), in random (but the
  // same every game) slots, in alphabetical order by
  // title reading like a page: left to right along each tier, top tier first.
  // G, H and I start empty.
  const slots: Record<string, string | null> = {}
  for (const id of ALL_SLOT_IDS) slots[id] = null
  const starting = catalogue.slice(0, STARTING_TAPES)
  for (const [shelf, genre] of Object.entries(SHELF_GENRES)) {
    const readingOrder = ALL_SLOT_IDS.filter((id) => id.startsWith(`${shelf}-`)).sort((a, b) => {
      const [, ta, sa] = a.split('-').map(Number)
      const [, tb, sb] = b.split('-').map(Number)
      return tb - ta || sa - sb
    })
    const titles = starting
      .filter((id) => tapeById(id).genre === genre)
      .sort((a, b) => sortTitle(tapeById(a).title).localeCompare(sortTitle(tapeById(b).title)))
    // pick which slots get a tape at random, then fill them in reading order
    const chosen = new Set(shuffle(rand, readingOrder).slice(0, titles.length))
    const spots = readingOrder.filter((id) => chosen.has(id))
    titles.forEach((tapeId, i) => (slots[spots[i]] = tapeId))
  }

  // A starter stock of each snack, scattered randomly across the
  // eye-level tiers of shelf H and shelf I. It's laid out now (the same every
  // game) but only goes out on the shelves the morning snack orders begin.
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
  const starterSnacks: Record<string, string> = {}
  for (const type of SNACK_TYPES) {
    const count = STARTER_SNACKS_PER_TYPE
    for (let i = 0; i < count; i++) {
      const id = snackId(type, nextSnackId++)
      const slot = takeSnackSlot(isWide(id))
      if (slot) starterSnacks[slot] = id
    }
  }
  return { slots, stockPool: catalogue.slice(STARTING_TAPES), nextSnackId, starterSnacks }
}

// Blackouts start on day 2, somewhere this many game seconds into the day
const OUTAGE_FROM_DAY = 2
const OUTAGE_WINDOW = [15, 60]

// Now and then someone outside tries the locked front door partway through
// the day: a chance per day, at a random point this many game seconds in
const RATTLE_CHANCE = 0.25
const RATTLE_WINDOW = [30, 70]
const RATTLE_VOLUME = 1.05
const rollRattle = (dayStart: number) =>
  Math.random() < RATTLE_CHANCE
    ? dayStart + RATTLE_WINDOW[0] + Math.random() * (RATTLE_WINDOW[1] - RATTLE_WINDOW[0])
    : null

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
  openingOrders: OPENING_ORDERS,
  nextOrderId: 1,
  ordersFilled: 0,
  computerOpen: false,
  powerOut: false,
  outageAt: null as number | null,
  // never on the first day
  rattleAt: null as number | null,
  coverFlipped: false,
  day: 1,
  dayOver: null,
  today: emptyDay(),
  returnBox: [] as string[],
  needsRewind: {} as Record<string, boolean>,
  rewinder: null,
  rented: [] as { tapeId: string; returnDay: number }[],
  schedule: daySchedule(orderRand, 1),
  snackDeliveries: [] as string[],
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

// Which carried items would fill an order: a different tape for each thing
// it asks for (rewound ones only, unless asked), plus SNACKS_PER_ORDER of the
// snack a snack order needs. null if you aren't holding enough for it.
// Snack deliveries go straight out on the snack shelves (the eye-level tiers
// of H and I), each in a random free slot - wide boxes need two side by side.
// Anything that doesn't fit is left out of `placed`.
function shelveSnacks(slots: Record<string, string | null>, ids: string[]) {
  const next = { ...slots }
  const free = (id: string | null): id is string =>
    !!id && id in next && !next[id] && !coveringSlot(next, id)
  const candidates = shuffle(
    Math.random,
    ['H', 'I'].flatMap((shelf) =>
      [4, 3, 2].flatMap((tier) => Array.from({ length: SLOTS_PER_TIER }, (_, i) => slotId(shelf, tier, i))),
    ),
  )
  const placed: string[] = []
  for (const id of ids) {
    const spot = candidates.find((c) => free(c) && (!isWide(id) || free(neighbourSlot(c, 1))))
    if (!spot) continue
    next[spot] = id
    placed.push(id)
  }
  return { slots: next, placed }
}

export function orderPicks(
  order: Order,
  carried: string[],
  needsRewind: Record<string, boolean>,
  allowUnrewound = false,
) {
  const tapes = carried.filter((id) => !isSnack(id) && (allowUnrewound || !needsRewind[id]))
  const used: string[] = []
  const assign = (i: number): boolean => {
    if (i === order.items.length) return true
    for (const id of tapes) {
      if (used.includes(id) || !matches(tapeById(id), order.items[i].criteria)) continue
      used.push(id)
      if (assign(i + 1)) return true
      used.pop()
    }
    return false
  }
  if (!assign(0)) return null
  const snacks = order.snack ? snacksFor(order, carried) : []
  if (snacks.length < (order.snack ? SNACKS_PER_ORDER : 0)) return null
  return { tapes: used, snacks }
}

// the carried snacks a snack order would take, up to as many as it needs
export function snacksFor(order: Order, carried: string[]) {
  return carried
    .filter((id) => isSnack(id) && snackOf(id).type === order.snack)
    .slice(0, SNACKS_PER_ORDER)
}

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
    set({
      slots: { ...slots, [slotId]: tapeId },
      carried: carried.slice(0, -1),
      coverFlipped: false,
    })
  },
  takeFromReturnBox: (picked) => {
    const { returnBox, carried, showMessage } = get()
    const tapeId = picked && returnBox.includes(picked) ? picked : returnBox[returnBox.length - 1]
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
      returnBox: returnBox.filter((id) => id !== tapeId),
      carried: [...carried, tapeId],
      coverFlipped: false,
    })
  },
  useRewinder: () => {
    const { rewinder, carried, needsRewind, time, showMessage, powerOut } = get()
    // no power, no rewinding (a finished tape can still be taken out)
    const noPower = () => {
      playError()
      showMessage("The rewinder won't run without power")
    }
    if (rewinder) {
      const left = rewinder.doneAt - time
      if (left > 0) {
        if (powerOut) return noPower()
        playError()
        showMessage(`Still rewinding (${Math.ceil(left)}s)`)
        return
      }
      // Holding a tape that needs rewinding swaps it with the finished one
      const top = carried[carried.length - 1]
      if (top && needsRewind[top]) {
        if (powerOut) return noPower()
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
    if (powerOut) return noPower()
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

    // with the power out a rewind in progress stops where it is, and picks up
    // again once the power's back
    let rewinder = s.rewinder
    if (s.powerOut && rewinder && rewinder.doneAt > s.time) {
      rewinder = { ...rewinder, doneAt: rewinder.doneAt + (time - s.time) }
      set({ rewinder })
    }
    const wasRewinding = rewinder && rewinder.doneAt > s.time
    if (wasRewinding && rewinder!.doneAt <= time) {
      playInteract()
      s.showMessage(`${itemName(rewinder!.tapeId)} is rewound`)
    }

    // From day 2 the power cuts out once at a random point in the day
    // somebody outside tries the locked door, loudly
    if (s.rattleAt !== null && time >= s.rattleAt) {
      playDoorRattle(RATTLE_VOLUME)
      shakeDoor()
      set({ rattleAt: null })
    }

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
    let schedule = s.schedule
    // Takes the next order off today's schedule, if there's room for it
    const spawnOrder = () => {
      if (orders.length >= MAX_ORDERS || !schedule.length) return
      {
        const slot = schedule[0]
        const order = generateOrder(
          orderRand,
          nextOrderId,
          time,
          availableTapes({ ...s, orders }),
          slot.tier,
          s.day,
          slot.forceKind,
        )
        // An order that can't be made (nothing left to ask for) is skipped
        schedule = schedule.slice(1)
        if (order) {
          // longer to fill orders early on, shrinking day by day (see orderTimeScale)
          order.expiresAt =
            time + Math.max(MIN_ORDER_SECONDS, (order.expiresAt - time) * orderTimeScale(s.day))
          // snack orders need the tapes and the snack too, and pay double
          if (s.day >= SNACK_DAY && orderRand() < snackOrderChance(s.day)) {
            order.snack = SNACK_TYPES[Math.floor(orderRand() * SNACK_TYPES.length)]
            order.reward *= 2
          }
          orders = [...orders, order]
          nextOrderId++
        }
      }
    }
    const before = orders.length
    // A new day opens with its first few orders already waiting
    if (s.openingOrders > 0) {
      for (let i = 0; i < s.openingOrders; i++) spawnOrder()
      patch.openingOrders = 0
    } else if (time >= nextOrderAt) {
      spawnOrder()
    }
    // never fewer than MIN_OPEN_ORDERS on the go while the day has more to
    // come: the next ones arrive straight away (each try uses up a schedule
    // slot, so this always ends)
    while (orders.length < MIN_OPEN_ORDERS && schedule.length) spawnOrder()
    if (orders.length > before) {
      const gap =
        (ORDER_GAP[0] + orderRand() * (ORDER_GAP[1] - ORDER_GAP[0])) *
        (s.day === 1 ? FIRST_DAY_GAP_MULTIPLIER : 1)
      nextOrderAt = time + gap
    } else if (time >= nextOrderAt) {
      // couldn't add one (full, or nothing could be made): try again shortly
      nextOrderAt = time + 4
    }
    const arrived = orders.length - before
    if (arrived > 0) {
      playOrderIn()
      patch.message = {
        text: arrived > 1 ? `${arrived} orders waiting on the computer` : 'New order on the computer',
        at: performance.now(),
      }
    }
    if (schedule !== s.schedule) patch.schedule = schedule
    if (orders !== s.orders) patch.orders = orders
    if (nextOrderAt !== s.nextOrderAt) Object.assign(patch, { nextOrderAt, nextOrderId })
    set(patch)
  },
  // Adds the top carried item to an order. Nothing is paid until the order
  // is submitted, so a snack can still be added after the tapes.
  // Clicking an order sends it straight away if you're holding everything it
  // asks for, anywhere in your stack; a snack it'd like goes with it if you
  // have one
  fillOrder: (orderId) => {
    const s = get()
    const order = s.orders.find((o) => o.id === orderId)
    if (!order) return
    const picks = orderPicks(order, s.carried, s.needsRewind)
    if (!picks) {
      // Only an unrewound tape would do: the customer takes it home, finds it
      // isn't rewound and the order's lost (you keep the tapes)
      const unrewound = orderPicks(order, s.carried, s.needsRewind, true)
      if (unrewound) {
        const late = unrewound.tapes.filter((id) => s.needsRewind[id]).map((id) => tapeById(id).title)
        const titles = `${late.join(' and ')} ${late.length > 1 ? "weren't" : "wasn't"}`
        playFail()
        set({
          orders: s.orders.filter((o) => o.id !== orderId),
          today: { ...s.today, missed: s.today.missed + 1 },
          message: { text: `${titles} rewound! The order failed`, at: performance.now() },
        })
        return
      }
      playError()
      const snacksShort = !!order.snack && snacksFor(order, s.carried).length < SNACKS_PER_ORDER
      const tapesOk = !!orderPicks({ ...order, snack: undefined }, s.carried, s.needsRewind, true)
      s.showMessage(
        tapesOk && snacksShort
          ? `They need ${SNACKS_PER_ORDER > 1 ? `${SNACKS_PER_ORDER} ` : ''}${order.snack} too`
          : order.items.length > 1
            ? "You aren't carrying all the tapes for that order"
            : "You aren't carrying a tape for that order",
      )
      return
    }
    const used = [...picks.tapes, ...picks.snacks]
    const pay = order.reward
    // The tapes leave the store and come back to the return box later
    const rented = [
      ...s.rented,
      ...picks.tapes.map((tapeId) => ({ tapeId, returnDay: s.day + rentalDays() })),
    ]
    playCash()
    set({
      carried: s.carried.filter((id) => !used.includes(id)),
      coverFlipped: false,
      rented,
      orders: s.orders.filter((o) => o.id !== orderId),
      money: s.money + pay,
      ordersFilled: s.ordersFilled + 1,
      today: { ...s.today, filled: s.today.filled + 1, earned: s.today.earned + pay },
      message: {
        text: `Order sent! +${formatMoney(pay)}`,
        at: performance.now(),
      },
    })
  },
  // Gives up on an order early instead of waiting for it to expire; costs
  // the same as letting it run out (counts as missed, any attached items go
  // to the return box)
  dismissOrder: (orderId) => {
    const s = get()
    const order = s.orders.find((o) => o.id === orderId)
    if (!order) return
    const back = attachedItems([order])
    playFail()
    set({
      orders: s.orders.filter((o) => o.id !== orderId),
      returnBox: back.length ? [...s.returnBox, ...back] : s.returnBox,
      today: { ...s.today, missed: s.today.missed + 1 },
      message: { text: 'Order dismissed', at: performance.now() },
    })
  },
  // Dev shortcut: sends the given order using tapes/snacks from the shelves
  // or the return box. Rewinding is skipped (any tape used is auto-rewound);
  // a snack it needs is used if one's on hand, or conjured for free if not -
  // this is a debug tool, not a real purchase
  debugFillOrder: (orderId) => {
    const s = get()
    const order = s.orders.find((o) => o.id === orderId)
    if (!order) return
    const onShelves = Object.values(s.slots).filter(Boolean) as string[]
    const pool = [...onShelves, ...s.returnBox]
    const picks = orderPicks({ ...order, snack: undefined }, pool, s.needsRewind, true)
    if (!picks) {
      s.showMessage('[debug] Nothing on the shelves or in the return box fills that order')
      return
    }
    const foundSnacks = order.snack ? snacksFor(order, pool) : []
    const used = [...picks.tapes, ...foundSnacks]
    const slots = { ...s.slots }
    let returnBox = s.returnBox
    for (const id of used) {
      const slotId = Object.keys(slots).find((k) => slots[k] === id)
      if (slotId) slots[slotId] = null
      else returnBox = returnBox.filter((x) => x !== id)
    }
    const rewoundIds = picks.tapes.filter((id) => s.needsRewind[id])
    const needsRewind = rewoundIds.length
      ? Object.fromEntries(Object.entries(s.needsRewind).filter(([id]) => !rewoundIds.includes(id)))
      : s.needsRewind
    const pay = order.reward
    const rented = [
      ...s.rented,
      ...picks.tapes.map((tapeId) => ({ tapeId, returnDay: s.day + rentalDays() })),
    ]
    set({
      slots,
      returnBox,
      needsRewind,
      rented,
      orders: s.orders.filter((o) => o.id !== orderId),
      money: s.money + pay,
      ordersFilled: s.ordersFilled + 1,
      today: { ...s.today, filled: s.today.filled + 1, earned: s.today.earned + pay },
      message: { text: `[debug] Order auto-filled: +${formatMoney(pay)}`, at: performance.now() },
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
      snackDeliveries: [...s.snackDeliveries, snackId(type, s.nextSnackId)],
      nextSnackId: s.nextSnackId + 1,
      message: { text: `${type} ordered: it'll be on the snack shelves tomorrow`, at: performance.now() },
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
  // the next tape the store doesn't own yet, dropped off unrewound like a return
  debugAddReturn: () =>
    set((s) => {
      const [tapeId, ...rest] = s.stockPool
      if (!tapeId) return {}
      return {
        stockPool: rest,
        returnBox: [...s.returnBox, tapeId],
        needsRewind: { ...s.needsRewind, [tapeId]: true },
      }
    }),
  // Morning: rentals that are due come back unrewound, and the next
  // NEW_TAPES_PER_DAY tapes from the catalogue arrive in the return box with
  // them, already rewound
  startNextDay: () => {
    const s = get()
    const day = s.day + 1
    const due = s.rented.filter((r) => r.returnDay <= day).map((r) => r.tapeId)
    const arrivals = s.stockPool.slice(0, NEW_TAPES_PER_DAY)
    const needsRewind = { ...s.needsRewind }
    for (const id of due) needsRewind[id] = true
    // The starter snacks go out the morning snack orders begin, in their own
    // spots where those are still free, anywhere free on the snack shelves
    // otherwise
    let morningSlots = s.slots
    const starterLeftover: string[] = []
    if (day === SNACK_DAY) {
      morningSlots = { ...s.slots }
      for (const [slot, id] of Object.entries(s.starterSnacks)) {
        const right = isWide(id) ? neighbourSlot(slot, 1) : null
        const fits =
          !morningSlots[slot] &&
          !coveringSlot(morningSlots, slot) &&
          (!isWide(id) || (!!right && !morningSlots[right] && !coveringSlot(morningSlots, right)))
        if (fits) morningSlots[slot] = id
        else starterLeftover.push(id)
      }
    }
    // snacks bought yesterday (and any free ones) go out on the shelves; any
    // bought ones that don't fit are refunded
    const delivered = [...starterLeftover, ...s.snackDeliveries]
    const shelved = shelveSnacks(morningSlots, delivered)
    const refund = s.snackDeliveries
      .filter((id) => !shelved.placed.includes(id))
      .reduce((sum, id) => sum + SNACKS[snackOf(id).type].cost, 0)
    const snackNews = [
      day === SNACK_DAY ? 'Snacks are in! Fresh stock on the snack shelves.' : '',
      s.snackDeliveries.length ? 'Your snack order is on the shelves.' : '',
      refund ? `No room for some snacks: ${formatMoney(refund)} refunded.` : '',
    ]
      .filter(Boolean)
      .join(' ')
    set({
      day,
      money: s.money + refund,
      snackDeliveries: [],
      dayOver: null,
      schedule: daySchedule(orderRand, day),
      today: emptyDay(),
      nextOrderAt: s.time + FIRST_ORDER_AT,
      openingOrders: OPENING_ORDERS,
      powerOut: false,
      outageAt: day >= OUTAGE_FROM_DAY ? s.time + OUTAGE_WINDOW[0] + Math.random() * (OUTAGE_WINDOW[1] - OUTAGE_WINDOW[0]) : null,
      rattleAt: rollRattle(s.time),
      rented: s.rented.filter((r) => r.returnDay > day),
      stockPool: s.stockPool.slice(NEW_TAPES_PER_DAY),
      returnBox: [...s.returnBox, ...arrivals, ...shuffle(orderRand, due)],
      slots: shelved.slots,
      needsRewind,
      message: {
        text: `${snackNews ? `${snackNews} ` : ''}${arrivals.length} new tape${arrivals.length === 1 ? '' : 's'} and ${due.length} return${due.length === 1 ? '' : 's'} in the return box`,
        at: performance.now(),
      },
    })
  },
  setComputerOpen: (computerOpen) => {
    if (!computerOpen && get().computerOpen) playClick()
    set({ computerOpen })
  },
  restorePower: () => set({ powerOut: false }),
  flipCover: () => {
    playWhoosh()
    set((s) => ({ coverFlipped: !s.coverFlipped }))
  },
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
