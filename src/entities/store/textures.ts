import { BoxGeometry, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three'
import ceilingColor from '../../assets/ceiling-color.jpg'
import ceilingEmission from '../../assets/ceiling-emission.jpg'
import ceilingNormal from '../../assets/ceiling-normal.jpg'
import ceilingRoughness from '../../assets/ceiling-roughness.jpg'
import wallpaperColor from '../../assets/wallpaper-color.jpg'
import wallpaperNormal from '../../assets/wallpaper-normal.jpg'
import wallpaperRoughness from '../../assets/wallpaper-roughness.jpg'
import woodColor from '../../assets/wood-color.jpg'
import woodNormal from '../../assets/wood-normal.jpg'
import woodRoughness from '../../assets/wood-roughness.jpg'

export interface TextureSet {
  map: Texture
  normalMap: Texture
  roughnessMap: Texture
  emissiveMap?: Texture
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
  tile: 2.6,
}

export const WOOD: TextureSet = {
  map: load(woodColor, true),
  normalMap: load(woodNormal),
  roughnessMap: load(woodRoughness),
  tile: 1,
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
export function scaledBoxGeometry([x, y, z]: [number, number, number], tile: number) {
  const geo = new BoxGeometry(x, y, z)
  // faces in order +x, -x, +y, -y, +z, -z; each has 4 verts
  const dims: [number, number][] = [[z, y], [z, y], [x, z], [x, z], [x, y], [x, y]]
  const uv = geo.attributes.uv
  for (let face = 0; face < 6; face++) {
    const [w, h] = dims[face]
    for (let v = face * 4; v < face * 4 + 4; v++) {
      uv.setXY(v, (uv.getX(v) * w) / tile, (uv.getY(v) * h) / tile)
    }
  }
  return geo
}
