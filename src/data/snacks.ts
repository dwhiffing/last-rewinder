// Snacks sit on shelves and ride in your stack like tapes, but only have a
// type, what they cost to stock and what they sell for. Each snack in the
// store is an item id like "snack:popcorn:7".
import { tapeById } from './tapes'

export type SnackType = 'Popcorn' | 'Candy' | 'Soda' | 'Chips' | 'Licorice'

export interface Snack {
  type: SnackType
  cost: number
  price: number
  color: string
}

export const SNACKS: Record<SnackType, Snack> = {
  Popcorn: { type: 'Popcorn', cost: 1, price: 3, color: '#1f4fc4' },
  Candy: { type: 'Candy', cost: 1, price: 2, color: '#f4cf1f' },
  Soda: { type: 'Soda', cost: 1, price: 2, color: '#d63031' },
  Chips: { type: 'Chips', cost: 1, price: 3, color: '#1c2f73' },
  Licorice: { type: 'Licorice', cost: 2, price: 4, color: '#c61f26' },
}

export const SNACK_TYPES = Object.keys(SNACKS) as SnackType[]

export const isSnack = (id: string) => id.startsWith('snack:')

export const snackId = (type: SnackType, n: number) => `snack:${type.toLowerCase()}:${n}`

export const snackOf = (id: string) => {
  const key = id.split(':')[1]
  return SNACKS[SNACK_TYPES.find((t) => t.toLowerCase() === key)!]
}

// Display name for any item in the store: a tape's title or a snack's type
// In a blackout you can't read tape labels, so titles are hidden everywhere
let namesHidden = false
export const setNamesHidden = (hidden: boolean) => (namesHidden = hidden)
export const itemName = (id: string) =>
  isSnack(id) ? snackOf(id).type : namesHidden ? 'a tape' : tapeById(id).title

// Box color for any item
export const itemColor = (id: string, genreColor: (genre: string) => string) =>
  isSnack(id) ? snackOf(id).color : genreColor(tapeById(id).genre)

// Boxed snacks are wide: they fill their slot and the one to its right
export const isWide = (id: string | null | undefined) => !!id && isSnack(id) && snackOf(id).type !== 'Soda'
