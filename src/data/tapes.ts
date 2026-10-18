// Placeholder catalogue. Titles are made up; colors stand in for box art.

export type Genre = 'Action' | 'Comedy' | 'Drama' | 'Horror' | 'Sci-Fi' | 'Family'

export interface Tape {
  id: string
  title: string
  genre: Genre
}

export const GENRE_COLORS: Record<Genre, string> = {
  Action: '#c0392b',
  Comedy: '#f1c40f',
  Drama: '#8e44ad',
  Horror: '#2c3e50',
  'Sci-Fi': '#16a085',
  Family: '#e67e22',
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
  ],
}

export const GENRES = Object.keys(TITLES) as Genre[]

export const TAPES: Tape[] = GENRES.flatMap((genre) =>
  TITLES[genre].map((title, i) => ({
    id: `${genre.toLowerCase()}-${i}`,
    title,
    genre,
  })),
)

export const tapeById = (id: string) => TAPES.find((t) => t.id === id)!
