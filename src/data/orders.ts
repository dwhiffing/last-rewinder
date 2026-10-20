// Orders that come in on the counter computer. Each order asks for one or
// more tapes; any tape that fits an item's criteria fills it.
import { pick, shuffle, type Rand } from './random'
import { type SnackType } from './snacks'
import {
  type Decade,
  type Genre,
  type Length,
  lengthOf,
  type Rating,
  type Tape,
  tapeById,
  TAPES,
} from './tapes'

export type OrderKind = 'title' | 'suggestion'

export interface Criteria {
  title?: string
  genre?: Genre
  // accepted ratings ("Teen or under" = Kids + Teen)
  ratings?: Rating[]
  decade?: Decade
  year?: number
  length?: Length
  // any one of these actors will do
  actors?: string[]
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
  // short tags shown as chips (unused by the current kinds)
  tags: string[]
  items: OrderItem[]
  reward: number
  createdAt: number
  expiresAt: number
  // a snack order also needs one of these, and pays double
  snack?: SnackType
  snackFilled?: string | null
}

// base reward and time limit; suggestions add more for each point of
// difficulty (see SUGGESTION_*_PER_COST)
export const ORDER_RULES: Record<OrderKind, { reward: number; seconds: number }> = {
  title: { reward: 3, seconds: 60 },
  suggestion: { reward: 4, seconds: 60 },
}

export function matches(tape: Tape, c: Criteria) {
  if (c.title && tape.title !== c.title) return false
  if (c.genre && tape.genre !== c.genre) return false
  if (c.ratings && !c.ratings.includes(tape.rating)) return false
  if (c.decade && tape.decade !== c.decade) return false
  if (c.year && tape.year !== c.year) return false
  if (c.length && lengthOf(tape.minutes) !== c.length) return false
  if (c.actors && !c.actors.some((a) => tape.actors.includes(a))) return false
  return true
}

// ---- suggestion orders ----------------------------------------------------
// A customer describes what they're after from a few facts about one tape in
// the store, and any tape fitting all of them will do. Difficulty is the
// share of the store's current stock that ends up fitting: a tier's
// minPercent/maxPercent picks out which fact combinations count as "hard
// enough" for it, so difficulty tracks the real odds of finding a match
// instead of an arbitrary per-fact cost, and it scales automatically as the
// store's stock grows. The shelf signs give away the genre, the front cover
// shows actors, year and rating, and length is only on the back.

type FactKey = 'genre' | 'eitherActor' | 'actor' | 'decade' | 'year' | 'rating' | 'length'

const ALL_FACTS: FactKey[] = ['genre', 'eitherActor', 'actor', 'decade', 'year', 'rating', 'length']

interface SuggestionRules {
  // share of the pool (0-1) that must fit for a fact combination to count
  minPercent: number
  maxPercent: number
  maxFacts: number
  allowed: FactKey[]
}
interface Fact {
  key: FactKey
  criteria: Criteria
  clause: string
}

const ALL_ACTORS = [...new Set(TAPES.flatMap((t) => t.actors))]

// every fact that's true of a tape, each worded one of a few ways
function factsAbout(rand: Rand, tape: Tape): Fact[] {
  const actor = pick(rand, tape.actors)
  const other = pick(
    rand,
    ALL_ACTORS.filter((a) => !tape.actors.includes(a)),
  )
  const pair = shuffle(rand, [actor, other])
  const length = lengthOf(tape.minutes)
  return [
    {
      key: 'genre',
      criteria: { genre: tape.genre },
      clause: pick(
        rand,
        {
          Action: ['there are tons of explosions', "it's a real action flick"],
          Comedy: ["it's really funny", "it'll make me laugh"],
          Drama: ['it makes you cry', "it's a serious drama"],
          Horror: ["it's scary", "it'll keep me up at night"],
          'Sci-Fi': ["it's set in space or the future", 'there are robots or aliens'],
          Family: ['the whole family can watch it', "it's a nice family movie"],
        }[tape.genre],
      ),
    },
    {
      key: 'eitherActor',
      criteria: { actors: pair },
      clause: pick(rand, [
        `${pair[0]} or ${pair[1]} is in it`,
        `it's got ${pair[0]} or ${pair[1]} in it`,
        `it stars either ${pair[0]} or ${pair[1]}`,
      ]),
    },
    {
      key: 'actor',
      criteria: { actors: [actor] },
      clause: pick(rand, [`${actor} is in it`, `it's got ${actor} in it`, `it stars ${actor}`]),
    },
    {
      key: 'decade',
      criteria: { decade: tape.decade },
      clause: pick(rand, [`it's from the ${tape.decade}`, `it came out in the ${tape.decade}`]),
    },
    {
      key: 'year',
      criteria: { year: tape.year },
      clause: pick(rand, [`it came out in ${tape.year}`, `it's from ${tape.year}`]),
    },
    {
      key: 'rating',
      criteria: { ratings: [tape.rating] },
      clause: pick(
        rand,
        {
          Kids: ["it's rated for kids", "it's fine for little ones"],
          Teen: ["it's rated Teen", "it's rated for teens"],
          Mature: ["it's rated Mature", "it's for grown-ups"],
          X: ["it's rated X", "it's strictly adults only"],
        }[tape.rating],
      ),
    },
    {
      key: 'length',
      criteria: { length },
      clause: pick(
        rand,
        {
          Short: ["it's nice and short", "it's under an hour and a half"],
          Standard: ["it's a normal length", "it's an hour and a half to two hours"],
          Long: ["it's a long one", 'it runs over two hours'],
        }[length],
      ),
    },
  ]
}

// every way to pick 1..max facts (only ever one actor fact at a time)
function factSets(facts: Fact[], max: number): Fact[][] {
  const sets: Fact[][] = []
  const grow = (from: number, chosen: Fact[]) => {
    if (chosen.length) sets.push(chosen)
    if (chosen.length === max) return
    for (let i = from; i < facts.length; i++) {
      // one actor fact at a time, and never a decade alongside an exact year
      const actorFact = (f: Fact) => f.key === 'actor' || f.key === 'eitherActor'
      const dateFact = (f: Fact) => f.key === 'decade' || f.key === 'year'
      if (actorFact(facts[i]) && chosen.some(actorFact)) continue
      if (dateFact(facts[i]) && chosen.some(dateFact)) continue
      grow(i + 1, [...chosen, facts[i]])
    }
  }
  grow(0, [])
  return sets
}

const SUGGESTION_OPENERS = [
  'Any suggestions?',
  'Can you recommend something?',
  "I'm looking for a movie.",
  'Help me pick one?',
]
const SUGGESTION_CLOSERS = ['', 'Any ideas?', 'Surprise me!', 'Thanks!']

function joinClauses(clauses: string[]) {
  if (clauses.length === 1) return clauses[0]
  return `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`
}

// Builds a suggestion around `tape` within the rules; null if no set of
// facts about it fits them (another tape is tried)
function suggestionFor(rand: Rand, tape: Tape, pool: Tape[], rules: SuggestionRules) {
  const merged = (set: Fact[]) => Object.assign({}, ...set.map((f) => f.criteria)) as Criteria
  const facts = factsAbout(rand, tape).filter((f) => rules.allowed.includes(f.key))
  const fitting = factSets(facts, rules.maxFacts).filter((set) => {
    const share = pool.filter((t) => matches(t, merged(set))).length / pool.length
    return share >= rules.minPercent && share <= rules.maxPercent
  })
  if (!fitting.length) return null
  const set = pick(rand, fitting)
  const body = joinClauses(shuffle(rand, set).map((f) => f.clause))
  const sentence = `${body[0].toUpperCase()}${body.slice(1)}.`
  const text = `${pick(rand, SUGGESTION_OPENERS)} ${sentence} ${pick(rand, SUGGESTION_CLOSERS)}`.trim()
  return { criteria: merged(set), text }
}

// ---- generation -----------------------------------------------------------

const TITLE_OPENERS = ['Do you have', 'Holding a copy of', 'Need', 'Can I rent']

// ---- complexity tiers -----------------------------------------------------
// Every day has ORDERS_PER_DAY orders, each low, medium or high complexity.
// Days 1 and 2 are all single-title orders; from day 3 each day mixes the
// tiers (DAY_MIX), and what each tier asks for gets harder in steps
// (brackets of days, matching DAY_MIX).

export type Tier = 'low' | 'medium' | 'high'

export const ORDERS_PER_DAY = 6
export const TIERED_DAY = 3

// [first day, low, medium, high] - the last row carries on forever.
// High tier doesn't show up until day 5; medium and high both ramp up
// gradually from there.
const DAY_MIX: [number, number, number, number][] = [
  [3, 5, 1, 0],
  [5, 3, 2, 1],
  [11, 1, 3, 2],
  [21, 0, 4, 2],
  [31, 0, 3, 3],
]
const bracketOf = (day: number) => {
  let b = 0
  DAY_MIX.forEach(([from], i) => day >= from && (b = i))
  return b
}

// Days 3-10 (the two easiest brackets) ramp the number of suggestion orders
// up by one per day instead of leaving it to each tier's dice roll, so the
// first one never spikes by chance. Day 11 is when the next bracket's own
// tier mix (more medium/high, see DAY_MIX) settles into roughly this many
// suggestions on its own, so the ramp hands off to it there.
const SUGGESTION_RAMP_UNTIL_DAY = 11
const SUGGESTION_RAMP_CAP = 4
const suggestionRampCount = (day: number) =>
  Math.min(SUGGESTION_RAMP_CAP, day - (TIERED_DAY - 1))

// What a tier can turn out as on a given day: a title order for this many
// tapes, or a suggestion within these rules
interface TierRules {
  // chance of a title order instead of a suggestion
  titleChance: number
  titleTapes: number
  suggestion: SuggestionRules
}

// some facts don't show up in suggestions until the player's had time to
// notice them: decade takes a few days to sink in, an exact year is a much
// finer reading of the same cover detail so it waits longer, and length is
// only on the back of the box, easy to miss early on
const FACT_UNLOCK_DAY: Partial<Record<FactKey, number>> = {
  decade: 6,
  year: 15,
  length: 12,
}
const factsFor = (day: number, pool: FactKey[] = ALL_FACTS) =>
  pool.filter((f) => day >= (FACT_UNLOCK_DAY[f] ?? 0))

function tierRules(tier: Tier, day: number): TierRules {
  const b = bracketOf(day)
  if (tier === 'low')
    return {
      titleChance: 0.5,
      titleTapes: 1,
      // "it's got A or B in it", "it's from the 80s", "it's rated Teen" -
      // easy to find: at least a fifth of the stock fits
      suggestion: {
        minPercent: 0.2,
        maxPercent: 1,
        maxFacts: 1,
        allowed: factsFor(day, ['eitherActor', 'decade', 'rating']),
      },
    }
  if (tier === 'medium')
    return {
      titleChance: 0.4,
      titleTapes: 2,
      // solvable by roughly 1 in 7 tapes on the shelf (~15%)
      suggestion: { minPercent: 0.1, maxPercent: 0.2, maxFacts: 2, allowed: factsFor(day) },
    }
  return {
    // high first shows up on day 5 as suggestion-only; title chance opens up
    // once it's been around a bracket
    titleChance: b <= 1 ? 0 : 0.25,
    titleTapes: 3,
    // solvable by roughly 1 in 14 tapes on the shelf (~7%)
    suggestion: { minPercent: 0.04, maxPercent: 0.1, maxFacts: b <= 1 ? 2 : 3, allowed: factsFor(day) },
  }
}

// extra reward/time for a suggestion, on top of ORDER_RULES.suggestion's
// base, scaled to how rare a match the tier asks for
const SUGGESTION_BONUS: Record<Tier, { reward: number; seconds: number }> = {
  low: { reward: 2, seconds: 15 },
  medium: { reward: 6, seconds: 45 },
  high: { reward: 12, seconds: 90 },
}
// each extra tape in a title order adds this much time
const EXTRA_TAPE_SECONDS = 30

// `available` is every tape in the store (on shelves or carried) that no
// other order is already after; `tier` comes from the day's schedule.
// `forceKind`, when given, skips the tier's title/suggestion dice roll (see
// the suggestion ramp in daySchedule)
export function generateOrder(
  rand: Rand,
  id: number,
  now: number,
  available: string[],
  tier: Tier,
  day: number,
  forceKind?: OrderKind,
): Order | null {
  if (!available.length) return null
  const pool = available.map(tapeById)
  const targets = shuffle(rand, pool)
  const rules = day < TIERED_DAY ? null : tierRules(tier, day)

  const make = (kind: OrderKind, text: string, items: OrderItem[], reward: number, seconds: number): Order => ({
    id,
    kind,
    text,
    tags: [],
    items,
    reward,
    createdAt: now,
    expiresAt: now + seconds,
  })

  const wantsSuggestion = forceKind ? forceKind === 'suggestion' : !!rules && rand() >= rules.titleChance
  // a suggestion, if one was rolled (or forced) and some tape can carry it
  if (rules && wantsSuggestion) {
    for (const t of targets) {
      const made = suggestionFor(rand, t, pool, rules.suggestion)
      if (!made) continue
      const rule = ORDER_RULES.suggestion
      const bonus = SUGGESTION_BONUS[tier]
      return make(
        'suggestion',
        made.text,
        [{ criteria: made.criteria, target: t.id, filled: null }],
        rule.reward + bonus.reward,
        rule.seconds + bonus.seconds,
      )
    }
    // nothing fits today's stock: falls through to a title order
  }

  const count = Math.min(rules?.titleTapes ?? 1, pool.length)
  const picks = targets.slice(0, count)
  const names = picks.map((t) => `"${t.title}"`)
  const list = names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const rule = ORDER_RULES.title
  return make(
    'title',
    `${pick(rand, TITLE_OPENERS)} ${list}?`,
    picks.map((t) => ({ criteria: { title: t.title }, target: t.id, filled: null })),
    rule.reward * count,
    rule.seconds + (count - 1) * EXTRA_TAPE_SECONDS,
  )
}

export interface ScheduleSlot {
  tier: Tier
  // bypasses the tier's own title/suggestion dice roll when set (the
  // suggestion ramp below)
  forceKind?: OrderKind
}

// The day's orders, in the order they'll come in. The tiers are dealt into
// two halves so each half of the day gets its share of easy and hard ones,
// and the day opens with its easiest order.
export function daySchedule(rand: Rand, day: number): ScheduleSlot[] {
  if (day < TIERED_DAY) return Array<Tier>(ORDERS_PER_DAY).fill('low').map((tier) => ({ tier }))
  const [, low, medium, high] = DAY_MIX[bracketOf(day)]
  const all: Tier[] = [
    ...Array<Tier>(low).fill('low'),
    ...Array<Tier>(medium).fill('medium'),
    ...Array<Tier>(high).fill('high'),
  ]
  const rank = { low: 0, medium: 1, high: 2 }
  const first = shuffle(rand, all.filter((_, i) => i % 2 === 0))
  const second = shuffle(rand, all.filter((_, i) => i % 2 === 1))
  // easiest of the first half leads
  const lead = first.reduce((best, t, i) => (rank[t] < rank[first[best]] ? i : best), 0)
  const tiers = [first[lead], ...first.filter((_, i) => i !== lead), ...second]
  const slots: ScheduleSlot[] = tiers.map((tier) => ({ tier }))
  if (day < SUGGESTION_RAMP_UNTIL_DAY) {
    // force the hardest slots to be suggestions first, up to today's count,
    // and everything else to a title order
    const target = Math.min(suggestionRampCount(day), slots.length)
    const byHardest = slots
      .map((_, i) => i)
      .sort((a, b) => rank[tiers[b]] - rank[tiers[a]])
    byHardest.forEach((i, rankIdx) => {
      slots[i].forceKind = rankIdx < target ? 'suggestion' : 'title'
    })
  }
  return slots
}
