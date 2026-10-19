// All units are metres. x runs left/right, z runs from the store front (-z)
// to the back wall (+z). Players move between fixed nodes and can only face
// the four cardinal directions.

export const STORE_HEIGHT = 2.6
export const BACK_Z = 4

export const EYE_HEIGHT = 1.5

export const SHELF_WIDTH = 1.6
// Tall shelves: the top sits about a foot below the ceiling
export const SHELF_HEIGHT = STORE_HEIGHT - 0.3
export const SHELF_DEPTH = 0.32

// Distance from a node to the front of the shelf it looks at
export const VIEW_DISTANCE = 1.6

// Aim the camera so a whole shelf, floor to top, fits on screen from its spot
const shelfTopAngle = Math.atan((SHELF_HEIGHT - EYE_HEIGHT) / VIEW_DISTANCE)
const shelfFootAngle = Math.atan(EYE_HEIGHT / VIEW_DISTANCE)
export const CAMERA_PITCH = (shelfTopAngle - shelfFootAngle) / 2
// Slightly tighter than the full shelf height so the tapes fill the view
export const CAMERA_VFOV = ((shelfTopAngle + shelfFootAngle) * 180 * 0.95) / Math.PI

// Standing spots form a grid with the same gap between neighbours in both
// directions. Front to back, two spots are separated by VIEW_DISTANCE, a
// double-sided unit and VIEW_DISTANCE again, with the centre spot halfway,
// so one gap is VIEW_DISTANCE plus one shelf depth.
export const NODE_SPACING = VIEW_DISTANCE + SHELF_DEPTH

const WALL_INNER = 0.1
// Wide enough that the side shelves sit VIEW_DISTANCE from the corner spots
export const STORE_WIDTH =
  2 * (NODE_SPACING + VIEW_DISTANCE + SHELF_DEPTH + WALL_INNER)

// Facing: 0 = +z (towards the back wall), 1 = +x, 2 = -z (towards the front), 3 = -x
export type Facing = 0 | 1 | 2 | 3

export const FACING_VECTORS: Record<Facing, [number, number]> = {
  0: [0, 1],
  1: [1, 0],
  2: [0, -1],
  3: [-1, 0],
}

const backRowZ = BACK_Z - WALL_INNER - SHELF_DEPTH / 2
// Standing spots in front of the back wall shelves
const backNodeZ = backRowZ - SHELF_DEPTH / 2 - VIEW_DISTANCE
// Corner spots sit VIEW_DISTANCE from both the back shelf and the side shelf
const cornerX = NODE_SPACING
const sideWallX = cornerX + VIEW_DISTANCE + SHELF_DEPTH / 2

// Shelves F and G stand opposite B and D, facing them across the corner
// spots; H and I stand back to back with them, facing the store front
const facingRowZ = backNodeZ - VIEW_DISTANCE - SHELF_DEPTH / 2
const frontFacingRowZ = facingRowZ - SHELF_DEPTH
// Standing spots in front of H and I (and the counter, entrance, drop bin)
const frontNodeZ = frontFacingRowZ - SHELF_DEPTH / 2 - VIEW_DISTANCE

// Three shelves against the back wall, one on each side wall by the back
// corners, and two double-sided freestanding units (F|H and G|I) between
// the corner spots and the front row.
// Rotation turns each shelf's front (local +z) into the room.
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
  { id: 'F', position: [-cornerX, 0, facingRowZ], rotationY: 0 },
  { id: 'G', position: [cornerX, 0, facingRowZ], rotationY: 0 },
  { id: 'H', position: [-cornerX, 0, frontFacingRowZ], rotationY: Math.PI },
  { id: 'I', position: [cornerX, 0, frontFacingRowZ], rotationY: Math.PI },
]

// Floor footprint of a shelf, for keeping walking routes clear of it
function shelfFootprint({ position: [x, , z], rotationY }: (typeof SHELVES)[number]) {
  const sideways = Math.abs(Math.sin(rotationY)) > 0.5
  const halfX = (sideways ? SHELF_DEPTH : SHELF_WIDTH) / 2
  const halfZ = (sideways ? SHELF_WIDTH : SHELF_DEPTH) / 2
  return { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ }
}

const FOOTPRINTS = SHELVES.map(shelfFootprint)

// True if walking straight between two points (along x or z) hits a shelf
function routeBlocked(ax: number, az: number, bx: number, bz: number) {
  const minX = Math.min(ax, bx)
  const maxX = Math.max(ax, bx)
  const minZ = Math.min(az, bz)
  const maxZ = Math.max(az, bz)
  return FOOTPRINTS.some(
    (f) => minX <= f.maxX && maxX >= f.minX && minZ <= f.maxZ && maxZ >= f.minZ,
  )
}

// Every shelf has the same grid of slots, each holding at most one tape
export const SHELF_TIERS = 6
export const SLOTS_PER_TIER = 12

export const slotId = (shelf: string, tier: number, slot: number) =>
  `${shelf}-${tier}-${slot}`

export const ALL_SLOT_IDS = SHELVES.flatMap(({ id }) =>
  Array.from({ length: SHELF_TIERS * SLOTS_PER_TIER }, (_, i) =>
    slotId(id, Math.floor(i / SLOTS_PER_TIER), i % SLOTS_PER_TIER),
  ),
)

// The counter sits 0.8m in front of its spot, with a 0.65m strip for
// customers between it and the front wall; the drop bin stands against the wall
export const COUNTER_SIZE: [number, number, number] = [2, 1, 0.5]
export const COUNTER_POSITION: [number, number, number] = [
  -cornerX,
  0,
  frontNodeZ - 0.8 - COUNTER_SIZE[2] / 2,
]
export const FRONT_Z = COUNTER_POSITION[2] - COUNTER_SIZE[2] / 2 - 0.65 - WALL_INNER
export const DROP_BIN_POSITION: [number, number, number] = [cornerX, 0, FRONT_Z + WALL_INNER + 0.35]
export const ENTRANCE_X = 0


export interface NavNode {
  id: string
  x: number
  z: number
}

// A 3x3 grid, NODE_SPACING apart, with only the middle of the centre row
// used: the corner spots see a back shelf ahead, a side shelf to the side and
// F or G behind; the middle back spot sees shelf C; the outer front spots see
// H or I ahead and the counter or drop bin behind. The shelf units block the
// outer columns, so the rows connect through the centre spot.
export const NODES: NavNode[] = [
  { id: 'counter', x: -cornerX, z: frontNodeZ },
  { id: 'entrance', x: 0, z: frontNodeZ },
  { id: 'dropBin', x: cornerX, z: frontNodeZ },
  { id: 'centre', x: 0, z: frontNodeZ + NODE_SPACING },
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
    if (along < bestDist && !routeBlocked(from.x, from.z, n.x, n.z)) {
      best = n
      bestDist = along
    }
  }
  return best
}

export const nodeById = (id: string) => NODES.find((n) => n.id === id)!

// Small table against the left wall, level with the counter spot, holding the
// tape rewinder; its top faces into the store (+x)
export const REWINDER_TABLE_SIZE: [number, number, number] = [0.5, 0.9, 0.8]
export const REWINDER_TABLE_POSITION: [number, number, number] = [
  -(STORE_WIDTH / 2 - WALL_INNER - REWINDER_TABLE_SIZE[0] / 2),
  0,
  frontNodeZ,
]
