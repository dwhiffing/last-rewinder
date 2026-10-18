// All units are metres. x runs left/right, z runs from the store front (-z)
// to the back wall (+z). Players move between fixed nodes and can only face
// the four cardinal directions.

export const STORE_WIDTH = 12
export const STORE_DEPTH = 9
export const STORE_HEIGHT = 3
export const FRONT_Z = -4.5
export const BACK_Z = 4.5

export const EYE_HEIGHT = 1.5
// Downward camera tilt so a whole shelf (floor to sign) fits on screen
export const CAMERA_PITCH = (-12 * Math.PI) / 180

export const SHELF_WIDTH = 2
export const SHELF_HEIGHT = 1.8
export const SHELF_DEPTH = 0.4

// Distance from a node to the front of the shelf it looks at
export const VIEW_DISTANCE = 2

// Facing: 0 = +z (towards the back wall), 1 = +x, 2 = -z (towards the front), 3 = -x
export type Facing = 0 | 1 | 2 | 3

export const FACING_VECTORS: Record<Facing, [number, number]> = {
  0: [0, 1],
  1: [1, 0],
  2: [0, -1],
  3: [-1, 0],
}

const WALL_INNER = 0.1
const backRowZ = BACK_Z - WALL_INNER - SHELF_DEPTH / 2
// Standing spots in front of the back wall shelves
const backNodeZ = backRowZ - SHELF_DEPTH / 2 - VIEW_DISTANCE
const sideWallX = STORE_WIDTH / 2 - WALL_INNER - SHELF_DEPTH / 2
// Corner spots sit VIEW_DISTANCE from both the back shelf and the side shelf
const cornerX = sideWallX - SHELF_DEPTH / 2 - VIEW_DISTANCE

// Three shelves against the back wall, plus one on each side wall by the
// back corners. Rotation turns each shelf's front (local +z) into the room.
export const SHELVES: {
  id: string
  position: [number, number, number]
  rotationY: number
}[] = [
  { id: 'A', position: [-sideWallX, 0, backNodeZ], rotationY: Math.PI / 2 },
  { id: 'B', position: [-cornerX, 0, backRowZ], rotationY: Math.PI },
  { id: 'C', position: [0, 0, backRowZ], rotationY: Math.PI },
  { id: 'D', position: [cornerX, 0, backRowZ], rotationY: Math.PI },
  { id: 'E', position: [sideWallX, 0, backNodeZ], rotationY: -Math.PI / 2 },
]

// Every shelf has the same grid of slots, each holding at most one tape
export const SHELF_TIERS = 5
export const SLOTS_PER_TIER = 12

export const slotId = (shelf: string, tier: number, slot: number) =>
  `${shelf}-${tier}-${slot}`

export const ALL_SLOT_IDS = SHELVES.flatMap(({ id }) =>
  Array.from({ length: SHELF_TIERS * SLOTS_PER_TIER }, (_, i) =>
    slotId(id, Math.floor(i / SLOTS_PER_TIER), i % SLOTS_PER_TIER),
  ),
)

export const COUNTER_POSITION: [number, number, number] = [-cornerX, 0, -3.2]
export const DROP_BIN_POSITION: [number, number, number] = [cornerX, 0, -4.05]
export const ENTRANCE_X = 0

const frontNodeZ = -1.7

export interface NavNode {
  id: string
  x: number
  z: number
}

// A 3x2 grid: the corner spots see a back shelf ahead and a side shelf to
// the side, the middle back spot sees shelf C
export const NODES: NavNode[] = [
  { id: 'counter', x: -cornerX, z: frontNodeZ },
  { id: 'entrance', x: 0, z: frontNodeZ },
  { id: 'dropBin', x: cornerX, z: frontNodeZ },
  { id: 'cornerLeft', x: -cornerX, z: backNodeZ },
  { id: 'back', x: 0, z: backNodeZ },
  { id: 'cornerRight', x: cornerX, z: backNodeZ },
]

export const START_NODE = 'entrance'
export const START_FACING: Facing = 0

// Nearest node in a world direction, among nodes lined up on that axis
export function neighbourInDirection(
  from: NavNode,
  dir: Facing,
): NavNode | null {
  const [dx, dz] = FACING_VECTORS[dir]
  let best: NavNode | null = null
  let bestDist = Infinity
  for (const n of NODES) {
    if (n === from) continue
    const ox = n.x - from.x
    const oz = n.z - from.z
    const along = ox * dx + oz * dz
    const across = Math.abs(ox * dz - oz * dx)
    if (along <= 0 || across > 0.05) continue
    if (along < bestDist) {
      best = n
      bestDist = along
    }
  }
  return best
}

export const nodeById = (id: string) => NODES.find((n) => n.id === id)!
