import {
  type Facing,
  type NavNode,
  neighbourInDirection,
  nodeById,
  START_FACING,
  START_NODE,
} from '../../data/storeLayout'

const MOVE_MS = 280
const TURN_MS = 200

// Where the player stands and faces. The camera eases from `from*` to the
// current node/facing over the move or turn duration.
export const nav = {
  node: nodeById(START_NODE),
  facing: START_FACING as Facing,
  fromX: nodeById(START_NODE).x,
  fromZ: nodeById(START_NODE).z,
  fromYaw: facingToYaw(START_FACING),
  toYaw: facingToYaw(START_FACING),
  startedAt: 0,
  duration: 0,
}

// Camera yaw (radians) for a facing; three.js cameras look down -z at yaw 0
// and a positive yaw turns them left
export function facingToYaw(facing: Facing) {
  return Math.PI + (facing * Math.PI) / 2
}

export function isBusy(now: number) {
  return now - nav.startedAt < nav.duration
}

// Current eased camera position and yaw
export function sampleNav(now: number) {
  const t = nav.duration
    ? Math.min(1, (now - nav.startedAt) / nav.duration)
    : 1
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  return {
    x: nav.fromX + (nav.node.x - nav.fromX) * e,
    z: nav.fromZ + (nav.node.z - nav.fromZ) * e,
    yaw: nav.fromYaw + (nav.toYaw - nav.fromYaw) * e,
  }
}

function settle(now: number) {
  const s = sampleNav(now)
  nav.fromX = s.x
  nav.fromZ = s.z
  nav.fromYaw = s.yaw
}

// Step to the neighbouring node in a direction relative to the facing
// (0 = forward, 1 = right, 2 = back, 3 = left). Returns false if there is none.
export function step(relative: 0 | 1 | 2 | 3, now: number) {
  if (isBusy(now)) return false
  // facings go anticlockwise, so turning right lowers the facing
  const dir = ((nav.facing - relative + 4) % 4) as Facing
  const next: NavNode | null = neighbourInDirection(nav.node, dir)
  if (!next) return false
  settle(now)
  nav.node = next
  nav.startedAt = now
  nav.duration = MOVE_MS
  return true
}

// Turn 90 degrees: +1 clockwise (right), -1 anticlockwise (left)
// Returns whether the turn started
export function turn(delta: 1 | -1, now: number) {
  if (isBusy(now)) return false
  settle(now)
  nav.facing = ((nav.facing - delta + 4) % 4) as Facing
  nav.toYaw = nav.fromYaw - (delta * Math.PI) / 2
  nav.startedAt = now
  nav.duration = TURN_MS
  return true
}

export function resetNav() {
  const node = nodeById(START_NODE)
  nav.node = node
  nav.facing = START_FACING
  nav.fromX = node.x
  nav.fromZ = node.z
  nav.fromYaw = nav.toYaw = facingToYaw(START_FACING)
  nav.startedAt = 0
  nav.duration = 0
}
