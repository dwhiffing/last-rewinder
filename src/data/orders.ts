// Orders that come in on the counter computer. Each order asks for one or
// more tapes; any tape that fits an item's criteria fills it.
import { pick, shuffle, type Rand } from './random'
import {
  type Decade,
  type Genre,
  type Length,
  lengthOf,
  type Rating,
  RATINGS,
  type Tape,
  tapeById,
} from './tapes'

export type OrderKind = 'title' | 'requirements' | 'clue'

export interface Criteria {
  title?: string
  genre?: Genre
  // accepted ratings ("Teen or under" = Kids + Teen)
  ratings?: Rating[]
  decade?: Decade
  length?: Length
  actor?: string
}

export interface OrderItem {
  criteria: Criteria
  // the tape the order was generated from; kept off the market for other orders
  target: string
  filled: string | null
}

export interface Order {
  id: number
  kind: OrderKind
  text: string
  // short tags for requirement orders, shown as chips
  tags: string[]
  items: OrderItem[]
  reward: number
  createdAt: number
  expiresAt: number
}

export const ORDER_RULES: Record<OrderKind, { reward: number; seconds: number }> = {
  title: { reward: 3, seconds: 60 },
  requirements: { reward: 5, seconds: 75 },
  clue: { reward: 8, seconds: 120 },
}

export function matches(tape: Tape, c: Criteria) {
  if (c.title && tape.title !== c.title) return false
  if (c.genre && tape.genre !== c.genre) return false
  if (c.ratings && !c.ratings.includes(tape.rating)) return false
  if (c.decade && tape.decade !== c.decade) return false
  if (c.length && lengthOf(tape.minutes) !== c.length) return false
  if (c.actor && !tape.actors.includes(c.actor)) return false
  return true
}

const ratingsUpTo = (r: Rating) => RATINGS.slice(0, RATINGS.indexOf(r) + 1)

// ---- requirement orders ---------------------------------------------------

type ReqKey = 'genre' | 'rating' | 'decade' | 'length' | 'actor'

function requirementCriteria(rand: Rand, tape: Tape) {
  const keys = shuffle(rand, ['genre', 'rating', 'decade', 'length', 'actor'] as ReqKey[])
  const chosen = keys.slice(0, rand() < 0.6 ? 2 : 3)
  const criteria: Criteria = {}
  const tags: string[] = []
  for (const key of chosen) {
    if (key === 'genre') {
      criteria.genre = tape.genre
      tags.push(tape.genre)
    } else if (key === 'rating') {
      criteria.ratings = ratingsUpTo(tape.rating)
      tags.push(tape.rating === 'X' ? 'Any rating' : tape.rating === 'Kids' ? 'Kids only' : `${tape.rating} or under`)
    } else if (key === 'decade') {
      criteria.decade = tape.decade
      tags.push(`From the ${tape.decade}`)
    } else if (key === 'length') {
      criteria.length = lengthOf(tape.minutes)
      tags.push({ Short: 'Under 90 min', Standard: '90-120 min', Long: 'Over 2 hours' }[criteria.length])
    } else {
      criteria.actor = pick(rand, tape.actors)
      tags.push(`Starring ${criteria.actor}`)
    }
  }
  return { criteria, tags }
}

const REQUEST_OPENERS = [
  'Looking for something with these:',
  'Need a movie for tonight:',
  'Any suggestions? Must be:',
  'Pick one for me:',
]

// ---- clue orders (mad-libs) -----------------------------------------------

type ClueKey = 'actor' | 'genre' | 'decade' | 'length' | 'rating'

const CLUE_OPENERS = [
  "Can't remember the name, but",
  'My cousin told me about one where',
  'There was this movie, I think',
  "It's on the tip of my tongue.",
  'Help! My date picked it and all I know is',
]

const CLUE_CLOSERS = ['Got it?', 'Any idea?', 'You know the one.', 'Please hurry!', '']

const CLUE_PHRASES: Record<ClueKey, (tape: Tape, actor: string) => string[]> = {
  actor: (_, actor) => [
    `${actor} was in it`,
    `it had ${actor} in it`,
    `${actor} was amazing in it`,
  ],
  genre: (tape) =>
    ({
      Action: ['there were tons of explosions', 'it was a real action flick'],
      Comedy: ['it was really funny', 'I laughed the whole time'],
      Drama: ['it made me cry', 'it was a serious drama'],
      Horror: ['it scared me half to death', 'I had to sleep with the lights on'],
      'Sci-Fi': ['it was set in space or the future', 'there were robots or aliens'],
      Family: ['the whole family can watch it', "it's a cute family movie"],
    })[tape.genre],
  decade: (tape) => [
    `it came out in the ${tape.decade}`,
    `it's from the ${tape.decade}`,
    `my parents saw it in the ${tape.decade}`,
  ],
  length: (tape) =>
    ({
      Short: ['it was nice and short', "it's under an hour and a half"],
      Standard: ['it was a regular length', 'it was about an hour and a half or two'],
      Long: ['it was super long', 'it ran over two hours'],
    })[lengthOf(tape.minutes)],
  rating: (tape) =>
    ({
      Kids: ["it's rated for kids", "it's fine for little ones"],
      Teen: ["it's rated Teen", 'my teenager loved it'],
      Mature: ["it's rated Mature", 'it was strictly for grown-ups'],
      X: ["it's rated X", 'not for kids, if you know what I mean'],
    })[tape.rating],
}

function joinClauses(clauses: string[]) {
  if (clauses.length === 1) return clauses[0]
  return `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`
}

function clueOrder(rand: Rand, tape: Tape, pool: Tape[]) {
  const criteria: Criteria = {}
  const used: ClueKey[] = []
  const actor = pick(rand, tape.actors)
  // Keep adding facts until the target is the only tape in the store that
  // fits, up to three so the sentence stays readable
  for (const key of shuffle(rand, ['actor', 'genre', 'decade', 'length', 'rating'] as ClueKey[])) {
    used.push(key)
    if (key === 'actor') criteria.actor = actor
    if (key === 'genre') criteria.genre = tape.genre
    if (key === 'decade') criteria.decade = tape.decade
    if (key === 'length') criteria.length = lengthOf(tape.minutes)
    if (key === 'rating') criteria.ratings = [tape.rating]
    const fits = pool.filter((t) => matches(t, criteria))
    if ((used.length >= 2 && fits.length <= 1) || used.length >= 3) break
  }
  const clauses = used.map((key) => pick(rand, CLUE_PHRASES[key](tape, actor)))
  const opener = pick(rand, CLUE_OPENERS)
  const body = joinClauses(clauses)
  const sentence = opener.endsWith('.')
    ? `${opener} ${body[0].toUpperCase()}${body.slice(1)}.`
    : `${opener} ${body}.`
  const text = `${sentence} ${pick(rand, CLUE_CLOSERS)}`.trim()
  return { criteria, text }
}

// ---- generation -----------------------------------------------------------

const TITLE_OPENERS = ['Do you have', 'Holding a copy of', 'Need', 'Can I rent']

// `available` is every tape in the store (on shelves or carried) that no
// other order is already after. `filledCount` grows multi-tape orders.
export function generateOrder(
  rand: Rand,
  id: number,
  now: number,
  available: string[],
  filledCount: number,
): Order | null {
  if (!available.length) return null
  const pool = available.map(tapeById)
  const kind = pick(rand, ['title', 'title', 'requirements', 'clue'] as OrderKind[])
  const rule = ORDER_RULES[kind]
  const targets = shuffle(rand, pool)

  // After a few filled orders, title requests can ask for two tapes at once
  const count = kind === 'title' && filledCount >= 5 && pool.length > 1 && rand() < 0.35 ? 2 : 1

  let text = ''
  let tags: string[] = []
  const items: OrderItem[] = []
  if (kind === 'title') {
    const picks = targets.slice(0, count)
    for (const t of picks) items.push({ criteria: { title: t.title }, target: t.id, filled: null })
    const names = picks.map((t) => `"${t.title}"`).join(' and ')
    text = `${pick(rand, TITLE_OPENERS)} ${names}?`
  } else if (kind === 'requirements') {
    const r = requirementCriteria(rand, targets[0])
    items.push({ criteria: r.criteria, target: targets[0].id, filled: null })
    tags = r.tags
    text = pick(rand, REQUEST_OPENERS)
  } else {
    const c = clueOrder(rand, targets[0], pool)
    items.push({ criteria: c.criteria, target: targets[0].id, filled: null })
    text = c.text
  }

  const seconds = rule.seconds + (count - 1) * 30
  return {
    id,
    kind,
    text,
    tags,
    items,
    reward: rule.reward * count,
    createdAt: now,
    expiresAt: now + seconds,
  }
}
