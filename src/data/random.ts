// Small seeded RNG so generated content is the same every run
export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rand = () => number

export const pick = <T>(rand: Rand, list: readonly T[]) =>
  list[Math.floor(rand() * list.length)]

export function shuffle<T>(rand: Rand, list: readonly T[]) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Pick from weighted options: [[value, weight], ...]
export function weighted<T>(rand: Rand, options: [T, number][]) {
  const total = options.reduce((sum, [, w]) => sum + w, 0)
  let r = rand() * total
  for (const [value, w] of options) {
    r -= w
    if (r < 0) return value
  }
  return options[options.length - 1][0]
}
