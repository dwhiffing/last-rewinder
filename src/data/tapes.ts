// Placeholder catalogue. Titles, actors and blurbs are made up; colors stand
// in for box art. Stats are generated from a fixed seed so every run matches.
import { mulberry32, pick, shuffle, weighted, type Rand } from './random'

export type Genre = 'Action' | 'Comedy' | 'Drama' | 'Horror' | 'Sci-Fi' | 'Family'

export type Rating = 'Kids' | 'Teen' | 'Mature' | 'X'
export type Decade = '70s' | '80s' | '90s'
export type Length = 'Short' | 'Standard' | 'Long'

export const RATINGS: Rating[] = ['Kids', 'Teen', 'Mature', 'X']
export const DECADES: Decade[] = ['70s', '80s', '90s']
export const LENGTHS: Length[] = ['Short', 'Standard', 'Long']

export const RATING_COLORS: Record<Rating, string> = {
  Kids: '#27ae60',
  Teen: '#2980b9',
  Mature: '#d35400',
  X: '#111111',
}

export interface Tape {
  id: string
  title: string
  genre: Genre
  rating: Rating
  decade: Decade
  year: number
  minutes: number
  actors: string[]
  bio: string
}

export const lengthOf = (minutes: number): Length =>
  minutes < 90 ? 'Short' : minutes <= 120 ? 'Standard' : 'Long'

export const GENRE_COLORS: Record<Genre, string> = {
  Action: '#c0392b',
  Comedy: '#ff7a1a',
  Drama: '#8e44ad',
  Horror: '#2c3e50',
  'Sci-Fi': '#16a085',
  Family: '#e84393',
}

const TITLES: Record<Genre, string[]> = {
  Action: [
    'Die Harder Still',
    'Lethal Paperwork',
    'Road Rage Warrior',
    'Speed Bump',
    'Commando Kitchen',
    'Explosion Street',
    'Kickboxer Dad',
    'Total Rewind',
    'Midnight Convoy',
    'Rooftop Rundown',
    'Double Parked',
    'Last Call for Vengeance',
    'Vendetta on Aisle 9',
    'The Reckoning Shift',
    'Ambush at Checkout',
    'Ironclad Pursuit',
    'Ricochet Avenue',
    'Warzone Weekend',
    'Blacktop Justice',
    'Detonation Point',
    'Standoff at Sundown',
    'The Getaway Clause',
    'Full Throttle Alibi',
    'Payback on Delivery',
    'One Man, One Van',
  ],
  Comedy: [
    'Ghost Plumbers',
    'Weekend at Bernards',
    'Hot Tub Tax Audit',
    'Uncle Buck Jr.',
    'Mall Cops 3',
    'Wedding Crushers',
    'Big Trouble',
    'Late Fee',
    'The Best Man Loses',
    'Jury Duty Vacation',
    'Honeymoon in Accounting',
    'Return to Sender',
    'The Casserole Incident',
    'Group Chat Gone Wrong',
    'Potluck of Doom',
    'My Landlord the Ninja',
    'Carpool Catastrophe',
    'The Timeshare Trap',
    'Grandpa’s Food Truck',
    'Open Mic Apocalypse',
    'The Neighbor’s Wi-Fi',
    'Parking Lot Pandemonium',
    'The Book Club Heist',
    'Fantasy Football Fiasco',
    'Dog Walker Deluxe',
  ],
  Drama: [
    'The Quiet Harbor',
    'Rain Over Nebraska',
    'A Few Fine Men',
    'Letters Unsent',
    'The Long Winter',
    'Steel Orchids',
    'Second Chances',
    'The Accountant’s Wife',
    'Low Tide',
    'The Weight of Ash',
    'Sundown Motel',
    'Paper Moonlight',
    'The Orchard at Dusk',
    'Blue Collar Requiem',
    'Where the River Bends',
    'A Life in Overtime',
    'The Cartographer’s Daughter',
    'Still Water Runs',
    'The Last Harvest',
    'Glass Houses',
    'The Widow’s Almanac',
    'Threadbare',
    'The Quarry Road',
    'Ashes of Elmwood',
    'The Patient Hour',
  ],
  Horror: [
    'Night of the Late Fees',
    'The Basement',
    'Scream Queen',
    'It Came From Aisle 3',
    'Return of the Rewinder',
    'Do Not Open',
    'Evil Dad',
    'Static',
    'The Crawlspace',
    'Dial M for Midnight',
    'Rewound',
    'The Sitter Upstairs',
    'The Landlord Downstairs',
    'Flicker',
    'The Taping',
    'Hour of the Wolf Moon',
    'The Guest Room',
    'Bloodmoon Drive-In',
    'The Thing in 4B',
    'Widow’s Peak Motel',
    'The Projectionist',
    'Hollow Creek',
    'The Tenant’s Secret',
    'Last Showing',
    'Behind the Mirror',
  ],
  'Sci-Fi': [
    'Robo Clerk',
    'Mars Mall',
    'Beyond the VHS',
    'Laser Planet',
    'Tron Again',
    'The Last Signal',
    'Alien Returns',
    'Cyber Cop 2099',
    'Orbit Station Zero',
    'The Clone Shift',
    'Satellite Heart',
    'Android Overtime',
    'The Nebula Job',
    'Wormhole Layover',
    'Starlight Repo',
    'The Synthetic Heart',
    'Colony 9',
    'Zero-G Getaway',
    'The Archive Ship',
    'Galactic Standby',
    'The Terraform Clause',
    'Nova Drift',
    'The Android’s Dilemma',
    'Lunar Static',
    'Red Dust Protocol',
  ],
  Family: [
    'Puppy Detective',
    'The Lost Kite',
    'Grandma’s Dragon',
    'Space Kids',
    'Honey I Shrunk the Store',
    'Duck Ranch',
    'The Little Robot',
    'Summer Camp Panic',
    'The Backyard Expedition',
    'Snowball Fort',
    'My Pet Dinosaur',
    'The Treehouse Club',
    'The Cookie Jar Caper',
    'Recess Rangers',
    'The Magic Lunchbox',
    'Barnyard Boogie',
    'The Invisible Goldfish',
    'Camp Wobegon',
    'The Attic Adventure',
    'Sled Dog Summer',
    'The Talking Bicycle',
    'Pajama Party Patrol',
    'The Secret Garden Gnome',
    'Bubblegum Island',
    'The Lighthouse Kids',
  ],
}

export const GENRES = Object.keys(TITLES) as Genre[]

// Fictional actors, each with the genres they tend to show up in
const ACTORS: [string, Genre[]][] = [
  ['Rex Calloway', ['Action', 'Sci-Fi']],
  ['Dana Steele', ['Action', 'Drama']],
  ['Buck Harmon', ['Action', 'Comedy']],
  ['Lola Vance', ['Comedy', 'Family']],
  ['Marty Fishburn', ['Comedy', 'Horror']],
  ['Gwen Ashby', ['Drama', 'Horror']],
  ['Vincent Crane', ['Drama', 'Sci-Fi']],
  ['Carla Moon', ['Sci-Fi', 'Horror']],
  ['Tommy Pickles', ['Family', 'Comedy']],
  ['Judy Bright', ['Family', 'Drama']],
  ['Hank Ozark', ['Horror', 'Action']],
  ['Nadia Kovac', ['Sci-Fi', 'Action']],
  ['Phil Dunmore', ['Comedy', 'Drama']],
  ['Rosie Tran', ['Family', 'Sci-Fi']],
]

const RATING_WEIGHTS: Record<Genre, [Rating, number][]> = {
  Action: [['Teen', 3], ['Mature', 5], ['X', 1]],
  Comedy: [['Kids', 1], ['Teen', 5], ['Mature', 3], ['X', 1]],
  Drama: [['Teen', 4], ['Mature', 5], ['X', 1]],
  Horror: [['Teen', 2], ['Mature', 5], ['X', 3]],
  'Sci-Fi': [['Kids', 1], ['Teen', 5], ['Mature', 3], ['X', 1]],
  Family: [['Kids', 8], ['Teen', 2]],
}

const DECADE_START: Record<Decade, number> = { '70s': 1970, '80s': 1980, '90s': 1990 }

// Mad-lib blurbs for the back of the box
const BIO_TEMPLATES = [
  '{lead} is {role} with nothing left to lose. When {threat} comes to {place}, only one thing stands in the way.',
  'Out in {place}, where {threat} rules, {lead} and {second} must {goal} before it is too late.',
  '{lead} stars as {role} who must {goal}. {second} co-stars in the {adj} hit of {year}.',
  'This summer, {lead} learns that {place} hides {threat}. A {adj} ride from start to finish.',
  '{lead} is back as {role} with one last chance to {goal}. The most {adj} film of {year}.',
]

const BIO_WORDS: Record<Genre, Record<string, string[]>> = {
  Action: {
    role: ['an ex-cop', 'a retired commando', 'a rogue agent', 'a cab driver'],
    threat: ['a gang of mercenaries', 'a stolen warhead', 'a crooked mayor'],
    place: ['the city', 'a cargo ship', 'a skyscraper', 'the highway'],
    goal: ['stop the heist', 'clear their name', 'save the hostages'],
    adj: ['explosive', 'pulse-pounding', 'relentless'],
  },
  Comedy: {
    role: ['a lazy slacker', 'a nervous groom', 'a mall security guard', 'a substitute teacher'],
    threat: ['an angry landlord', 'a talking parrot', 'a mix-up at the hotel'],
    place: ['the suburbs', 'a ski lodge', 'the office', 'Las Vegas'],
    goal: ['win the big bet', 'throw the perfect party', 'keep the secret'],
    adj: ['hilarious', 'outrageous', 'side-splitting'],
  },
  Drama: {
    role: ['a widowed farmer', 'a young lawyer', 'a struggling painter', 'a small-town nurse'],
    threat: ['an old secret', 'a long drought', 'a bitter divorce'],
    place: ['a quiet harbor town', 'the Midwest', 'a crumbling estate'],
    goal: ['find forgiveness', 'keep the family together', 'face the truth'],
    adj: ['moving', 'heartbreaking', 'unforgettable'],
  },
  Horror: {
    role: ['a babysitter', 'a night watchman', 'a camp counselor', 'a new homeowner'],
    threat: ['something in the walls', 'an ancient curse', 'a masked stranger'],
    place: ['an old farmhouse', 'a summer camp', 'a late-night video store'],
    goal: ['survive until dawn', 'break the curse', 'escape the house'],
    adj: ['terrifying', 'blood-curdling', 'nightmarish'],
  },
  'Sci-Fi': {
    role: ['a space trucker', 'a lonely android', 'a rookie pilot', 'a time traveler'],
    threat: ['an alien armada', 'a rogue computer', 'a dying sun'],
    place: ['a distant colony', 'the year 2099', 'a derelict starship'],
    goal: ['save the galaxy', 'return home', 'outsmart the machine'],
    adj: ['mind-bending', 'dazzling', 'visionary'],
  },
  Family: {
    role: ['a curious kid', 'a clumsy puppy', 'a brave little robot', 'a kind grandma'],
    threat: ['a grumpy neighbor', 'a big storm', 'a sneaky raccoon'],
    place: ['the backyard', 'a magical forest', 'summer camp'],
    goal: ['find their way home', 'save the farm', 'make a new friend'],
    adj: ['heartwarming', 'magical', 'delightful'],
  },
}

function pickActors(rand: Rand, genre: Genre) {
  const fits = ACTORS.filter(([, g]) => g.includes(genre)).map(([n]) => n)
  const others = ACTORS.filter(([, g]) => !g.includes(genre)).map(([n]) => n)
  const count = rand() < 0.5 ? 2 : 3
  // Usually a genre regular in the lead, sometimes someone unexpected
  const pool = [...shuffle(rand, fits).slice(0, 2), ...shuffle(rand, others).slice(0, 1)]
  return shuffle(rand, pool).slice(0, count)
}

function makeBio(rand: Rand, genre: Genre, actors: string[], year: number) {
  const words = BIO_WORDS[genre]
  return pick(rand, BIO_TEMPLATES).replace(/\{(\w+)\}/g, (_, key: string) => {
    if (key === 'lead') return actors[0]
    if (key === 'second') return actors[1]
    if (key === 'year') return String(year)
    return pick(rand, words[key])
  })
}

function makeMinutes(rand: Rand, genre: Genre) {
  const base = genre === 'Family' ? 75 : genre === 'Drama' ? 100 : 85
  return base + Math.floor(rand() * 60)
}

// Once a genre's handwritten titles are used up, the shelf just starts back
// at the top of the list with "II" tacked on (then "III" if it ever came to
// that) rather than needing new titles written for it
const ROMAN_NUMERALS = ['', 'II', 'III', 'IV', 'V']
const CATALOGUE_LAPS = 2
function withSequelLaps(titles: string[]) {
  const out: string[] = []
  for (let lap = 0; lap < CATALOGUE_LAPS; lap++) {
    for (const title of titles) out.push(lap === 0 ? title : `${title} ${ROMAN_NUMERALS[lap]}`)
  }
  return out
}

const rand = mulberry32(1985)

export const TAPES: Tape[] = GENRES.flatMap((genre) =>
  withSequelLaps(TITLES[genre]).map((title, i) => {
    const decade = weighted(rand, [['70s', 2], ['80s', 5], ['90s', 3]] as [Decade, number][])
    const year = DECADE_START[decade] + Math.floor(rand() * 10)
    const actors = pickActors(rand, genre)
    return {
      id: `${genre.toLowerCase()}-${i}`,
      title,
      genre,
      rating: weighted(rand, RATING_WEIGHTS[genre]),
      decade,
      year,
      minutes: makeMinutes(rand, genre),
      actors,
      bio: makeBio(rand, genre, actors, year),
    }
  }),
)

const TAPE_INDEX = new Map(TAPES.map((t) => [t.id, t]))
export const tapeById = (id: string) => TAPE_INDEX.get(id)!
