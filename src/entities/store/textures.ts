import {
  BoxGeometry,
  EquirectangularReflectionMapping,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from 'three'
import ceilingColor from '../../assets/ceiling-color.jpg'
import ceilingEmission from '../../assets/ceiling-emission.jpg'
import ceilingNormal from '../../assets/ceiling-normal.jpg'
import ceilingRoughness from '../../assets/ceiling-roughness.jpg'
import wallpaperColor from '../../assets/wallpaper-color.jpg'
import wallpaperNormal from '../../assets/wallpaper-normal.jpg'
import wallpaperRoughness from '../../assets/wallpaper-roughness.jpg'
import nightSkyUrl from '../../assets/night-sky.jpg'
import glassSmudge from '../../assets/glass-smudge.webp'
import scuffsColor from '../../assets/scuffs-table-color.jpg'
import scuffsNormal from '../../assets/scuffs-normal.jpg'
import woodColor from '../../assets/wood-color.jpg'
import woodNormal from '../../assets/wood-normal.jpg'
import woodRoughness from '../../assets/wood-roughness.jpg'

export interface TextureSet {
  map?: Texture
  normalMap: Texture
  roughnessMap?: Texture
  emissiveMap?: Texture
  // how strongly the normal map bumps the surface (default 1)
  normalScale?: number
  // metres of surface one copy of the texture covers
  tile: number
}

const loader = new TextureLoader()
function load(url: string, color = false) {
  const tex = loader.load(url)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.anisotropy = 8
  if (color) tex.colorSpace = SRGBColorSpace
  return tex
}

export const WALLPAPER: TextureSet = {
  map: load(wallpaperColor, true),
  normalMap: load(wallpaperNormal),
  roughnessMap: load(wallpaperRoughness),
  tile: 3.9,
}

export const WOOD: TextureSet = {
  map: load(woodColor, true),
  normalMap: load(woodNormal),
  roughnessMap: load(woodRoughness),
  tile: 1,
}

// Splattered grime for painted surfaces like the tables: a mostly-white map
// that darkens the paint where it's stained, plus matching bumps
export const SCUFFS: TextureSet = {
  map: load(scuffsColor, true),
  normalMap: load(scuffsNormal),
  normalScale: 0.7,
  tile: 1.5,
}

export const CEILING: TextureSet = {
  map: load(ceilingColor, true),
  normalMap: load(ceilingNormal),
  roughnessMap: load(ceilingRoughness),
  emissiveMap: load(ceilingEmission, true),
  tile: 4,
}

// A box whose UVs are scaled by each face's size in metres, so a texture
// keeps the same scale on every face instead of stretching
// `origin` (the box's centre in the world) lines the +z face up with
// neighbouring boxes, so a wall built from pieces has no seams
export function scaledBoxGeometry(
  [x, y, z]: [number, number, number],
  tile: number,
  origin?: [number, number, number],
) {
  const geo = new BoxGeometry(x, y, z)
  // faces in order +x, -x, +y, -y, +z, -z; each has 4 verts
  const dims: [number, number][] = [[z, y], [z, y], [x, z], [x, z], [x, y], [x, y]]
  const uv = geo.attributes.uv
  for (let face = 0; face < 6; face++) {
    const [w, h] = dims[face]
    for (let v = face * 4; v < face * 4 + 4; v++) {
      let u = (uv.getX(v) * w) / tile
      let t = (uv.getY(v) * h) / tile
      if (origin && face === 4) {
        u += (origin[0] - x / 2) / tile
        t += (origin[1] - y / 2) / tile
      }
      uv.setXY(v, u, t)
    }
  }
  return geo
}

// Grimy glass: a pale tint that is mostly see-through, with cloudier
// smudges and splatters. One copy per size of pane, scaled to match.
const smudgeLoader = load(glassSmudge, true)
const glassCache = new Map<string, Texture>()
export function glassTexture(width: number, height: number) {
  const key = `${width.toFixed(3)}x${height.toFixed(3)}`
  let tex = glassCache.get(key)
  if (!tex) {
    tex = smudgeLoader.clone()
    tex.repeat.set(width / 1.5, height / 1.5)
    tex.needsUpdate = true
    glassCache.set(key, tex)
  }
  return tex
}

// Night panorama outside the windows: the scene background, and what the
// raindrops on the glass refract
export const NIGHT_SKY = loader.load(nightSkyUrl)
NIGHT_SKY.mapping = EquirectangularReflectionMapping
NIGHT_SKY.colorSpace = SRGBColorSpace
